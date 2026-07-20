import { useEffect, useRef } from 'react'
import { useSimulatorStore } from '@/store/useSimulatorStore'
import { transpileArduinoToJS } from '@/utils/simulation/transpiler'
import { createSimulationContext } from '@/utils/simulation/runtime'
import { updateSimulationPhysics } from '@/utils/simulation/physics'

// Physics integrates at a fixed, fine-grained step regardless of how fast
// or slow the user's Arduino/ESP32 code runs (including delay() calls).
// 2ms gives good fidelity for RC charge curves and PWM-driven brightness
// without being so fine it dominates frame budget.
const PHYSICS_FIXED_DT = 0.002
const MAX_PHYSICS_STEPS_PER_FRAME = 250 // safety cap if a huge delay() stalls the loop

export function useSimulationRunner() {
  const simulationStatus = useSimulatorStore((s) => s.simulationStatus)
  const code = useSimulatorStore((s) => s.code)
  const nodes = useSimulatorStore((s) => s.nodes)

  const setSimulationStatus = useSimulatorStore((s) => s.setSimulationStatus)
  const addLog = useSimulatorStore((s) => s.addLog)
  const setSimulationDiagnostics = useSimulatorStore((s) => s.setSimulationDiagnostics)
  const updateNodeProperties = useSimulatorStore((s) => s.updateNodeProperties)
  const updateEdge = useSimulatorStore((s) => s.updateEdge)
  const resetSimulationState = useSimulatorStore((s) => s.resetSimulationState)
  const addTimelineEvent = useSimulatorStore((s) => s.addTimelineEvent)

  const activeLoopRef = useRef<boolean>(false)
  const lastTickTimeRef = useRef<number>(0)
  const physicsAccumulatorRef = useRef<number>(0)
  const activeWarningsRef = useRef<Set<string>>(new Set())
  const activeShortsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (simulationStatus !== 'running') {
      activeLoopRef.current = false
      return
    }

    // Audio setup for buzzers - pre-create synchronously inside user click gesture stack
    let audioCtx: AudioContext | null = null
    try {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
    } catch (e) {
      console.error('Failed to pre-create AudioContext:', e)
    }
    const oscillators: Record<string, { osc: OscillatorNode; gain: GainNode }> = {}

    const stopAudio = () => {
      Object.entries(oscillators).forEach(([id, item]) => {
        try {
          item.osc.stop()
          item.osc.disconnect()
          item.gain.disconnect()
        } catch (e) {
          // ignore
        }
        delete oscillators[id]
      })
      if (audioCtx) {
        try {
          audioCtx.close()
        } catch (e) {
          // ignore
        }
        audioCtx = null
      }
    }

    activeLoopRef.current = true
    resetSimulationState()
    activeWarningsRef.current.clear()
    activeShortsRef.current.clear()
    physicsAccumulatorRef.current = 0

    // 1. Transpile code
    let transpiled: ReturnType<typeof transpileArduinoToJS>
    try {
      transpiled = transpileArduinoToJS(code)
      addLog('info', 'Code transpilation successful. Ready to run.', 'simulation')
    } catch (err: any) {
      addLog('error', `Compilation Error: ${err.message}`, 'simulation')
      setSimulationStatus('error')
      return
    }

    // 2. Identify all microcontroller boards
    const boards = nodes.filter((n) => n.type === 'arduino-uno' || n.type === 'esp32-devkit')
    if (boards.length === 0) {
      addLog('warn', 'No microcontroller boards (Arduino Uno or ESP32) found in circuit workspace.', 'simulation')
    }

    // 3. Initialize runtimes for each board
    const simStartRealTime = Date.now()
    const getSpeedRatio = () => {
      const spd = useSimulatorStore.getState().simulationSpeed
      return spd === 'unlimited' ? Infinity : spd
    }

    interface BoardRuntime {
      boardId: string
      boardName: string
      faulted: boolean
      initializer: () => Promise<void>
      tick: () => Promise<void>
    }

    const runtimes: BoardRuntime[] = boards.map((board) => {
      const context = createSimulationContext(board.id, simStartRealTime, getSpeedRatio)
      const keys = Object.keys(context)
      const values = Object.values(context)

      let setupFunc = async () => {}
      let loopFunc = async () => {}

      const runner = new Function(...keys, `
        return (async () => {
          ${transpiled.jsCode}
        })()
      `)
      const resultPromise = runner(...values)

      return {
        boardId: board.id,
        boardName: board.properties.name || board.id,
        faulted: false,
        initializer: async () => {
          const { setup, loop } = await resultPromise
          setupFunc = setup
          loopFunc = loop
          await setupFunc()
        },
        tick: async () => {
          await loopFunc()
        },
      }
    })

    // 4. Start execution loop
    const startExecution = async () => {
      // 4a. Per-board initialization — isolate failures so one bad board
      // doesn't prevent the others from starting.
      const initResults = await Promise.allSettled(runtimes.map((rt) => rt.initializer()))
      initResults.forEach((result, i) => {
        if (result.status === 'rejected') {
          const rt = runtimes[i]
          rt.faulted = true
          addLog('error', `Runtime Setup Error on ${rt.boardName}: ${result.reason?.message ?? result.reason}`, 'simulation')
        }
      })

      const liveRuntimes = runtimes.filter((rt) => !rt.faulted)
      if (runtimes.length > 0 && liveRuntimes.length === 0) {
        setSimulationStatus('error')
        return
      }

      addLog('info', 'Arduino setup() complete. Running loop().', 'simulation')

      lastTickTimeRef.current = performance.now()
      let totalLoops = 0
      let loopTimeSum = 0

      // Core Loop Runner
      while (activeLoopRef.current) {
        const loopStart = performance.now()
        const speedRatio = getSpeedRatio()

        // 4b. Execute loop() for each still-healthy board, isolated from
        // each other. A throwing board is logged once, marked faulted, and
        // excluded from subsequent ticks — the rest of the simulation
        // (and the rest of the circuit's physics) keeps running.
        const tickTargets = runtimes.filter((rt) => !rt.faulted)
        if (tickTargets.length > 0) {
          const tickResults = await Promise.allSettled(tickTargets.map((rt) => rt.tick()))
          tickResults.forEach((result, i) => {
            if (result.status === 'rejected') {
              const rt = tickTargets[i]
              rt.faulted = true
              addLog('error', `Runtime Loop Exception on ${rt.boardName}: ${result.reason?.message ?? result.reason}. Board disabled; simulation continues.`, 'simulation')
              addTimelineEvent('fault_injected', `⚠️ ${rt.boardName} crashed and was disabled`)
            }
          })
        }

        const loopEnd = performance.now()
        const loopDur = loopEnd - loopStart
        totalLoops++
        loopTimeSum += loopDur

        // 4c. Fixed-step physics integration, decoupled from code loop speed.
        // Any wall-clock time elapsed (scaled by sim speed) is converted into
        // a whole number of fixed-size physics steps, so capacitor/battery/
        // regulator integration stays numerically stable regardless of how
        // long the user's loop() (including delay()) takes to run.
        const now = performance.now()
        const deltaMs = now - lastTickTimeRef.current
        lastTickTimeRef.current = now
        const scaledDeltaSec = (deltaMs / 1000) * (speedRatio === Infinity ? 1 : speedRatio)

        if (scaledDeltaSec > 0) {
          physicsAccumulatorRef.current += scaledDeltaSec

          let stepsRun = 0
          while (
            physicsAccumulatorRef.current >= PHYSICS_FIXED_DT &&
            stepsRun < MAX_PHYSICS_STEPS_PER_FRAME
          ) {
            const store = useSimulatorStore.getState()
            const physicsUpdates = updateSimulationPhysics(
              store.nodes,
              store.edges,
              store.gpioPinStates,
              PHYSICS_FIXED_DT
            )

            // Apply physics updates back to workspace nodes & edges
            Object.entries(physicsUpdates.nodes).forEach(([nodeId, props]) => {
              if (Object.keys(props).length > 0) {
                if (props.blown === true) {
                  const node = store.nodes.find((n) => n.id === nodeId)
                  const alreadyBlown = (node?.properties.blown as boolean) || false
                  if (!alreadyBlown) {
                    const name = node?.properties.name || 'Fuse'
                    addLog('error', `💥 Fuse Blown: ${name} blew due to overcurrent!`, 'simulation')
                    addTimelineEvent('fault_injected', `💥 Fuse Blown: ${name}`)
                  }
                }
                updateNodeProperties(nodeId, props)
              }
            })
            Object.entries(physicsUpdates.edges).forEach(([edgeId, props]) => {
              if (Object.keys(props).length > 0) {
                updateEdge(edgeId, props)
              }
            })

            // Handle warnings state transitions
            const currentWarningKeys = new Set<string>()
            physicsUpdates.warnings.forEach((warn) => {
              const key = `${warn.nodeId}:${warn.msg}`
              currentWarningKeys.add(key)
              if (!activeWarningsRef.current.has(key)) {
                activeWarningsRef.current.add(key)
                addLog('warn', warn.msg, 'simulation')
                addTimelineEvent('warning', warn.msg)
              }
            })
            activeWarningsRef.current.forEach((key) => {
              if (!currentWarningKeys.has(key)) {
                activeWarningsRef.current.delete(key)
              }
            })

            // Handle short-circuit state transitions
            const currentShorts = new Set<string>()
            physicsUpdates.shortCircuits.forEach((short) => {
              currentShorts.add(short)
              if (!activeShortsRef.current.has(short)) {
                activeShortsRef.current.add(short)
                addLog('error', `⚠️ Short Circuit: net ${short} is drawing excessive current!`, 'simulation')
                addTimelineEvent('fault_injected', `⚠️ Short Circuit: net ${short}`)
              }
            })
            activeShortsRef.current.forEach((short) => {
              if (!currentShorts.has(short)) {
                activeShortsRef.current.delete(short)
                addLog('info', `🟢 Short Circuit Resolved on net ${short}.`, 'simulation')
                addTimelineEvent('fault_cleared', `🟢 Short Circuit Resolved: net ${short}`)
              }
            })

            physicsAccumulatorRef.current -= PHYSICS_FIXED_DT
            stepsRun++
          }

          // If a huge delay() caused a runaway accumulator, drop the excess
          // rather than spending the next several seconds "catching up" in
          // a burst — prevents a stutter-then-fast-forward artifact.
          if (physicsAccumulatorRef.current > PHYSICS_FIXED_DT * MAX_PHYSICS_STEPS_PER_FRAME) {
            physicsAccumulatorRef.current = 0
          }
        }

        // Update audio oscillators for active buzzers (only if simulation loop is still active)
        if (activeLoopRef.current) {
          const currentStore = useSimulatorStore.getState()
          const buzzerNodes = currentStore.nodes.filter((n) => n.type === 'buzzer')
          const anyActiveBuzzer = buzzerNodes.some((n) => n.properties.isActive)
          
          if (anyActiveBuzzer && speedRatio !== Infinity && audioCtx) {
            if (audioCtx.state === 'suspended') {
              audioCtx.resume()
            }
          }

          buzzerNodes.forEach((node) => {
            const isActive = node.properties.isActive === true && speedRatio !== Infinity
            const freq = Number(node.properties.frequency || 2000)

            if (isActive && audioCtx) {
              if (!oscillators[node.id]) {
                try {
                  const osc = audioCtx.createOscillator()
                  const gain = audioCtx.createGain()
                  osc.type = 'sine'
                  osc.frequency.setValueAtTime(freq, audioCtx.currentTime)
                  gain.gain.setValueAtTime(0.04, audioCtx.currentTime)
                  osc.connect(gain)
                  gain.connect(audioCtx.destination)
                  osc.start()
                  oscillators[node.id] = { osc, gain }
                } catch (err) {
                  console.error('Failed to play buzzer audio:', err)
                }
              } else {
                const item = oscillators[node.id]
                try {
                  item.osc.frequency.setValueAtTime(freq, audioCtx.currentTime)
                } catch (e) {
                  // ignore
                }
              }
            } else {
              if (oscillators[node.id]) {
                try {
                  oscillators[node.id].osc.stop()
                  oscillators[node.id].osc.disconnect()
                  oscillators[node.id].gain.disconnect()
                } catch (e) {
                  // ignore
                }
                delete oscillators[node.id]
              }
            }
          })
        }

        // 4d. Update diagnostics
        setSimulationDiagnostics({
          loopCount: totalLoops,
          executionTime: Math.floor((Date.now() - simStartRealTime) * (speedRatio === Infinity ? 1 : speedRatio)),
          loopFps: Math.round(1000 / (loopTimeSum / totalLoops || 1)),
        })

        // 4e. Update oscilloscope signal buffers
        const storeInstance = useSimulatorStore.getState()
        if (storeInstance.probedPins.length > 0) {
          const simTime = storeInstance.simulationDiagnostics.executionTime / 1000
          storeInstance.probedPins.forEach((pinKey) => {
            const [mcuId, pinId] = pinKey.split(':')
            const mcuPins = storeInstance.gpioPinStates[mcuId] || {}
            const pinVal = mcuPins[pinId]

            let numVal = 0
            if (pinVal === 'HIGH' || pinVal === 1) numVal = 5.0
            else if (pinVal === 'LOW' || pinVal === 0) numVal = 0.0
            else if (typeof pinVal === 'number') {
              numVal = (pinVal / 255) * 5.0
            } else if (pinVal === 'INPUT_PULLUP') {
              numVal = 5.0
            }

            storeInstance.updateWaveformBuffer(pinKey, simTime, numVal)
          })
        }

        // If every board has faulted, there's nothing left driving the
        // circuit's digital logic — stop cleanly instead of spinning forever.
        if (runtimes.length > 0 && runtimes.every((rt) => rt.faulted)) {
          addLog('error', 'All microcontroller boards have crashed. Simulation halted.', 'simulation')
          setSimulationStatus('error')
          break
        }

        // Yield execution to browser render thread to prevent UI freezing.
        // Batch several loop iterations per macrotask under "unlimited"
        // speed rather than yielding every single iteration, since nested
        // setTimeout is clamped to a ~4ms floor by the browser.
        if (speedRatio === Infinity) {
          if (totalLoops % 20 === 0) {
            await new Promise((resolve) => setTimeout(resolve, 0))
          }
        } else {
          const targetLoopInterval = 15 / speedRatio // 15ms target loop pacing
          const waitTime = Math.max(1, targetLoopInterval - loopDur)
          await new Promise((resolve) => setTimeout(resolve, waitTime))
        }
      }
      
      // Ensure all audio ceases immediately when loop terminates
      stopAudio()
    }

    startExecution()

    return () => {
      activeLoopRef.current = false
      stopAudio()
    }
  }, [simulationStatus, code])
}