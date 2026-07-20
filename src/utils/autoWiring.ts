import type { WorkspaceNode, WorkspaceEdge, ComponentType, WireColor } from '@/types'

export interface WiringTemplate {
  name: string
  description: string
  nodes: { type: ComponentType; id: string; position: { x: number; y: number }; properties?: Record<string, any> }[]
  edges: { sourceNodeId: string; sourcePinId: string; targetNodeId: string; targetPinId: string; color: WireColor }[]
}

export const WIRING_TEMPLATES: Record<string, WiringTemplate> = {
  'simple-dc-bulb': {
    name: 'Simple Switch & Light Bulb',
    description: 'A 9V battery, toggle switch, and incandescent light bulb to demonstrate DC nodal analysis.',
    nodes: [
      { type: 'battery-snap-9v', id: 'bat', position: { x: 80, y: 160 }, properties: { name: '9V Battery' } },
      { type: 'toggle-switch-spst', id: 'sw', position: { x: 260, y: 80 }, properties: { name: 'Light Switch', state: false } },
      { type: 'bulb', id: 'bulb', position: { x: 440, y: 160 }, properties: { name: 'Light Bulb' } },
    ],
    edges: [
      { sourceNodeId: 'bat', sourcePinId: 'pos', targetNodeId: 'sw', targetPinId: 'a', color: 'red' },
      { sourceNodeId: 'sw', sourcePinId: 'b', targetNodeId: 'bulb', targetPinId: 'pos', color: 'red' },
      { sourceNodeId: 'bulb', sourcePinId: 'neg', targetNodeId: 'bat', targetPinId: 'neg', color: 'black' },
    ],
  },
  'arduino-lm35': {
    name: 'Arduino + LM35 Temp',
    description: 'Precision analog temperature sensor connection',
    nodes: [
      { type: 'arduino-uno', id: 'uno', position: { x: 50, y: 100 } },
      { type: 'lm35', id: 'temp', position: { x: 320, y: 180 } },
    ],
    edges: [
      { sourceNodeId: 'uno', sourcePinId: '5v', targetNodeId: 'temp', targetPinId: 'vcc', color: 'red' },
      { sourceNodeId: 'uno', sourcePinId: 'gnd', targetNodeId: 'temp', targetPinId: 'gnd', color: 'black' },
      { sourceNodeId: 'uno', sourcePinId: 'a0', targetNodeId: 'temp', targetPinId: 'out', color: 'orange' },
    ],
  },
  'arduino-lcd1602': {
    name: 'Arduino + LCD1602 I2C',
    description: 'Liquid crystal display character panel via I2C',
    nodes: [
      { type: 'arduino-uno', id: 'uno', position: { x: 50, y: 100 } },
      { type: 'lcd1602', id: 'lcd', position: { x: 300, y: 120 } },
    ],
    edges: [
      { sourceNodeId: 'uno', sourcePinId: '5v', targetNodeId: 'lcd', targetPinId: 'vcc', color: 'red' },
      { sourceNodeId: 'uno', sourcePinId: 'gnd', targetNodeId: 'lcd', targetPinId: 'gnd', color: 'black' },
      { sourceNodeId: 'uno', sourcePinId: 'a4_sda', targetNodeId: 'lcd', targetPinId: 'sda', color: 'green' },
      { sourceNodeId: 'uno', sourcePinId: 'a5_scl', targetNodeId: 'lcd', targetPinId: 'scl', color: 'green' },
    ],
  },
  'arduino-dht22': {
    name: 'Arduino + DHT22',
    description: 'DHT22 Digital Temperature & Humidity Sensor wiring',
    nodes: [
      { type: 'arduino-uno', id: 'uno', position: { x: 50, y: 100 } },
      { type: 'dht22', id: 'sensor', position: { x: 300, y: 160 } },
    ],
    edges: [
      { sourceNodeId: 'uno', sourcePinId: '5v', targetNodeId: 'sensor', targetPinId: 'vcc', color: 'red' },
      { sourceNodeId: 'uno', sourcePinId: 'gnd', targetNodeId: 'sensor', targetPinId: 'gnd', color: 'black' },
      { sourceNodeId: 'uno', sourcePinId: 'd2', targetNodeId: 'sensor', targetPinId: 'data', color: 'yellow' },
    ],
  },
  'arduino-ds18b20': {
    name: 'Arduino + DS18B20 Temp',
    description: '1-Wire temperature sensor with pull-up resistor',
    nodes: [
      { type: 'arduino-uno', id: 'uno', position: { x: 50, y: 100 } },
      { type: 'ds18b20', id: 'sensor', position: { x: 340, y: 180 } },
      { type: 'resistor', id: 'res', position: { x: 300, y: 60 }, properties: { resistance: 4700, name: '4.7K Pull-up' } },
    ],
    edges: [
      { sourceNodeId: 'uno', sourcePinId: '5v', targetNodeId: 'sensor', targetPinId: 'vcc', color: 'red' },
      { sourceNodeId: 'uno', sourcePinId: 'gnd', targetNodeId: 'sensor', targetPinId: 'gnd', color: 'black' },
      { sourceNodeId: 'uno', sourcePinId: '5v', targetNodeId: 'res', targetPinId: 'a', color: 'red' },
      { sourceNodeId: 'res', sourcePinId: 'b', targetNodeId: 'sensor', targetPinId: 'data', color: 'yellow' },
      { sourceNodeId: 'uno', sourcePinId: 'd2', targetNodeId: 'sensor', targetPinId: 'data', color: 'yellow' },
    ],
  },
  'arduino-relay': {
    name: 'Arduino + Relay & Bulb',
    description: 'Safe control of 12V high-power load from 5V logic',
    nodes: [
      { type: 'arduino-uno', id: 'uno', position: { x: 50, y: 100 } },
      { type: 'relay', id: 'rl', position: { x: 260, y: 140 } },
      { type: 'bulb', id: 'lamp', position: { x: 420, y: 100 } },
      { type: 'battery-12v', id: 'bat', position: { x: 420, y: 220 } },
    ],
    edges: [
      { sourceNodeId: 'uno', sourcePinId: '5v', targetNodeId: 'rl', targetPinId: 'vcc', color: 'red' },
      { sourceNodeId: 'uno', sourcePinId: 'gnd', targetNodeId: 'rl', targetPinId: 'gnd', color: 'black' },
      { sourceNodeId: 'uno', sourcePinId: 'd3', targetNodeId: 'rl', targetPinId: 'in', color: 'blue' },
      { sourceNodeId: 'bat', sourcePinId: 'pos', targetNodeId: 'rl', targetPinId: 'com', color: 'red' },
      { sourceNodeId: 'rl', sourcePinId: 'no', targetNodeId: 'lamp', targetPinId: 'pos', color: 'yellow' },
      { sourceNodeId: 'bat', sourcePinId: 'neg', targetNodeId: 'lamp', targetPinId: 'neg', color: 'black' },
    ],
  },
  'arduino-rgb': {
    name: 'Arduino + RGB LED',
    description: 'Wired three-channel PWM control with current limiters',
    nodes: [
      { type: 'arduino-uno', id: 'uno', position: { x: 50, y: 100 } },
      { type: 'rgb-led', id: 'rgb', position: { x: 360, y: 180 } },
      { type: 'resistor', id: 'res_r', position: { x: 280, y: 60 }, properties: { resistance: 220, name: '220Ω Red' } },
      { type: 'resistor', id: 'res_g', position: { x: 280, y: 110 }, properties: { resistance: 220, name: '220Ω Green' } },
      { type: 'resistor', id: 'res_b', position: { x: 280, y: 160 }, properties: { resistance: 220, name: '220Ω Blue' } },
    ],
    edges: [
      { sourceNodeId: 'uno', sourcePinId: 'd9', targetNodeId: 'res_r', targetPinId: 'a', color: 'blue' },
      { sourceNodeId: 'res_r', sourcePinId: 'b', targetNodeId: 'rgb', targetPinId: 'r', color: 'yellow' },
      { sourceNodeId: 'uno', sourcePinId: 'd10', targetNodeId: 'res_g', targetPinId: 'a', color: 'blue' },
      { sourceNodeId: 'res_g', sourcePinId: 'b', targetNodeId: 'rgb', targetPinId: 'g', color: 'yellow' },
      { sourceNodeId: 'uno', sourcePinId: 'd3', targetNodeId: 'res_b', targetPinId: 'a', color: 'blue' },
      { sourceNodeId: 'res_b', sourcePinId: 'b', targetNodeId: 'rgb', targetPinId: 'b', color: 'yellow' },
      { sourceNodeId: 'uno', sourcePinId: 'gnd', targetNodeId: 'rgb', targetPinId: 'gnd', color: 'black' },
    ],
  },
  'arduino-fan-pwm': {
    name: 'Arduino + PC Fan PWM',
    description: '12V 4-wire PWM fan control and speed sensing',
    nodes: [
      { type: 'arduino-uno', id: 'uno', position: { x: 50, y: 100 } },
      { type: 'pc-fan', id: 'fan', position: { x: 300, y: 120 } },
      { type: 'battery-12v', id: 'bat', position: { x: 300, y: 260 } },
    ],
    edges: [
      { sourceNodeId: 'uno', sourcePinId: 'gnd', targetNodeId: 'fan', targetPinId: 'gnd', color: 'black' },
      { sourceNodeId: 'uno', sourcePinId: 'gnd', targetNodeId: 'bat', targetPinId: 'neg', color: 'black' },
      { sourceNodeId: 'bat', sourcePinId: 'pos', targetNodeId: 'fan', targetPinId: 'vcc', color: 'red' },
      { sourceNodeId: 'uno', sourcePinId: 'd3', targetNodeId: 'fan', targetPinId: 'pwm', color: 'blue' },
      { sourceNodeId: 'uno', sourcePinId: 'd2', targetNodeId: 'fan', targetPinId: 'sense', color: 'yellow' },
    ],
  },
  'arduino-mosfet-motor': {
    name: 'Arduino + MOSFET Motor Driver',
    description: 'Power MOSFET driver for high-current 12V DC motor',
    nodes: [
      { type: 'arduino-uno', id: 'uno', position: { x: 50, y: 100 } },
      { type: 'n-mosfet', id: 'mosfet', position: { x: 260, y: 150 } },
      { type: 'dc-motor', id: 'motor', position: { x: 420, y: 100 } },
      { type: 'battery-12v', id: 'bat', position: { x: 420, y: 220 } },
    ],
    edges: [
      { sourceNodeId: 'uno', sourcePinId: 'd3', targetNodeId: 'mosfet', targetPinId: 'gate', color: 'blue' },
      { sourceNodeId: 'mosfet', sourcePinId: 'source', targetNodeId: 'uno', targetPinId: 'gnd', color: 'black' },
      { sourceNodeId: 'mosfet', sourcePinId: 'source', targetNodeId: 'bat', targetPinId: 'neg', color: 'black' },
      { sourceNodeId: 'bat', sourcePinId: 'pos', targetNodeId: 'motor', targetPinId: 'pos', color: 'red' },
      { sourceNodeId: 'motor', sourcePinId: 'neg', targetNodeId: 'mosfet', targetPinId: 'drain', color: 'yellow' },
    ],
  },
  'aircraft-module-1': {
    name: 'Redundant Flight Control Block',
    description: 'Fault-tolerant dual-controller flight control module',
    nodes: [
      { type: 'arduino-uno', id: 'primary', position: { x: 50, y: 50 }, properties: { name: 'Flight Computer A (Uno)' } },
      { type: 'esp32-devkit', id: 'secondary', position: { x: 50, y: 280 }, properties: { name: 'Flight Computer B (ESP32)' } },
      { type: 'ups-module-5v', id: 'ups', position: { x: 300, y: 80 }, properties: { name: 'Main 5V UPS' } },
      { type: 'relay', id: 'bypass', position: { x: 300, y: 260 }, properties: { name: 'Actuator Bypass Relay' } },
      { type: 'led', id: 'actuator', position: { x: 480, y: 260 }, properties: { name: 'Control Surface Actuator' } },
      { type: 'resistor', id: 'limit', position: { x: 480, y: 160 }, properties: { resistance: 220, name: '220Ω Actuator Resistor' } },
    ],
    edges: [
      { sourceNodeId: 'ups', sourcePinId: 'out_pos', targetNodeId: 'primary', targetPinId: 'vin', color: 'red' },
      { sourceNodeId: 'ups', sourcePinId: 'out_pos', targetNodeId: 'secondary', targetPinId: 'vin', color: 'red' },
      { sourceNodeId: 'ups', sourcePinId: 'out_neg', targetNodeId: 'primary', targetPinId: 'gnd', color: 'black' },
      { sourceNodeId: 'ups', sourcePinId: 'out_neg', targetNodeId: 'secondary', targetPinId: 'gnd', color: 'black' },
      { sourceNodeId: 'primary', sourcePinId: 'd9', targetNodeId: 'bypass', targetPinId: 'in', color: 'blue' },
      { sourceNodeId: 'secondary', sourcePinId: 'gpio2', targetNodeId: 'bypass', targetPinId: 'in', color: 'yellow' },
      { sourceNodeId: 'ups', sourcePinId: 'out_pos', targetNodeId: 'bypass', targetPinId: 'com', color: 'red' },
      { sourceNodeId: 'bypass', sourcePinId: 'no', targetNodeId: 'limit', targetPinId: 'a', color: 'yellow' },
      { sourceNodeId: 'limit', sourcePinId: 'b', targetNodeId: 'actuator', targetPinId: 'anode', color: 'yellow' },
      { sourceNodeId: 'actuator', sourcePinId: 'cathode', targetNodeId: 'ups', targetPinId: 'out_neg', color: 'black' },
    ],
  },
  'complete-aircraft-demo': {
    name: 'Complete Fault-Tolerant Bus Demo',
    description: 'Fully integrated redundant power, dual microcontrollers, bypass relays, and motor controllers',
    nodes: [
      { type: 'arduino-uno', id: 'uno', position: { x: 20, y: 60 }, properties: { name: 'Primary Core (Uno)' } },
      { type: 'esp32-devkit', id: 'esp', position: { x: 20, y: 300 }, properties: { name: 'Backup Core (ESP32)' } },
      { type: 'ups-module-5v', id: 'ups', position: { x: 240, y: 20 }, properties: { name: 'Core UPS' } },
      { type: 'battery-snap-9v', id: 'v_bat', position: { x: 420, y: 20 }, properties: { name: 'Backup Battery' } },
      { type: 'relay', id: 'power_relay', position: { x: 240, y: 200 }, properties: { name: 'Power Selector Relay' } },
      { type: 'slide-switch-spdt', id: 'manual_override', position: { x: 420, y: 150 }, properties: { name: 'Bypass Switch' } },
      { type: 'dc-motor', id: 'thrust_motor', position: { x: 580, y: 280 }, properties: { name: 'Main Thrust Motor' } },
      { type: 'n-mosfet', id: 'thrust_driver', position: { x: 420, y: 280 }, properties: { name: 'Thrust MOSFET Driver' } },
      { type: 'battery-12v', id: 'main_bus_12v', position: { x: 580, y: 80 }, properties: { name: '12V Main Bus' } },
    ],
    edges: [
      { sourceNodeId: 'v_bat', sourcePinId: 'pos', targetNodeId: 'ups', targetPinId: 'vin_pos', color: 'red' },
      { sourceNodeId: 'v_bat', sourcePinId: 'neg', targetNodeId: 'ups', targetPinId: 'vin_neg', color: 'black' },
      { sourceNodeId: 'ups', sourcePinId: 'out_pos', targetNodeId: 'uno', targetPinId: 'vin', color: 'red' },
      { sourceNodeId: 'ups', sourcePinId: 'out_neg', targetNodeId: 'uno', targetPinId: 'gnd', color: 'black' },
      { sourceNodeId: 'ups', sourcePinId: 'out_pos', targetNodeId: 'esp', targetPinId: 'vin', color: 'red' },
      { sourceNodeId: 'ups', sourcePinId: 'out_neg', targetNodeId: 'esp', targetPinId: 'gnd', color: 'black' },
      { sourceNodeId: 'uno', sourcePinId: 'd9', targetNodeId: 'thrust_driver', targetPinId: 'gate', color: 'blue' },
      { sourceNodeId: 'esp', sourcePinId: 'gpio32', targetNodeId: 'thrust_driver', targetPinId: 'gate', color: 'yellow' },
      { sourceNodeId: 'thrust_driver', sourcePinId: 'source', targetNodeId: 'ups', targetPinId: 'out_neg', color: 'black' },
      { sourceNodeId: 'thrust_driver', sourcePinId: 'source', targetNodeId: 'main_bus_12v', targetPinId: 'neg', color: 'black' },
      { sourceNodeId: 'main_bus_12v', sourcePinId: 'pos', targetNodeId: 'thrust_motor', targetPinId: 'pos', color: 'red' },
      { sourceNodeId: 'thrust_motor', sourcePinId: 'neg', targetNodeId: 'thrust_driver', targetPinId: 'drain', color: 'yellow' },
    ],
  },
}

