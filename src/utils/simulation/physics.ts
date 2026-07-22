import type { WorkspaceNode, WorkspaceEdge } from '@/types'
import { useSimulatorStore } from '@/store/useSimulatorStore'
import { solveCircuitNew } from './solver/newCircuitSolver'

/**
 * Default battery capacities in mAh, used for coulomb-counting drain.
 * Real-world approximate values for common cell/pack types.
 */
const BATTERY_CAPACITY_MAH: Record<string, number> = {
  'battery-9v': 550,
  'battery-snap-9v': 550,
  'battery-12v': 7000, // small SLA-style pack
  'battery-18650': 2600,
  'holder-18650': 2600,
}

const BATTERY_BASE_VOLTAGE: Record<string, number> = {
  'battery-9v': 9.0,
  'battery-snap-9v': 9.0,
  'battery-12v': 12.0,
  'battery-18650': 3.7,
  'holder-18650': 3.7,
}

// Rated forward current used to normalize LED/bulb brightness against real solved current
const LED_RATED_CURRENT_A = 0.02 // 20mA — typical full-brightness point for a 5mm LED
const BULB_RATED_CURRENT_A = 0.5 // typical small 12V bulb full-brightness point

/**
 * Executes a single physics tick, updating voltages, currents, temperatures,
 * charge levels, and motor/fan speeds based on time elapsed.
 *
 * All electrical truth (voltages, currents, on/off states) comes from
 * solveCircuitNew — a real nodal-analysis (KCL/Ohm's-law) solver. This
 * function is only responsible for time-integration (inertia, charge
 * depletion, thermal-ish brightness response) and translating solved
 * electrical quantities into visual/behavioral component properties.
 */
