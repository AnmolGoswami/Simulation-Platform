import type { WorkspaceNode, WorkspaceEdge } from '../../../types'
import { buildNetlist } from '../netlist/buildNetlist'
import { solveLinearSystem } from './matrix'

export interface SolverSolution {
  nodeVoltages: Record<string, number>
  edgeCurrents: Record<string, number>
  componentCurrents: Record<string, number>
  shortCircuits: string[]
  warnings: { nodeId: string; msg: string }[]
  nodeGND: Record<string, boolean>
  pinToNetIdx: Record<string, number>
}

/**
 * Identifies all junctions that contain a ground pin.
 * Fallbacks to battery negatives if no explicit ground components are found.
 */
function findGroundJunctions(junctions: string[][], nodes: WorkspaceNode[]): Set<number> {
  const groundJuncs = new Set<number>()

  // 1. Explicit Ground components and board ground pins
  junctions.forEach((jGroup, idx) => {
    const hasGndPin = jGroup.some((pinKey) => {
      const [nodeId, pinId] = pinKey.split(':')
      const node = nodes.find((n) => n.id === nodeId)
      if (!node) return false

      if (node.type === 'ground' && pinId === 'gnd') return true
      if (node.type === 'arduino-uno' && (pinId === 'gnd' || pinId === 'gnd2')) return true
      if (node.type === 'esp32-devkit' && (pinId === 'gnd' || pinId === 'gnd2' || pinId === 'gnd3')) return true
      if (node.type === 'power-supply-5v' && pinId === 'gnd') return true
      if (node.type === 'usb-breakout' && pinId === 'gnd') return true
      if (node.type === 'dc-jack' && pinId === 'gnd') return true
      if (node.type === 'lm7805' && pinId === 'gnd') return true
      if (node.type === 'ups-module-5v' && (pinId === 'out_neg' || pinId === 'in_neg' || pinId === 'bat_neg')) return true
      return false
    })

    if (hasGndPin) {
      groundJuncs.add(idx)
    }
  })

  // FIX: do NOT return early here — always fall through to also include
  // battery negative terminals.  Previously, if an MCU's GND pin was found
  // in Step 1, this early return prevented Step 2 from running, so a
  // standalone battery→fan sub-circuit had no recognized ground junction and
  // the fan's GND pin was not marked as grounded by the solver.

  // 2. Battery negative terminals
  junctions.forEach((jGroup, idx) => {
    const hasBatNeg = jGroup.some((pinKey) => {
      const [nodeId, pinId] = pinKey.split(':')
      const node = nodes.find((n) => n.id === nodeId)
      if (!node) return false

      if ((node.type === 'battery-9v' || node.type === 'battery-snap-9v' || node.type === 'battery-12v' || node.type === 'battery-18650' || node.type === 'holder-18650' || node.type === 'super-capacitor') && pinId === 'neg') {
        return true
      }
      return false
    })

    if (hasBatNeg) {
      groundJuncs.add(idx)
    }
  })

  if (groundJuncs.size > 0) {
    return groundJuncs
  }

  // 3. Fallback to junction 0
  if (junctions.length > 0) {
    groundJuncs.add(0)
  }

  return groundJuncs
}

/**
 * Returns the maximum rated current for a power source to check for short circuits.
 */
function getSourceMaxCurrent(type: string): number {
  switch (type) {
    case 'battery-12v':
      return 5.0
    case 'battery-9v':
    case 'battery-snap-9v':
      return 3.0
    case 'battery-18650':
    case 'holder-18650':
      return 2.0
    case 'power-supply-5v':
    case 'usb-breakout':
    case 'dc-jack':
      return 3.0
    default:
      return 3.0
  }
}

/**
 * Solves the Complete Electrical Network using Nodal Analysis and a Conductance Matrix.
 */