export interface WiringRecommendation {
  id: string
  title: string
  message: string
  actionLabel?: string
  actionNode?: ComponentType
}

export function getWiringRecommendations(
  nodes: WorkspaceNode[],
  _edges: WorkspaceEdge[]
): WiringRecommendation[] {
  const recommendations: WiringRecommendation[] = []

  // Check 1: LED directly to 5V/3.3V
  const hasDirectLEDWarning = nodes.some(n => n.type === 'led' || n.type === 'rgb-led')
  // We can recommend placing a 220Ω resistor
  if (hasDirectLEDWarning) {
    const hasResistors = nodes.some(n => n.type === 'resistor')
    if (!hasResistors) {
      recommendations.push({
        id: 'rec-resistor',
        title: 'Suggest Current-Limiting Resistor',
        message: 'Your circuit contains an LED. Connecting it directly to a microcontroller pin or power rail can burn it out. We suggest adding a 220Ω resistor in series.',
        actionLabel: 'Add Resistor',
        actionNode: 'resistor',
      })
    }
  }

  // Check 2: High battery voltage (9V/12V) connected to boards
  const hasHighVoltage = nodes.some(n => n.type === 'battery-9v' || n.type === 'battery-12v')
  if (hasHighVoltage) {
    const hasRegulator = nodes.some(n => n.type === 'lm7805')
    if (!hasRegulator) {
      recommendations.push({
        id: 'rec-regulator',
        title: 'Suggest Voltage Regulator (LM7805)',
        message: 'Your circuit has a high voltage battery (9V/12V). Microcontrollers and sensors operate at 5V/3.3V. We suggest adding an LM7805 5V regulator to protect your parts.',
        actionLabel: 'Add LM7805',
        actionNode: 'lm7805',
      })
    }
  }

  // Check 3: PC Fan directly powered by microcontroller
  const hasPCFan = nodes.some(n => n.type === 'pc-fan' || n.type === 'dc-motor')
  if (hasPCFan) {
    const hasMOSFET = nodes.some(n => n.type === 'n-mosfet' || n.type === 'p-mosfet' || n.type === 'relay')
    if (!hasMOSFET) {
      recommendations.push({
        id: 'rec-mosfet',
        title: 'Suggest Power Driver (MOSFET / Relay)',
        message: 'Motors and fans draw high currents that exceed the microcontroller GPIO limits (max 40mA). We suggest using a MOSFET or Relay to switch them safely.',
        actionLabel: 'Add MOSFET',
        actionNode: 'n-mosfet',
      })
    }
  }

  return recommendations
}