export function updateSimulationPhysics(
  nodes: WorkspaceNode[],
  edges: WorkspaceEdge[],
  gpioPinStates: Record<string, Record<string, any>>,
  deltaTimeSec: number
): {
  nodes: Record<string, Record<string, any>>
  edges: Record<string, Record<string, any>>
  warnings: { nodeId: string; msg: string }[]
  shortCircuits: string[]
} {
  const nodePropertyUpdates: Record<string, Record<string, any>> = {}
  const activeFaults = useSimulatorStore.getState().activeFaults || {}

  const solution = solveCircuitNew(nodes, edges, gpioPinStates, activeFaults, deltaTimeSec)

  const isPinGrounded = (nodeId: string, pinId: string): boolean =>
    solution.nodeGND[`${nodeId}:${pinId}`] || false

  const getPinVoltage = (nodeId: string, pinId: string): number =>
    solution.nodeVoltages[`${nodeId}:${pinId}`] || 0.0

  const getComponentCurrent = (nodeId: string): number =>
    Math.abs(solution.componentCurrents?.[nodeId] || 0.0)

  // NEW: checks whether a pin has any wire attached at all, regardless of
  // what the solver resolved its voltage to. Needed for pins like a fan's
  // PWM line, where "no wire" and "wire resolving to 0V" mean different
  // things electrically (floating vs. actively pulled/driven low).
  const isPinConnected = (nodeId: string, pinId: string): boolean =>
    edges.some(
      (edge) =>
        (edge.sourceNodeId === nodeId && edge.sourcePinId === pinId) ||
        (edge.targetNodeId === nodeId && edge.targetPinId === pinId)
    )

  nodes.forEach((node) => {
    nodePropertyUpdates[node.id] = {}

    // A. Super Capacitor charge/discharge, driven by real solved current (I = C dV/dt)
    if (node.type === 'super-capacitor') {
      const storedVoltage = Number(node.properties.storedVoltage ?? 0)
      const capValueF = Math.max(0.01, Number(node.properties.capacitance ?? 1.0)) // farads
      const signedCurrent = solution.componentCurrents?.[node.id] || 0.0 // signed current from solver
      const currentMag = Math.abs(signedCurrent)
      const posV = getPinVoltage(node.id, 'pos')
      const negV = getPinVoltage(node.id, 'neg')
      const pinDiff = posV - negV

      // Direction: charging if net/pin difference exceeds stored voltage or signed current is positive
      const isCharging = signedCurrent > 0.0001 || (pinDiff > storedVoltage + 0.001)
      const dV = (currentMag / capValueF) * deltaTimeSec
      let newVoltage = storedVoltage
      if (isCharging) {
        const maxLimit = Number(node.properties.voltage ?? 16.0)
        newVoltage = Math.min(maxLimit, storedVoltage + dV)
      } else if (storedVoltage > 0 && currentMag > 0.0001) {
        newVoltage = Math.max(0, storedVoltage - dV)
      }

      nodePropertyUpdates[node.id].storedVoltage = newVoltage
    }

    // B. LM7805 Voltage Regulator dropout — mirrors solver's internal regulation model
    if (node.type === 'lm7805') {
      const vin = getPinVoltage(node.id, 'in')
      let outputVoltage = 0.0
      if (vin >= 7.0) {
        outputVoltage = 5.0
      } else if (vin > 2.0) {
        outputVoltage = vin - 2.0
      }
      nodePropertyUpdates[node.id].outputVoltage = outputVoltage
    }

    // C. Relay control coil detection — feeds solver's contact-state stamp next tick
    if (node.type === 'relay') {
      const coilVcc = getPinVoltage(node.id, 'in')
      const coilGnd = isPinGrounded(node.id, 'gnd')
      const relayActivated = coilVcc >= 2.0 && coilGnd
      const isStuck = activeFaults['relay-stuck']
      nodePropertyUpdates[node.id].state = (relayActivated && !isStuck) ? 'no' : 'nc'
    }

    // D. PC Fan RPM and rotation speed (inertia-smoothed target speed)
    if (node.type === 'pc-fan') {
      // FIX: use differential voltage (vcc − gnd) instead of absolute
      // voltage + isPinGrounded boolean.  The old code required the fan's
      // GND pin to sit on a solver-recognized 0V ground junction, which
      // fails when the only ground reference comes from a battery negative
      // that findGroundJunctions() skipped because an MCU's GND was found
      // first.  Differential voltage works regardless of ground topology
      // — exactly how dc-motor already handles it.
      const vccV = getPinVoltage(node.id, 'vcc')
      const gndV = getPinVoltage(node.id, 'gnd')
      const voltageDiff = vccV - gndV

      // A 4-wire PC fan's PWM pin has an internal pull-up (open-drain
      // logic). If nothing is wired to it, the real fan sees it as high and
      // spins at full speed — it does NOT read as 0V/stopped.
      const pwmWired = isPinConnected(node.id, 'pwm')
      const pwmV = pwmWired ? getPinVoltage(node.id, 'pwm') : 5.0

      let targetSpeed = 0
      const isStalled = activeFaults['fan-stall'] || activeFaults['fan-failure']
      if (voltageDiff >= 2.5 && !isStalled) {
        // ESP32 PWM pins output 3.3V logic high; scale duty appropriately
        const pwmRatio = pwmWired ? Math.min(1.0, pwmV / 3.3) : 1.0
        targetSpeed = pwmRatio * 3200
      }

      const currentSpeed = Number(node.properties.speed || 0)
      let nextSpeed = currentSpeed + (targetSpeed - currentSpeed) * 3.0 * deltaTimeSec
      if (Math.abs(nextSpeed - targetSpeed) < 2.0) nextSpeed = targetSpeed
      nodePropertyUpdates[node.id].speed = nextSpeed
      nodePropertyUpdates[node.id].rpm = Math.round(nextSpeed)
    }

    // E. DC Motor inertia speed and direction
    if (node.type === 'dc-motor') {
      const posV = getPinVoltage(node.id, 'pos')
      const negV = getPinVoltage(node.id, 'neg')
      const voltageDiff = posV - negV

      const isJammed = activeFaults['motor-jam'] || activeFaults['motor-failure']
      const targetSpeed = isJammed ? 0 : (voltageDiff / 12.0) * 5000
      const currentSpeed = Number(node.properties.speed || 0)
      let nextSpeed = currentSpeed + (targetSpeed - currentSpeed) * 1.5 * deltaTimeSec
      if (Math.abs(nextSpeed - targetSpeed) < 2.0) nextSpeed = targetSpeed

      nodePropertyUpdates[node.id].speed = nextSpeed
      nodePropertyUpdates[node.id].rpm = Math.round(Math.abs(nextSpeed))
      nodePropertyUpdates[node.id].direction =
        nextSpeed >= 0.1 ? 'forward' : nextSpeed <= -0.1 ? 'reverse' : 'idle'
    }

    // F. Battery drain via real coulomb counting — driven by actual solved current,
    // not a flat time-based constant. A battery under heavy load now drains
    // meaningfully faster than one idling with nothing connected.
    if (BATTERY_BASE_VOLTAGE[node.type] !== undefined) {
      const hasFailure = activeFaults['battery-failure'] || activeFaults['generator-fault']
      const baseVoltage = Number(node.properties.baseVoltage ?? BATTERY_BASE_VOLTAGE[node.type])
      const capacityMah = Number(node.properties.capacityMah ?? BATTERY_CAPACITY_MAH[node.type] ?? 1000)

      if (hasFailure) {
        nodePropertyUpdates[node.id].voltage = 0.1
      } else {
        const drawnCurrentA = getComponentCurrent(node.id)
        const prevDrainedMah = Number(node.properties.chargeDrainedMah ?? 0)
        const drainThisTickMah = drawnCurrentA * 1000 * (deltaTimeSec / 3600) // A -> mA, sec -> hr
        const nextDrainedMah = prevDrainedMah + drainThisTickMah

        const remainingFraction = Math.max(0, 1 - nextDrainedMah / capacityMah)
        // Mild sag curve: voltage holds near nominal until the pack is mostly
        // depleted, then falls off — closer to a real discharge curve than
        // a straight line, without needing a full electrochemical model.
        const sagFactor = remainingFraction > 0.15
          ? 1.0
          : Math.max(0.02, remainingFraction / 0.15)

        nodePropertyUpdates[node.id].chargeDrainedMah = nextDrainedMah
        nodePropertyUpdates[node.id].chargePercent = Math.round(remainingFraction * 100)
        nodePropertyUpdates[node.id].voltage = Math.max(0.1, baseVoltage * sagFactor)
      }
    }

    // F2. Supercapacitor discharge under load & terminal sag tracking
    if (node.type === 'super-capacitor') {
      const storedV = Number(node.properties.storedVoltage ?? 11.0)
      const capacitance = Math.max(0.1, Number(node.properties.capacitance ?? 1.0))
      const current = getComponentCurrent(node.id)

      // When supplying current (> 1mA), slowly discharge the stored capacitor voltage over time
      let newStoredV = storedV
      if (current > 0.001) {
        // dV/dt = -I / C (scaled for visible simulation pacing)
        newStoredV = Math.max(0.1, storedV - (current / capacitance) * deltaTimeSec * 0.05)
      }

      // Terminal voltage drops slightly under active load due to internal ESR
      const terminalV = Math.max(0.1, newStoredV - current * 0.1)
      nodePropertyUpdates[node.id].storedVoltage = newStoredV
      nodePropertyUpdates[node.id].voltage = terminalV
    }

    // G. LED brightness — driven by real solved current against a rated
    // forward current, so resistor value now visibly affects brightness
    // (a 220Ω vs 10kΩ series resistor will produce very different current
    // and therefore very different brightness, which voltage-only brightness
    // could never distinguish).
    if (node.type === 'led') {
      const isFailed = activeFaults['led-failure']
      const current = getComponentCurrent(node.id)
      nodePropertyUpdates[node.id].brightness = isFailed
        ? 0
        : Math.min(1.0, current / LED_RATED_CURRENT_A)
    }

    // H. RGB LED color mix — per-channel current-driven brightness
    if (node.type === 'rgb-led') {
      const isFailed = activeFaults['led-failure']

      const channelScale = (pin: string): number => {
        const chCurrent = Math.abs(solution.componentCurrents?.[`${node.id}:${pin}`] || 0.0)
        return Math.min(1.0, chCurrent / LED_RATED_CURRENT_A)
      }

      const rScale = isFailed ? 0 : channelScale('r')
      const gScale = isFailed ? 0 : channelScale('g')
      const bScale = isFailed ? 0 : channelScale('b')

      nodePropertyUpdates[node.id].colorMix = isFailed
        ? 'rgb(55, 65, 81)'
        : `rgb(${Math.round(rScale * 255)}, ${Math.round(gScale * 255)}, ${Math.round(bScale * 255)})`
    }

    // I. Bulb brightness — current-driven, same rationale as LED
    if (node.type === 'bulb') {
      const isBlown = activeFaults['bulb-blown'] || activeFaults['bulb-failure']
      const current = getComponentCurrent(node.id)
      nodePropertyUpdates[node.id].brightness = isBlown
        ? 0
        : Math.min(1.0, current / BULB_RATED_CURRENT_A)
    }

    // J. Fuse blowing — driven by real solved current against rated limit.
    // This is genuinely emergent: nothing manually flags the fuse, it blows
    // because computed current exceeded its rating.
    if (node.type === 'fuse') {
      const isBlown = activeFaults['fuse-blown'] || (node.properties.blown as boolean) || false
      if (!isBlown) {
        const current = getComponentCurrent(node.id)
        const limit = Number(node.properties.currentLimit ?? 1.0)
        if (current > limit) {
          nodePropertyUpdates[node.id].blown = true
        }
      }
    }

    // K. Capacitor transient voltage tracking — feeds the solver's companion
    // model (g * vPrev) so the capacitor actually charges/discharges over time
    // instead of behaving like a fixed voltage source.
    if (node.type === 'capacitor' || node.type === 'electrolytic-capacitor' || node.type === 'ceramic-capacitor') {
      const p1 = node.type === 'electrolytic-capacitor' ? 'pos' : 'a'
      const p2 = node.type === 'electrolytic-capacitor' ? 'neg' : 'b'
      const v1 = getPinVoltage(node.id, p1)
      const v2 = getPinVoltage(node.id, p2)
      nodePropertyUpdates[node.id].storedCapVoltage = v1 - v2
    }

    // L. Buzzer frequency and active state
    if (node.type === 'buzzer') {
      const posV = getPinVoltage(node.id, 'pos')
      const negV = getPinVoltage(node.id, 'neg')
      const voltageDiff = Math.abs(posV - negV)
      const current = getComponentCurrent(node.id)
      
      const isFailed = activeFaults['buzzer-failure']
      const isActive = voltageDiff >= 0.1 && current >= 0.00005 && !isFailed
      
      let freq = 2000 // default 2kHz active buzzer frequency
      
      if (isActive) {
        // Find if a microcontoller is outputting a tone on a connected pin
        // Let's look at the gpioPinStates to see if there's any active numeric frequency on any pin
        // connected to the same net as node.id:pos
        const startPin = `${node.id}:pos`
        const visited = new Set<string>()
        const queue = [startPin]
        let foundFreq: number | null = null

        while (queue.length > 0) {
          const currentPin = queue.shift()!
          if (visited.has(currentPin)) continue
          visited.add(currentPin)

          const [currNodeId, currPinId] = currentPin.split(':')
          const mcuPinState = gpioPinStates[currNodeId]?.[currPinId]
          if (typeof mcuPinState === 'number' && mcuPinState > 0) {
            foundFreq = mcuPinState
            break
          }

          // Trace wires to find other pins on the same electrical net
          edges.forEach((edge) => {
            const pA = `${edge.sourceNodeId}:${edge.sourcePinId}`
            const pB = `${edge.targetNodeId}:${edge.targetPinId}`
            if (pA === currentPin) queue.push(pB)
            if (pB === currentPin) queue.push(pA)
          })
        }

        if (foundFreq !== null) {
          freq = foundFreq
        }
      }

      nodePropertyUpdates[node.id].isActive = isActive
      nodePropertyUpdates[node.id].frequency = isActive ? freq : 0
    }
  })

  // 2. Wire current values (for wire highlighting / current-flow visualization)
  const edgePropertyUpdates: Record<string, Record<string, any>> = {}
  edges.forEach((edge) => {
    edgePropertyUpdates[edge.id] = {
      data: {
        ...edge.data,
        currentFlow: solution.edgeCurrents[edge.id] || 0.0,
      },
    }
  })

  return {
    nodes: nodePropertyUpdates,
    edges: edgePropertyUpdates,
    warnings: solution.warnings,
    shortCircuits: solution.shortCircuits,
  }
}