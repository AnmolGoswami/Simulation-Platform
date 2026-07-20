import type { WorkspaceNode, WorkspaceEdge, ValidationError, CircuitValidationResults } from '@/types'
import { getComponentDefinition } from './componentDefinitions'
import { buildNetlist } from './simulation/netlist/buildNetlist'


export function runElectricalValidation(
  nodes: WorkspaceNode[],
  edges: WorkspaceEdge[]
): CircuitValidationResults {
  const errors: ValidationError[] = []
  const warnings: ValidationError[] = []
  const connectedComponentsSet = new Set<string>()
  const powerSourcesSet = new Set<string>()

  // 1. Build Adjacency List for Equipotential Nets using the shared Netlist Builder
  const netlist = buildNetlist(nodes, edges)
  const nets = netlist.nets
  const pinToNetIdx = new Map<string, number>(Object.entries(netlist.pinToNet))

  // Populate connectedComponentsSet
  edges.forEach((edge) => {
    connectedComponentsSet.add(edge.sourceNodeId)
    connectedComponentsSet.add(edge.targetNodeId)
  })

  // 3. Define Voltages and Polarity Solver
  // Map of net index -> voltage
  const netVoltages = new Map<number, number>()
  const netHasGnd = new Map<number, boolean>()

  // Helper: Find voltage source definitions
  const getVoltageSource = (nodeId: string, pinId: string): { voltage: number; isGnd: boolean } | null => {
    const node = nodes.find((n) => n.id === nodeId)
    if (!node) return null

    // Direct ground components
    if (node.type === 'ground' && pinId === 'gnd') return { voltage: 0, isGnd: true }

    // Batteries
    if (node.type === 'battery-9v') {
      if (pinId === 'pos') return { voltage: 9.0, isGnd: false }
      if (pinId === 'neg') return { voltage: 0.0, isGnd: true }
    }
    if (node.type === 'battery-12v') {
      if (pinId === 'pos') return { voltage: 12.0, isGnd: false }
      if (pinId === 'neg') return { voltage: 0.0, isGnd: true }
    }
    if (node.type === 'battery-18650') {
      if (pinId === 'pos') return { voltage: 3.7, isGnd: false }
      if (pinId === 'neg') return { voltage: 0.0, isGnd: true }
    }
    if (node.type === 'holder-18650') {
      if (pinId === 'pos') return { voltage: 3.7, isGnd: false }
      if (pinId === 'neg') return { voltage: 0.0, isGnd: true }
    }
    if (node.type === 'power-supply-5v') {
      if (pinId === 'vcc') return { voltage: 5.0, isGnd: false }
      if (pinId === 'gnd') return { voltage: 0.0, isGnd: true }
    }
    if (node.type === 'usb-breakout') {
      if (pinId === 'vcc') return { voltage: 5.0, isGnd: false }
      if (pinId === 'gnd') return { voltage: 0.0, isGnd: true }
    }
    if (node.type === 'dc-jack') {
      const vol = (node.properties.voltage as number) || 9.0
      if (pinId === 'vcc') return { voltage: vol, isGnd: false }
      if (pinId === 'gnd') return { voltage: 0.0, isGnd: true }
    }
    if (node.type === 'battery-snap-9v') {
      if (pinId === 'pos') return { voltage: 9.0, isGnd: false }
      if (pinId === 'neg') return { voltage: 0.0, isGnd: true }
    }

    // Microcontrollers
    if (node.type === 'arduino-uno') {
      if (pinId === '5v') return { voltage: 5.0, isGnd: false }
      if (pinId === '3v3') return { voltage: 3.3, isGnd: false }
      if (pinId === 'gnd' || pinId === 'gnd2') return { voltage: 0.0, isGnd: true }
    }
    if (node.type === 'esp32-devkit') {
      if (pinId === 'vin_out') return { voltage: 5.0, isGnd: false }
      if (pinId === '3v3') return { voltage: 3.3, isGnd: false }
      if (pinId === 'gnd' || pinId === 'gnd2' || pinId === 'gnd3') return { voltage: 0.0, isGnd: true }
    }

    // UPS module
    if (node.type === 'ups-module-5v') {
      if (pinId === 'out_pos') return { voltage: 5.0, isGnd: false }
      if (pinId === 'out_neg') return { voltage: 0.0, isGnd: true }
      if (pinId === 'bat_pos') return { voltage: 3.7, isGnd: false }
      if (pinId === 'bat_neg') return { voltage: 0.0, isGnd: true }
    }

    return null
  }

  // Pre-seed voltage rails from sources
  nets.forEach((net, netIdx) => {
    net.forEach((pinKey) => {
      const [nodeId, pinId] = pinKey.split(':')
      const source = getVoltageSource(nodeId, pinId)
      if (source) {
        if (source.isGnd) {
          netHasGnd.set(netIdx, true)
          netVoltages.set(netIdx, 0.0)
        } else {
          // If already set, find conflict or keep higher?
          const currentVal = netVoltages.get(netIdx)
          if (currentVal !== undefined && currentVal !== source.voltage) {
            errors.push({
              id: `voltage-conflict-${netIdx}`,
              componentId: nodeId,
              pinId,
              message: `Voltage Conflict: multiple mismatching power supplies connected together (${currentVal}V and ${source.voltage}V)`,
              type: 'error',
            })
          }
          netVoltages.set(netIdx, source.voltage)
          powerSourcesSet.add(nodeId)
        }
      }
    })
  })

  // Propagate through passive / active components recursively
  let changed = true
  let iterations = 0
  const maxIterations = 5

  while (changed && iterations < maxIterations) {
    changed = false
    iterations++

    nodes.forEach((node) => {
      // LM7805 voltage regulator propagation
      if (node.type === 'lm7805') {
        const inNet = pinToNetIdx.get(`${node.id}:in`)
        const gndNet = pinToNetIdx.get(`${node.id}:gnd`)
        const outNet = pinToNetIdx.get(`${node.id}:out`)

        if (inNet !== undefined && gndNet !== undefined && outNet !== undefined) {
          const inVolt = netVoltages.get(inNet)
          const hasGnd = netHasGnd.get(gndNet)

          if (inVolt !== undefined && inVolt >= 7.0 && hasGnd) {
            if (netVoltages.get(outNet) !== 5.0) {
              netVoltages.set(outNet, 5.0)
              changed = true
            }
          }
        }
      }

      // Diodes propagation (1N4007, Schottky)
      if (node.type === 'diode-1n4007' || node.type === 'schottky-diode') {
        const drop = node.type === 'schottky-diode' ? 0.3 : 0.7
        const anodeNet = pinToNetIdx.get(`${node.id}:anode`)
        const cathodeNet = pinToNetIdx.get(`${node.id}:cathode`)

        if (anodeNet !== undefined && cathodeNet !== undefined) {
          const anodeVolt = netVoltages.get(anodeNet)
          const cathodeVolt = netVoltages.get(cathodeNet)

          if (anodeVolt !== undefined && cathodeVolt === undefined) {
            const propagated = Math.max(0, anodeVolt - drop)
            netVoltages.set(cathodeNet, propagated)
            changed = true
          }
        }
      }

      // UPS Module propagation: VIN+ / VIN- to OUT+ / OUT-
      if (node.type === 'ups-module-5v') {
        const vinPosNet = pinToNetIdx.get(`${node.id}:vin_pos`)
        const vinNegNet = pinToNetIdx.get(`${node.id}:vin_neg`)
        const outPosNet = pinToNetIdx.get(`${node.id}:out_pos`)
        const outNegNet = pinToNetIdx.get(`${node.id}:out_neg`)

        if (vinPosNet !== undefined && vinNegNet !== undefined && outPosNet !== undefined && outNegNet !== undefined) {
          const vinPosVolt = netVoltages.get(vinPosNet)
          const vinNegGnd = netHasGnd.get(vinNegNet)

          if (vinPosVolt !== undefined && vinPosVolt >= 4.5 && vinNegGnd) {
            if (netVoltages.get(outPosNet) !== 5.0) {
              netVoltages.set(outPosNet, 5.0)
              netHasGnd.set(outNegNet, true)
              netVoltages.set(outNegNet, 0.0)
              changed = true
            }
          }
        }
      }
    })
  }

  // 4. Validate Rules

  // Rule A: Short Circuits (GND connected directly to VCC)
  nets.forEach((net, netIdx) => {
    const hasGnd = netHasGnd.get(netIdx)
    const volt = netVoltages.get(netIdx)
    if (hasGnd && volt !== undefined && volt > 0.1) {
      // Find the VCC pin in this net
      const vccPin = net.find((p) => {
        const [nodeId, pinId] = p.split(':')
        const def = getComponentDefinition(nodes.find(n => n.id === nodeId)?.type || '')
        const pDef = def?.pins.find(pin => pin.id === pinId)
        return pDef?.type === 'power'
      })

      errors.push({
        id: `short-circuit-${netIdx}`,
        componentId: vccPin ? vccPin.split(':')[0] : undefined,
        pinId: vccPin ? vccPin.split(':')[1] : undefined,
        message: `❌ Short Circuit Detected: Power rail (${volt}V) is shorted directly to Ground.`,
        type: 'error',
      })
    }
  })

  // Validate other node components
  nodes.forEach((node) => {
    const def = getComponentDefinition(node.type)
    if (!def) return

    // Rule B: Overvoltage (Wrong voltage connected to GPIO/Sensor pins)
    def.pins.forEach((pin) => {
      const pinKey = `${node.id}:${pin.id}`
      const netIdx = pinToNetIdx.get(pinKey)
      if (netIdx === undefined) return

      const volt = netVoltages.get(netIdx)
      if (volt !== undefined && pin.voltageLimit !== undefined && volt > pin.voltageLimit + 0.1) {
        errors.push({
          id: `overvoltage-${node.id}-${pin.id}`,
          componentId: node.id,
          pinId: pin.id,
          message: `❌ Overvoltage Warning on ${node.properties.name} (${pin.label}): Voltage is ${volt.toFixed(1)}V, exceeding limit of ${pin.voltageLimit}V!`,
          type: 'error',
        })
      }
    })

    // Rule C: LED missing resistor
    if (node.type === 'led' || node.type === 'rgb-led') {
      const pinsToCheck = node.type === 'led' 
        ? [{ anode: 'anode', cathode: 'cathode' }]
        : [
            { anode: 'r', cathode: 'gnd' },
            { anode: 'g', cathode: 'gnd' },
            { anode: 'b', cathode: 'gnd' }
          ]

      pinsToCheck.forEach(({ anode, cathode }) => {
        const aNet = pinToNetIdx.get(`${node.id}:${anode}`)
        const cNet = pinToNetIdx.get(`${node.id}:${cathode}`)

        if (aNet !== undefined && cNet !== undefined) {
          const aVolt = netVoltages.get(aNet)
          const cHasGnd = netHasGnd.get(cNet)

          // If LED is forward biased with significant voltage and directly shorted to VCC & GND
          if (aVolt !== undefined && aVolt >= 2.0 && cHasGnd) {
            // Find if there is a resistor along the path from anode to power source,
            // or from cathode to GND.
            // Simplified check: Are there other components in the anode net?
            // If the anode net is directly connected to a low-impedance power source pin,
            // and cathode net is directly connected to a ground source pin, it's missing a resistor.
            let isAnodeDirectSource = false
            let isCathodeDirectGnd = false

            nets[aNet].forEach((p) => {
              const [nid, pid] = p.split(':')
              if (nid === node.id) return // skip itself
              const source = getVoltageSource(nid, pid)
              if (source && !source.isGnd) isAnodeDirectSource = true
            })

            nets[cNet].forEach((p) => {
              const [nid, pid] = p.split(':')
              if (nid === node.id) return
              const source = getVoltageSource(nid, pid)
              if (source && source.isGnd) isCathodeDirectGnd = true
            })

            if (isAnodeDirectSource && isCathodeDirectGnd) {
              warnings.push({
                id: `led-missing-resistor-${node.id}-${anode}`,
                componentId: node.id,
                pinId: anode,
                message: `⚠ LED (${anode.toUpperCase()}) is connected directly to power (${aVolt.toFixed(1)}V) without a current-limiting resistor. It will burn out!`,
                type: 'warning',
              })
            }
          }
        }
      })
    }

    // Rule D: Missing ground check for active microcontrollers or displays
    if (node.type === 'arduino-uno' || node.type === 'esp32-devkit' || node.type === 'lcd1602' || node.type === 'oled' || node.type === 'relay') {
      const gndPins = def.pins.filter((p) => p.type === 'ground')
      const gndNets = gndPins.map((p) => pinToNetIdx.get(`${node.id}:${p.id}`)).filter((idx) => idx !== undefined) as number[]
      
      const hasGroundConnection = gndNets.some((netIdx) => netHasGnd.get(netIdx))
      if (!hasGroundConnection && gndPins.length > 0) {
        warnings.push({
          id: `missing-gnd-${node.id}`,
          componentId: node.id,
          message: `⚠ Missing Ground: ${node.properties.name} is not connected to Ground (GND).`,
          type: 'warning',
        })
      }
    }

    // Rule E: Output-to-Output conflicts
    // We already do a simple check for different voltage sources connected directly.
    // If two GPIO pins set to outputs (or power supply outputs) are connected directly, it causes damage.

    // Rule F: OneWire requirements (DS18B20 requires pull-up)
    if (node.type === 'ds18b20') {
      const dataNet = pinToNetIdx.get(`${node.id}:data`)
      if (dataNet !== undefined) {
        // DS18B20 requires a pull-up resistor (4.7k) to VCC
        // Check if dataNet has a resistor connected, and if the other side of that resistor connects to a VCC net.
        let hasPullUp = false
        const dataNetPins = nets[dataNet]

        dataNetPins.forEach((p) => {
          const [nid, pid] = p.split(':')
          const partnerNode = nodes.find(n => n.id === nid)
          if (partnerNode && partnerNode.type === 'resistor') {
            const otherPin = pid === 'a' ? 'b' : 'a'
            const otherNet = pinToNetIdx.get(`${partnerNode.id}:${otherPin}`)
            if (otherNet !== undefined) {
              const otherVolt = netVoltages.get(otherNet)
              if (otherVolt !== undefined && otherVolt > 3.0) {
                hasPullUp = true
              }
            }
          }
        })

        if (!hasPullUp && dataNetPins.length > 1) {
          warnings.push({
            id: `ds18b20-pullup-${node.id}`,
            componentId: node.id,
            pinId: 'data',
            message: `⚠ DS18B20 Temp Sensor (${node.properties.name}) requires a pull-up resistor (e.g. 4.7K) between DQ (DATA) and VCC.`,
            type: 'warning',
          })
        }
      }
    }

    // Rule G: I2C wiring check (OLED and LCD1602 SDA/SCL)
    if (node.type === 'lcd1602' || node.type === 'oled') {
      const sdaNet = pinToNetIdx.get(`${node.id}:sda`)
      const sclNet = pinToNetIdx.get(`${node.id}:scl`)

      if (sdaNet !== undefined && sclNet !== undefined) {
        // Verify SDA connects to SDA/A4 and SCL connects to SCL/A5
        let sdaCorrect = false
        let sclCorrect = false

        nets[sdaNet].forEach((p) => {
          if (p.includes('a4_sda') || p.includes('gpio21')) sdaCorrect = true
        })

        nets[sclNet].forEach((p) => {
          if (p.includes('a5_scl') || p.includes('gpio22')) sclCorrect = true
        })

        if (!sdaCorrect && nets[sdaNet].length > 1) {
          warnings.push({
            id: `i2c-sda-wrong-${node.id}`,
            componentId: node.id,
            pinId: 'sda',
            message: `⚠ SDA on ${node.properties.name} should connect to Arduino A4 / ESP32 GPIO21.`,
            type: 'warning',
          })
        }
        if (!sclCorrect && nets[sclNet].length > 1) {
          warnings.push({
            id: `i2c-scl-wrong-${node.id}`,
            componentId: node.id,
            pinId: 'scl',
            message: `⚠ SCL on ${node.properties.name} should connect to Arduino A5 / ESP32 GPIO22.`,
            type: 'warning',
          })
        }
      }
    }
  })

  // 5. Build Ground Network & Voltage Rails list for output
  const groundNets: string[][] = []
  nets.forEach((net, idx) => {
    if (netHasGnd.get(idx)) {
      groundNets.push(net)
    }
  })

  const voltageRails: Record<string, number> = {}
  netVoltages.forEach((volt, idx) => {
    if (volt > 0.05) {
      voltageRails[`Net ${idx} (${volt.toFixed(1)}V)`] = volt
    }
  })

  return {
    errors,
    warnings,
    connectedComponents: Array.from(connectedComponentsSet),
    powerSources: Array.from(powerSourcesSet),
    groundNets,
    voltageRails,
  }
}