export function solveCircuitNew(
  nodes: WorkspaceNode[],
  edges: WorkspaceEdge[],
  gpioPinStates: Record<string, Record<string, any>>,
  activeFaults: Record<string, boolean>,
  deltaTimeSec: number = 0.015
): SolverSolution {
  const netlist = buildNetlist(nodes, edges, activeFaults)
  const { junctions, pinToJunction, pinToNet } = netlist

  const J = junctions.length
  if (J === 0) {
    return {
      nodeVoltages: {},
      edgeCurrents: {},
      componentCurrents: {},
      shortCircuits: [],
      warnings: [],
      nodeGND: {},
      pinToNetIdx: {},
    }
  }

  const groundJunctions = findGroundJunctions(junctions, nodes)

  // Non-linear component states
  const ledStates: Record<string, boolean> = {} // node.id:pin -> isON
  const diodeStates: Record<string, boolean> = {} // node.id -> isON
  const mosfetStates: Record<string, boolean> = {} // node.id -> isON
  const regVoltages: Record<string, number> = {} // node.id -> outputVoltage

  let V: number[] = new Array<number>(J).fill(0)
  const maxIterations = 20

  // 1. Fixed-point iteration loop to resolve non-linear components
  for (let iter = 0; iter < maxIterations; iter++) {
    const G = Array.from({ length: J }, () => new Array<number>(J).fill(0))
    const I = new Array<number>(J).fill(0)

    // Add a tiny conductance to ground (gmin) for every node to guarantee invertibility
    for (let j = 0; j < J; j++) {
      G[j][j] += 1e-8
    }

    const stampConductance = (j1: number, j2: number, g: number) => {
      G[j1][j1] += g
      G[j2][j2] += g
      G[j1][j2] -= g
      G[j2][j1] -= g
    }

    const stampCurrentSource = (jFrom: number, jTo: number, is: number) => {
      I[jTo] += is
      I[jFrom] -= is
    }

    // A. Stamp Wires (Edges)
    edges.forEach((edge) => {
      const p1 = `${edge.sourceNodeId}:${edge.sourcePinId}`
      const p2 = `${edge.targetNodeId}:${edge.targetPinId}`
      const j1 = pinToJunction[p1]
      const j2 = pinToJunction[p2]
      if (j1 === undefined || j2 === undefined) return

      const isBroken = activeFaults[`wire-break-${edge.id}`]
      const rWire = isBroken ? 1e10 : 0.01
      stampConductance(j1, j2, 1 / rWire)
    })

    // B. Stamp Components
    nodes.forEach((node) => {
      // 1. Resistors
      if (node.type === 'resistor') {
        const j1 = pinToJunction[`${node.id}:a`]
        const j2 = pinToJunction[`${node.id}:b`]
        if (j1 === undefined || j2 === undefined) return
        const r = Math.max(0.1, Number(node.properties.resistance ?? 1000))
        stampConductance(j1, j2, 1 / r)
      }

      // 2. Switches
      else if (node.type.startsWith('toggle-switch') || node.type.startsWith('slide-switch')) {
        const state = node.properties.state
        const isSPST = node.type.endsWith('-spst')
        const isSPDT = node.type.endsWith('-spdt') || node.type === 'toggle-switch'
        const isDPDT = node.type.endsWith('-dpdt')

        if (isSPST) {
          const j1 = pinToJunction[`${node.id}:a`]
          const j2 = pinToJunction[`${node.id}:b`]
          if (j1 === undefined || j2 === undefined) return
          const isClosed = state === true || state === 'true'
          const r = isClosed ? 0.01 : 1e10
          stampConductance(j1, j2, 1 / r)
        } else if (isSPDT) {
          const jCom = pinToJunction[`${node.id}:com`]
          const jNo = pinToJunction[`${node.id}:no`]
          const jNc = pinToJunction[`${node.id}:nc`]
          if (jCom === undefined) return
          
          const isNc = state === 'nc'
          if (jNc !== undefined) stampConductance(jCom, jNc, 1 / (isNc ? 0.01 : 1e10))
          if (jNo !== undefined) stampConductance(jCom, jNo, 1 / (isNc ? 1e10 : 0.01))
        } else if (isDPDT) {
          const jCom1 = pinToJunction[`${node.id}:com1`]
          const jNo1 = pinToJunction[`${node.id}:no1`]
          const jNc1 = pinToJunction[`${node.id}:nc1`]
          const jCom2 = pinToJunction[`${node.id}:com2`]
          const jNo2 = pinToJunction[`${node.id}:no2`]
          const jNc2 = pinToJunction[`${node.id}:nc2`]

          const isNc = state === 'nc'
          if (jCom1 !== undefined) {
            if (jNc1 !== undefined) stampConductance(jCom1, jNc1, 1 / (isNc ? 0.01 : 1e10))
            if (jNo1 !== undefined) stampConductance(jCom1, jNo1, 1 / (isNc ? 1e10 : 0.01))
          }
          if (jCom2 !== undefined) {
            if (jNc2 !== undefined) stampConductance(jCom2, jNc2, 1 / (isNc ? 0.01 : 1e10))
            if (jNo2 !== undefined) stampConductance(jCom2, jNo2, 1 / (isNc ? 1e10 : 0.01))
          }
        }
      }

      else if (node.type.startsWith('dip-switch-')) {
        const dipState = (node.properties.state as Record<string, boolean>) || {}
        const positions = node.type.endsWith('-2') ? 2 : node.type.endsWith('-4') ? 4 : 8
        for (let i = 1; i <= positions; i++) {
          const jA = pinToJunction[`${node.id}:a${i}`]
          const jB = pinToJunction[`${node.id}:b${i}`]
          if (jA === undefined || jB === undefined) continue
          const isClosed = dipState[`s${i}`]
          stampConductance(jA, jB, 1 / (isClosed ? 0.01 : 1e10))
        }
      }

      // 3. Fuses
      else if (node.type === 'fuse') {
        const j1 = pinToJunction[`${node.id}:a`]
        const j2 = pinToJunction[`${node.id}:b`]
        if (j1 === undefined || j2 === undefined) return
        const isBlown = activeFaults['fuse-blown'] || node.properties.blown as boolean || false
        const r = isBlown ? 1e10 : 0.01
        stampConductance(j1, j2, 1 / r)
      }

      // 4. Relays (stamping switch contacts and coil)
      else if (node.type === 'relay') {
        // Coil resistance
        const jIn = pinToJunction[`${node.id}:in`]
        const jGnd = pinToJunction[`${node.id}:gnd`]
        if (jIn !== undefined && jGnd !== undefined) {
          stampConductance(jIn, jGnd, 1 / 100) // 100 Ohm coil resistance
        }

        // Switch Contacts
        const jCom = pinToJunction[`${node.id}:com`]
        const jNo = pinToJunction[`${node.id}:no`]
        const jNc = pinToJunction[`${node.id}:nc`]

        if (jCom !== undefined) {
          const state = node.properties.state
          const isStuck = activeFaults['relay-stuck']
          const actualState = (state === 'no' && !isStuck) ? 'no' : 'nc'
          const isNo = actualState === 'no'

          if (jNo !== undefined) stampConductance(jCom, jNo, 1 / (isNo ? 0.01 : 1e10))
          if (jNc !== undefined) stampConductance(jCom, jNc, 1 / (isNo ? 1e10 : 0.01))
        }
      }

      // 5. MOSFETs (Gate-Source high impedance, Drain-Source voltage-controlled switch)
      else if (node.type === 'n-mosfet' || node.type === 'p-mosfet') {
        const jGate = pinToJunction[`${node.id}:gate`]
        const jDrain = pinToJunction[`${node.id}:drain`]
        const jSource = pinToJunction[`${node.id}:source`]
        if (jGate === undefined || jDrain === undefined || jSource === undefined) return

        // Gate isolation
        stampConductance(jGate, jSource, 1e-10)

        // Drain-Source conduction path
        const isOn = mosfetStates[node.id] || false
        const rDS = isOn ? 0.05 : 1e10
        stampConductance(jDrain, jSource, 1 / rDS)
      }

      // 6. Diodes (rectifiers)
      else if (node.type === 'diode-1n4007' || node.type === 'schottky-diode') {
        const jAnode = pinToJunction[`${node.id}:anode`]
        const jCathode = pinToJunction[`${node.id}:cathode`]
        if (jAnode === undefined || jCathode === undefined) return

        const diodeKey = `${node.id}:anode-cathode`
        const isOn = diodeStates[diodeKey] || false
        const rForward = 1.0 // series resistance

        if (isOn) {
          const vDrop = node.type === 'schottky-diode' ? 0.3 : 0.7
          stampConductance(jAnode, jCathode, 1 / rForward)
          stampCurrentSource(jCathode, jAnode, vDrop / rForward) // Corrected: flow cathode to anode
        } else {
          stampConductance(jAnode, jCathode, 1e-10)
        }
      }

      // 7. Capacitors (Transient companion model)
      else if (node.type === 'capacitor' || node.type === 'electrolytic-capacitor' || node.type === 'ceramic-capacitor') {
        const p1 = node.type === 'electrolytic-capacitor' ? 'pos' : 'a'
        const p2 = node.type === 'electrolytic-capacitor' ? 'neg' : 'b'
        const jPos = pinToJunction[`${node.id}:${p1}`]
        const jNeg = pinToJunction[`${node.id}:${p2}`]
        if (jPos === undefined || jNeg === undefined) return

        const capValue = Math.max(0.1, Number(node.properties.capacitance ?? 100)) // in microfarads
        const C = capValue * 1e-6
        const g = C / Math.max(0.001, deltaTimeSec)

        // Read last tick's voltage across the capacitor
        const vPrev = Number(node.properties.storedCapVoltage ?? 0)

        // Companion model: parallel conductance and history current source
        stampConductance(jPos, jNeg, g)
        stampCurrentSource(jNeg, jPos, g * vPrev) // Corrected: flow neg to pos internally
      }

      // 8. Batteries & Power Sources
      else if (node.type === 'battery-9v' || node.type === 'battery-snap-9v' || node.type === 'battery-12v' || node.type === 'battery-18650' || node.type === 'holder-18650') {
        const jPos = pinToJunction[`${node.id}:pos`]
        const jNeg = pinToJunction[`${node.id}:neg`]
        if (jPos === undefined || jNeg === undefined) return

        let vSrc = 9.0
        if (node.type === 'battery-12v') vSrc = 12.0
        else if (node.type === 'battery-18650' || node.type === 'holder-18650') vSrc = 3.7
        
        vSrc = Number(node.properties.voltage ?? vSrc)
        if (activeFaults['battery-failure']) {
          vSrc = 0.1
        }

        const rInt = 0.1
        const g = 1 / rInt
        const iSrc = vSrc / rInt
        stampConductance(jPos, jNeg, g)
        stampCurrentSource(jNeg, jPos, iSrc)
      }

      else if (node.type === 'power-supply-5v' || node.type === 'usb-breakout' || node.type === 'dc-jack') {
        const jPos = pinToJunction[`${node.id}:vcc`]
        const jNeg = pinToJunction[`${node.id}:gnd`]
        if (jPos === undefined || jNeg === undefined) return

        let vSrc = node.type === 'dc-jack' ? Number(node.properties.voltage ?? 9.0) : 5.0
        const rInt = 0.05
        const g = 1 / rInt
        const iSrc = vSrc / rInt
        stampConductance(jPos, jNeg, g)
        stampCurrentSource(jNeg, jPos, iSrc)
      }

      // 9. UPS Backup Module
      else if (node.type === 'ups-module-5v') {
        const jPos = pinToJunction[`${node.id}:out_pos`]
        const jNeg = pinToJunction[`${node.id}:out_neg`]
        const jInPos = pinToJunction[`${node.id}:in_pos`]
        const jInNeg = pinToJunction[`${node.id}:in_neg`]

        if (jInPos !== undefined && jInNeg !== undefined) {
          stampConductance(jInPos, jInNeg, 1 / 10000)
        }

        if (jPos !== undefined && jNeg !== undefined) {
          const isFaulted = activeFaults['generator-fault']
          const vSrc = isFaulted ? 0.0 : 5.0
          const rInt = 0.05
          stampConductance(jPos, jNeg, 1 / rInt)
          stampCurrentSource(jNeg, jPos, vSrc / rInt)
        }
      }

      // 10. Super Capacitor
      else if (node.type === 'super-capacitor') {
        const jPos = pinToJunction[`${node.id}:pos`]
        const jNeg = pinToJunction[`${node.id}:neg`]
        if (jPos === undefined || jNeg === undefined) return
        
        const vCap = Number(node.properties.storedVoltage ?? 0)
        const rCap = 1.0
        stampConductance(jPos, jNeg, 1 / rCap)
        stampCurrentSource(jNeg, jPos, vCap / rCap)
      }

      // 11. LM7805 Voltage Regulator
      else if (node.type === 'lm7805') {
        const jIn = pinToJunction[`${node.id}:in`]
        const jGnd = pinToJunction[`${node.id}:gnd`]
        const jOut = pinToJunction[`${node.id}:out`]

        if (jIn !== undefined && jGnd !== undefined) {
          stampConductance(jIn, jGnd, 1 / 10000)
        }

        if (jOut !== undefined && jGnd !== undefined) {
          const vReg = regVoltages[node.id] || 0.0
          const rReg = 0.1
          stampConductance(jOut, jGnd, 1 / rReg)
          stampCurrentSource(jGnd, jOut, vReg / rReg)
        }
      }

      // 12. LEDs (ON/OFF with hysteresis)
      else if (node.type === 'led') {
        const jAnode = pinToJunction[`${node.id}:anode`]
        const jCathode = pinToJunction[`${node.id}:cathode`]
        if (jAnode === undefined || jCathode === undefined) return

        const ledKey = `${node.id}:anode-cathode`
        const isOn = ledStates[ledKey] || false
        if (isOn) {
          const vDrop = 1.8
          const rForward = 15.0
          stampConductance(jAnode, jCathode, 1 / rForward)
          stampCurrentSource(jCathode, jAnode, vDrop / rForward) // Corrected: flow cathode to anode
        } else {
          stampConductance(jAnode, jCathode, 1e-6)
        }
      }

      else if (node.type === 'rgb-led') {
        const jGnd = pinToJunction[`${node.id}:gnd`]
        if (jGnd === undefined) return

        const channels = ['r', 'g', 'b']
        channels.forEach((ch) => {
          const jAnode = pinToJunction[`${node.id}:${ch}`]
          if (jAnode === undefined) return

          const ledKey = `${node.id}:${ch}-gnd`
          const isOn = ledStates[ledKey] || false
          if (isOn) {
            const vDrop = 1.8
            const rForward = 15.0
            stampConductance(jAnode, jGnd, 1 / rForward)
            stampCurrentSource(jGnd, jAnode, vDrop / rForward) // Corrected
          } else {
            stampConductance(jAnode, jGnd, 1e-6)
          }
        })
      }

      // 13. Motors, Fans, Buzzers, Bulbs
      else if (node.type === 'dc-motor' || node.type === 'pc-fan' || node.type === 'buzzer' || node.type === 'bulb') {
        const p1 = node.type === 'pc-fan' ? 'vcc' : (node.type === 'bulb' ? 'pos' : 'pos')
        const p2 = node.type === 'pc-fan' ? 'gnd' : (node.type === 'bulb' ? 'neg' : 'neg')
        const j1 = pinToJunction[`${node.id}:${p1}`]
        const j2 = pinToJunction[`${node.id}:${p2}`]
        if (j1 === undefined || j2 === undefined) return

        let r = 25.0
        if (node.type === 'dc-motor') r = 10.0

        let isFailed = false
        if (node.type === 'dc-motor') isFailed = activeFaults['motor-failure'] || activeFaults['motor-jam']
        else if (node.type === 'pc-fan') isFailed = activeFaults['fan-failure'] || activeFaults['fan-stall']
        else if (node.type === 'bulb') isFailed = activeFaults['bulb-failure'] || activeFaults['bulb-blown']

        const currentR = isFailed ? 1e6 : r
        stampConductance(j1, j2, 1 / currentR)
      }

      // 14. Microcontrollers
      else if (node.type === 'arduino-uno' || node.type === 'esp32-devkit') {
        const boardId = node.id
        const isEsp32 = node.type === 'esp32-devkit'
        const vHigh = isEsp32 ? 3.3 : 5.0

        const jGnd1 = pinToJunction[`${boardId}:gnd`]
        const jGnd2 = pinToJunction[`${boardId}:gnd2`]
        const jGnd3 = pinToJunction[`${boardId}:gnd3`]
        
        if (jGnd1 !== undefined && jGnd2 !== undefined) {
          stampConductance(jGnd1, jGnd2, 1 / 0.001)
        }
        if (jGnd1 !== undefined && jGnd3 !== undefined) {
          stampConductance(jGnd1, jGnd3, 1 / 0.001)
        }

        const jGndRef = jGnd1 !== undefined ? jGnd1 : jGnd2

        const j5V = pinToJunction[`${boardId}:5v`] || pinToJunction[`${boardId}:vin_out`]
        const j3V3 = pinToJunction[`${boardId}:3v3`]

        if (jGndRef !== undefined) {
          if (j5V !== undefined) {
            stampConductance(j5V, jGndRef, 1 / 0.05)
            stampCurrentSource(jGndRef, j5V, 5.0 / 0.05)
          }
          if (j3V3 !== undefined) {
            stampConductance(j3V3, jGndRef, 1 / 0.05)
            stampCurrentSource(jGndRef, j3V3, 3.3 / 0.05)
          }
        }

        const mcuPins = gpioPinStates[boardId] || {}
        Object.entries(mcuPins).forEach(([pinId, pinVal]) => {
          const jPin = pinToJunction[`${boardId}:${pinId}`]
          if (jPin === undefined || jGndRef === undefined) return

          if (pinVal === 'OUTPUT' || pinVal === 'HIGH' || pinVal === 'LOW' || typeof pinVal === 'number') {
            let vTarget = 0.0
            if (pinVal === 'HIGH' || pinVal === 1) {
              vTarget = vHigh
            } else if (pinVal === 'LOW' || pinVal === 0) {
              vTarget = 0.0
            } else if (typeof pinVal === 'number') {
              vTarget = (pinVal / 255) * vHigh
            }

            const rOut = 30.0
            stampConductance(jPin, jGndRef, 1 / rOut)
            stampCurrentSource(jGndRef, jPin, vTarget / rOut)
          } 
          
          else if (pinVal === 'INPUT_PULLUP') {
            const jVcc = isEsp32 ? j3V3 : j5V
            if (jVcc !== undefined) {
              stampConductance(jPin, jVcc, 1 / 40000)
            }
          }
        })
      }

      // 15. Potentiometers
      else if (node.type === 'potentiometer') {
        const jGnd = pinToJunction[`${node.id}:gnd`]
        const jSig = pinToJunction[`${node.id}:sig`]
        const jVcc = pinToJunction[`${node.id}:vcc`]
        if (jGnd === undefined || jSig === undefined || jVcc === undefined) return

        const rTotal = Math.max(10, Number(node.properties.resistance ?? 10000))
        const rWiper = Math.max(0.1, Math.min(rTotal - 0.1, Number(node.properties.wiperResistance ?? 500)))

        stampConductance(jSig, jGnd, 1 / rWiper)
        stampConductance(jVcc, jSig, 1 / (rTotal - rWiper))
      }

      // 16. Sensors
      else if (node.type === 'lm35' || node.type === 'dht22' || node.type === 'ds18b20') {
        const jVcc = pinToJunction[`${node.id}:vcc`]
        const jGnd = pinToJunction[`${node.id}:gnd`]
        if (jVcc !== undefined && jGnd !== undefined) {
          stampConductance(jVcc, jGnd, 1 / 10000)
        }
        if (node.type === 'lm35' && jGnd !== undefined) {
          const jOut = pinToJunction[`${node.id}:out`]
          if (jOut !== undefined) {
            const temp = Number(node.properties.temperature ?? 25)
            // LM35 outputs 10 mV/°C (0.01 V/°C). Output resistance approx 1 ohm.
            const vOut = temp * 0.01
            stampConductance(jOut, jGnd, 1 / 1.0)
            stampCurrentSource(jGnd, jOut, vOut / 1.0)
          }
        }
      }
    })

    // C. Force Ground Junctions to 0V
    groundJunctions.forEach((jIdx) => {
      G[jIdx].fill(0)
      G[jIdx][jIdx] = 1.0
      I[jIdx] = 0.0
    })

    // D. Solve G * V = I
    const sol = solveLinearSystem(G, I)
    if (!sol) {
      break
    }
    V = sol

    // E. Update Non-linear Convergence States (with Hysteresis)
    let stateChanged = false

    nodes.forEach((node) => {
      // LEDs update
      if (node.type === 'led') {
        const ledKey = `${node.id}:anode-cathode`
        const jAnode = pinToJunction[`${node.id}:anode`]
        const jCathode = pinToJunction[`${node.id}:cathode`]
        if (jAnode === undefined || jCathode === undefined) return

        const wasOn = ledStates[ledKey] || false
        const vAnode = V[jAnode]
        const vCathode = V[jCathode]
        const vDrop = vAnode - vCathode
        
        const isFailed = activeFaults['led-failure']
        const threshold = wasOn ? 1.5 : 1.8 // Hysteresis!
        const shouldBeOn = !isFailed && vDrop >= threshold
        
        if (ledStates[ledKey] !== shouldBeOn) {
          ledStates[ledKey] = shouldBeOn
          stateChanged = true
        }
      }

      else if (node.type === 'rgb-led') {
        const jGnd = pinToJunction[`${node.id}:gnd`]
        if (jGnd === undefined) return

        const channels = ['r', 'g', 'b']
        channels.forEach((ch) => {
          const jAnode = pinToJunction[`${node.id}:${ch}`]
          if (jAnode === undefined) return

          const ledKey = `${node.id}:${ch}-gnd`
          const wasOn = ledStates[ledKey] || false
          const vAnode = V[jAnode]
          const vCathode = V[jGnd]
          const vDrop = vAnode - vCathode

          const isFailed = activeFaults['led-failure']
          const threshold = wasOn ? 1.5 : 1.8 // Hysteresis!
          const shouldBeOn = !isFailed && vDrop >= threshold
          
          if (ledStates[ledKey] !== shouldBeOn) {
            ledStates[ledKey] = shouldBeOn
            stateChanged = true
          }
        })
      }

      // Diodes update
      else if (node.type === 'diode-1n4007' || node.type === 'schottky-diode') {
        const jAnode = pinToJunction[`${node.id}:anode`]
        const jCathode = pinToJunction[`${node.id}:cathode`]
        if (jAnode === undefined || jCathode === undefined) return

        const diodeKey = `${node.id}:anode-cathode`
        const wasOn = diodeStates[diodeKey] || false
        const vAnode = V[jAnode]
        const vCathode = V[jCathode]
        const vDrop = vAnode - vCathode

        const threshold = node.type === 'schottky-diode'
          ? (wasOn ? 0.15 : 0.3)  // Schottky: ON at 0.3V, OFF at 0.15V
          : (wasOn ? 0.55 : 0.7)  // Rectifier: ON at 0.7V, OFF at 0.55V

        const shouldBeOn = vDrop >= threshold
        if (diodeStates[diodeKey] !== shouldBeOn) {
          diodeStates[diodeKey] = shouldBeOn
          stateChanged = true
        }
      }

      // MOSFETs update
      else if (node.type === 'n-mosfet' || node.type === 'p-mosfet') {
        const jGate = pinToJunction[`${node.id}:gate`]
        const jSource = pinToJunction[`${node.id}:source`]
        if (jGate === undefined || jSource === undefined) return

        const vGate = V[jGate]
        const vSource = V[jSource]
        const vgs = vGate - vSource

        const wasOn = mosfetStates[node.id] || false
        let shouldBeOn = false

        if (node.type === 'n-mosfet') {
          const threshold = wasOn ? 1.7 : 2.0
          shouldBeOn = vgs >= threshold
        } else {
          // p-mosfet
          const threshold = wasOn ? -1.7 : -2.0
          shouldBeOn = vgs <= threshold
        }

        if (mosfetStates[node.id] !== shouldBeOn) {
          mosfetStates[node.id] = shouldBeOn
          stateChanged = true
        }
      }

      // Regulators update
      else if (node.type === 'lm7805') {
        const jIn = pinToJunction[`${node.id}:in`]
        const jGnd = pinToJunction[`${node.id}:gnd`]
        if (jIn === undefined || jGnd === undefined) return

        const vIn = V[jIn]
        const vGnd = V[jGnd]
        const vinDiff = vIn - vGnd

        let targetReg = 0.0
        if (vinDiff >= 7.0) targetReg = 5.0
        else if (vinDiff > 2.0) targetReg = vinDiff - 2.0

        if (Math.abs((regVoltages[node.id] || 0) - targetReg) > 0.01) {
          regVoltages[node.id] = targetReg
          stateChanged = true
        }
      }
    })

    if (!stateChanged) {
      break
    }
  }

  // 2. Compute Outputs: Node Voltages
  const nodeVoltages: Record<string, number> = {}
  const nodeGND: Record<string, boolean> = {}

  Object.entries(pinToJunction).forEach(([pinKey, jIdx]) => {
    nodeVoltages[pinKey] = V[jIdx] || 0.0
    nodeGND[pinKey] = groundJunctions.has(jIdx)
  })

  // 3. Compute Element Currents (Branch Currents)
  const edgeCurrents: Record<string, number> = {}
  const componentCurrents: Record<string, number> = {}
  const warnings: { nodeId: string; msg: string }[] = []
  const shortCircuits: string[] = []

  // A. Wires Branch Currents
  edges.forEach((edge) => {
    const p1 = `${edge.sourceNodeId}:${edge.sourcePinId}`
    const p2 = `${edge.targetNodeId}:${edge.targetPinId}`
    const j1 = pinToJunction[p1]
    const j2 = pinToJunction[p2]
    if (j1 === undefined || j2 === undefined) return

    const v1 = V[j1] || 0.0
    const v2 = V[j2] || 0.0
    const isBroken = activeFaults[`wire-break-${edge.id}`]
    const rWire = isBroken ? 1e6 : 0.01
    
    edgeCurrents[edge.id] = (v1 - v2) / rWire
  })

  // B. Component Branch Currents & Warnings
  nodes.forEach((node) => {
    let current = 0.0

    if (node.type === 'resistor') {
      const jA = pinToJunction[`${node.id}:a`]
      const jB = pinToJunction[`${node.id}:b`]
      if (jA !== undefined && jB !== undefined) {
        const r = Math.max(0.1, Number(node.properties.resistance ?? 1000))
        current = Math.abs(V[jA] - V[jB]) / r
      }
    }

    else if (node.type === 'fuse') {
      const jA = pinToJunction[`${node.id}:a`]
      const jB = pinToJunction[`${node.id}:b`]
      if (jA !== undefined && jB !== undefined) {
        const isBlown = activeFaults['fuse-blown'] || node.properties.blown as boolean || false
        const r = isBlown ? 1e6 : 0.01
        current = Math.abs(V[jA] - V[jB]) / r
      }
    }

    else if (node.type === 'relay') {
      // Current flowing through the switches and coil
      const jIn = pinToJunction[`${node.id}:in`]
      const jGnd = pinToJunction[`${node.id}:gnd`]
      let coilCurrent = 0.0
      if (jIn !== undefined && jGnd !== undefined) {
        coilCurrent = Math.abs(V[jIn] - V[jGnd]) / 100
      }

      const jCom = pinToJunction[`${node.id}:com`]
      const jNo = pinToJunction[`${node.id}:no`]
      const jNc = pinToJunction[`${node.id}:nc`]
      let contactCurrent = 0.0

      if (jCom !== undefined) {
        const state = node.properties.state
        const isStuck = activeFaults['relay-stuck']
        const actualState = (state === 'no' && !isStuck) ? 'no' : 'nc'
        const isNo = actualState === 'no'

        if (isNo && jNo !== undefined) {
          contactCurrent = Math.abs(V[jCom] - V[jNo]) / 0.01
        } else if (!isNo && jNc !== undefined) {
          contactCurrent = Math.abs(V[jCom] - V[jNc]) / 0.01
        }
      }
      current = coilCurrent + contactCurrent
    }

    else if (node.type === 'n-mosfet' || node.type === 'p-mosfet') {
      const jDrain = pinToJunction[`${node.id}:drain`]
      const jSource = pinToJunction[`${node.id}:source`]
      if (jDrain !== undefined && jSource !== undefined) {
        const isOn = mosfetStates[node.id] || false
        const rDS = isOn ? 0.05 : 1e6
        current = Math.abs(V[jDrain] - V[jSource]) / rDS
      }
    }

    else if (node.type === 'diode-1n4007' || node.type === 'schottky-diode') {
      const jAnode = pinToJunction[`${node.id}:anode`]
      const jCathode = pinToJunction[`${node.id}:cathode`]
      if (jAnode !== undefined && jCathode !== undefined) {
        const diodeKey = `${node.id}:anode-cathode`
        const isOn = diodeStates[diodeKey] || false
        if (isOn) {
          const vDrop = node.type === 'schottky-diode' ? 0.3 : 0.7
          current = Math.max(0.0, (V[jAnode] - V[jCathode] - vDrop) / 1.0)
        }
      }
    }

    else if (node.type === 'capacitor' || node.type === 'electrolytic-capacitor' || node.type === 'ceramic-capacitor') {
      const p1 = node.type === 'electrolytic-capacitor' ? 'pos' : 'a'
      const p2 = node.type === 'electrolytic-capacitor' ? 'neg' : 'b'
      const jPos = pinToJunction[`${node.id}:${p1}`]
      const jNeg = pinToJunction[`${node.id}:${p2}`]
      if (jPos !== undefined && jNeg !== undefined) {
        const capValue = Math.max(0.1, Number(node.properties.capacitance ?? 100))
        const C = capValue * 1e-6
        const g = C / Math.max(0.001, deltaTimeSec)
        const vPrev = Number(node.properties.storedCapVoltage ?? 0)
        current = g * ((V[jPos] - V[jNeg]) - vPrev)
      }
    }

    else if (node.type === 'super-capacitor') {
      const jPos = pinToJunction[`${node.id}:pos`]
      const jNeg = pinToJunction[`${node.id}:neg`]
      if (jPos !== undefined && jNeg !== undefined) {
        const vCap = Number(node.properties.storedVoltage ?? 0)
        const rCap = 1.0
        current = ((V[jPos] - V[jNeg]) - vCap) / rCap
      }
    }

    else if (node.type === 'led') {
      const jAnode = pinToJunction[`${node.id}:anode`]
      const jCathode = pinToJunction[`${node.id}:cathode`]
      if (jAnode !== undefined && jCathode !== undefined) {
        const ledKey = `${node.id}:anode-cathode`
        const isOn = ledStates[ledKey] || false
        if (isOn) {
          current = Math.max(0.0, (V[jAnode] - V[jCathode] - 1.8) / 15.0)
          
          if (current >= 0.04) {
            warnings.push({
              nodeId: node.id,
              msg: `Overcurrent Warning: LED is missing a current-limiting resistor! Current is ${Math.round(current * 1000)}mA.`,
            })
          }
        }
      }
    }

    else if (node.type === 'rgb-led') {
      const jGnd = pinToJunction[`${node.id}:gnd`]
      if (jGnd !== undefined) {
        const channels = ['r', 'g', 'b']
        channels.forEach((ch) => {
          const jAnode = pinToJunction[`${node.id}:${ch}`]
          if (jAnode === undefined) return
          const ledKey = `${node.id}:${ch}-gnd`
          let chCurrent = 0.0
          if (ledStates[ledKey]) {
            chCurrent = Math.max(0.0, (V[jAnode] - V[jGnd] - 1.8) / 15.0)
            current += chCurrent
            if (chCurrent >= 0.04) {
              warnings.push({
                nodeId: node.id,
                msg: `Overcurrent Warning: RGB LED (${ch.toUpperCase()}) has excessive current: ${Math.round(chCurrent * 1000)}mA.`,
              })
            }
          }
          componentCurrents[`${node.id}:${ch}`] = chCurrent
        })
      }
    }

    else if (node.type === 'dc-motor' || node.type === 'pc-fan' || node.type === 'buzzer' || node.type === 'bulb') {
      const p1 = node.type === 'pc-fan' ? 'vcc' : (node.type === 'bulb' ? 'pos' : 'pos')
      const p2 = node.type === 'pc-fan' ? 'gnd' : (node.type === 'bulb' ? 'neg' : 'neg')
      const j1 = pinToJunction[`${node.id}:${p1}`]
      const j2 = pinToJunction[`${node.id}:${p2}`]
      if (j1 !== undefined && j2 !== undefined) {
        let r = 25.0
        if (node.type === 'dc-motor') r = 10.0

        let isFailed = false
        if (node.type === 'dc-motor') isFailed = activeFaults['motor-failure'] || activeFaults['motor-jam']
        else if (node.type === 'pc-fan') isFailed = activeFaults['fan-failure'] || activeFaults['fan-stall']
        else if (node.type === 'bulb') isFailed = activeFaults['bulb-failure'] || activeFaults['bulb-blown']

        current = Math.abs(V[j1] - V[j2]) / (isFailed ? 1e6 : r)
      }
    }

    else if (node.type === 'battery-9v' || node.type === 'battery-snap-9v' || node.type === 'battery-12v' || node.type === 'battery-18650' || node.type === 'holder-18650') {
      const jPos = pinToJunction[`${node.id}:pos`]
      const jNeg = pinToJunction[`${node.id}:neg`]
      if (jPos !== undefined && jNeg !== undefined) {
        let vSrc = node.type === 'battery-12v' ? 12.0 : (node.type === 'battery-18650' || node.type === 'holder-18650' ? 3.7 : 9.0)
        vSrc = Number(node.properties.voltage ?? vSrc)
        if (activeFaults['battery-failure']) vSrc = 0.1
        
        current = (vSrc - (V[jPos] - V[jNeg])) / 0.1
        
        if (current > getSourceMaxCurrent(node.type)) {
          const netIdx = pinToNet[`${node.id}:pos`]
          if (netIdx !== undefined) {
            shortCircuits.push(`net-${netIdx}`)
          }
        }
      }
    }

    else if (node.type === 'power-supply-5v' || node.type === 'usb-breakout' || node.type === 'dc-jack') {
      const jPos = pinToJunction[`${node.id}:vcc`]
      const jNeg = pinToJunction[`${node.id}:gnd`]
      if (jPos !== undefined && jNeg !== undefined) {
        let vSrc = node.type === 'dc-jack' ? Number(node.properties.voltage ?? 9.0) : 5.0
        current = (vSrc - (V[jPos] - V[jNeg])) / 0.05
        
        if (current > getSourceMaxCurrent(node.type)) {
          const netIdx = pinToNet[`${node.id}:vcc`]
          if (netIdx !== undefined) {
            shortCircuits.push(`net-${netIdx}`)
          }
        }
      }
    }

    else if (node.type === 'lm7805') {
      const jOut = pinToJunction[`${node.id}:out`]
      const jGnd = pinToJunction[`${node.id}:gnd`]
      if (jOut !== undefined && jGnd !== undefined) {
        const vReg = regVoltages[node.id] || 0.0
        current = (vReg - (V[jOut] - V[jGnd])) / 0.1
      }
    }

    componentCurrents[node.id] = current
  })

  return {
    nodeVoltages,
    edgeCurrents,
    componentCurrents,
    shortCircuits: Array.from(new Set(shortCircuits)),
    warnings,
    nodeGND,
    pinToNetIdx: pinToNet,
  }
}
