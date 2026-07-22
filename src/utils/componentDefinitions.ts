import type { ComponentDefinition, ComponentCategory, PinDefinition } from '@/types'

export const COMPONENT_CATEGORIES: {
  id: ComponentCategory
  label: string
  icon: string
}[] = [
  { id: 'boards', label: 'Boards', icon: 'Cpu' },
  { id: 'power', label: 'Power', icon: 'Zap' },
  { id: 'sensors', label: 'Sensors', icon: 'Thermometer' },
  { id: 'outputs', label: 'Outputs', icon: 'Lightbulb' },
  { id: 'control', label: 'Control', icon: 'ToggleLeft' },
  { id: 'electronic', label: 'Electronic Components', icon: 'CircuitBoard' },
  { id: 'connection', label: 'Connection', icon: 'Cable' },
]

const holeSpacing = 12
const startX = 24
const rowStartY = 44

function generateBreadboardPins(): PinDefinition[] {
  const pins: PinDefinition[] = []
  
  // Top rails (+ and -)
  for (let col = 1; col <= 30; col++) {
    const x = startX + (col - 1) * holeSpacing
    pins.push({
      id: `rail-top-pos-${col}`,
      label: `+ ${col}`,
      type: 'power',
      x,
      y: 13,
      voltageLimit: 30,
    })
    pins.push({
      id: `rail-top-neg-${col}`,
      label: `- ${col}`,
      type: 'ground',
      x,
      y: 27,
      voltageLimit: 30,
    })
  }

  // Middle rows a-e
  const ROWS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']
  for (let rIdx = 0; rIdx < 5; rIdx++) {
    const row = ROWS[rIdx]
    const y = rowStartY + rIdx * holeSpacing
    for (let col = 1; col <= 30; col++) {
      const x = startX + (col - 1) * holeSpacing
      pins.push({
        id: `hole-${row}-${col}`,
        label: `${row.toUpperCase()}${col}`,
        type: 'signal',
        x,
        y,
      })
    }
  }

  // Middle rows f-j
  for (let rIdx = 5; rIdx < 10; rIdx++) {
    const row = ROWS[rIdx]
    const y = rowStartY + rIdx * holeSpacing + 8
    for (let col = 1; col <= 30; col++) {
      const x = startX + (col - 1) * holeSpacing
      pins.push({
        id: `hole-${row}-${col}`,
        label: `${row.toUpperCase()}${col}`,
        type: 'signal',
        x,
        y,
      })
    }
  }

  // Bottom rails (- and +)
  for (let col = 1; col <= 30; col++) {
    const x = startX + (col - 1) * holeSpacing
    pins.push({
      id: `rail-bottom-neg-${col}`,
      label: `- ${col}`,
      type: 'ground',
      x,
      y: 171,
      voltageLimit: 30,
    })
    pins.push({
      id: `rail-bottom-pos-${col}`,
      label: `+ ${col}`,
      type: 'power',
      x,
      y: 185,
      voltageLimit: 30,
    })
  }

  return pins
}

export const COMPONENT_DEFINITIONS: ComponentDefinition[] = [
  {
    type: 'esp32-devkit',
    name: 'ESP32 DevKit V1',
    category: 'boards',
    description: 'ESP32 development board (3.3V GPIO tolerance)',
    defaultWidth: 120,
    defaultHeight: 200,
    defaultProperties: { name: 'ESP32 DevKit V1', rotation: 0 },
    pins: [
      { id: '3v3', label: '3V3', type: 'power', x: 10, y: 15, direction: 'output', voltageLimit: 3.3 },
      { id: 'gnd', label: 'GND', type: 'ground', x: 10, y: 30 },
      { id: 'gnd2', label: 'GND 2', type: 'ground', x: 10, y: 45 },
      { id: 'en', label: 'EN', type: 'digital', x: 10, y: 60, direction: 'input', voltageLimit: 3.3 },
      { id: 'gpio34', label: 'GPIO34', type: 'analog', x: 10, y: 75, isAnalog: true, direction: 'input', voltageLimit: 3.3 },
      { id: 'gpio35', label: 'GPIO35', type: 'analog', x: 10, y: 90, isAnalog: true, direction: 'input', voltageLimit: 3.3 },
      { id: 'gpio32', label: 'GPIO32', type: 'gpio', x: 10, y: 105, isAnalog: true, isPWM: true, voltageLimit: 3.3 },
      { id: 'gpio33', label: 'GPIO33', type: 'gpio', x: 10, y: 120, isAnalog: true, isPWM: true, voltageLimit: 3.3 },
      { id: 'gpio25', label: 'GPIO25', type: 'gpio', x: 10, y: 135, isAnalog: true, isPWM: true, voltageLimit: 3.3 },
      { id: 'gpio26', label: 'GPIO26', type: 'gpio', x: 10, y: 150, isAnalog: true, isPWM: true, voltageLimit: 3.3 },
      { id: 'gpio27', label: 'GPIO27', type: 'gpio', x: 10, y: 165, isAnalog: true, isPWM: true, voltageLimit: 3.3 },
      { id: 'vin', label: 'VIN', type: 'power', x: 10, y: 180, direction: 'input', voltageLimit: 12 },

      { id: 'vin_out', label: '5V', type: 'power', x: 110, y: 15, direction: 'output', voltageLimit: 5.0 },
      { id: 'gpio2', label: 'GPIO2 (LED)', type: 'gpio', x: 110, y: 30, isPWM: true, voltageLimit: 3.3 },
      { id: 'gpio4', label: 'GPIO4', type: 'gpio', x: 110, y: 45, isAnalog: true, voltageLimit: 3.3 },
      { id: 'gpio5', label: 'GPIO5', type: 'gpio', x: 110, y: 60, voltageLimit: 3.3 },
      { id: 'gpio18', label: 'GPIO18 (SCK)', type: 'gpio', x: 110, y: 75, voltageLimit: 3.3 },
      { id: 'gpio19', label: 'GPIO19 (MISO)', type: 'gpio', x: 110, y: 90, voltageLimit: 3.3 },
      { id: 'gpio21', label: 'GPIO21 (SDA)', type: 'bus', x: 110, y: 105, voltageLimit: 3.3 },
      { id: 'gpio22', label: 'GPIO22 (SCL)', type: 'bus', x: 110, y: 120, voltageLimit: 3.3 },
      { id: 'gpio23', label: 'GPIO23 (MOSI)', type: 'gpio', x: 110, y: 135, voltageLimit: 3.3 },
      { id: 'gpio13', label: 'GPIO13', type: 'gpio', x: 110, y: 150, voltageLimit: 3.3 },
      { id: 'gpio14', label: 'GPIO14', type: 'gpio', x: 110, y: 165, voltageLimit: 3.3 },
      { id: 'gnd3', label: 'GND 3', type: 'ground', x: 110, y: 180 },
    ],
  },
  {
    type: 'arduino-uno',
    name: 'Arduino Uno R3',
    category: 'boards',
    description: 'ATmega328P microcontroller board (5V GPIO tolerance)',
    defaultWidth: 140,
    defaultHeight: 180,
    defaultProperties: { name: 'Arduino Uno R3', rotation: 0 },
    pins: [
      // Left side: Power & Analog
      { id: 'ioref', label: 'IOREF', type: 'power', x: 10, y: 20, direction: 'output', voltageLimit: 5 },
      { id: 'reset', label: 'RESET', type: 'signal', x: 10, y: 35, voltageLimit: 5 },
      { id: '3v3', label: '3.3V', type: 'power', x: 10, y: 50, direction: 'output', voltageLimit: 3.3, currentLimit: 0.15 },
      { id: '5v', label: '5V', type: 'power', x: 10, y: 65, direction: 'output', voltageLimit: 5.0, currentLimit: 0.4 },
      { id: 'gnd', label: 'GND', type: 'ground', x: 10, y: 80 },
      { id: 'gnd2', label: 'GND 2', type: 'ground', x: 10, y: 95 },
      { id: 'vin', label: 'VIN', type: 'power', x: 10, y: 110, direction: 'input', voltageLimit: 12 },
      { id: 'a0', label: 'A0', type: 'analog', x: 10, y: 125, isAnalog: true, voltageLimit: 5 },
      { id: 'a1', label: 'A1', type: 'analog', x: 10, y: 140, isAnalog: true, voltageLimit: 5 },
      { id: 'a2', label: 'A2', type: 'analog', x: 10, y: 155, isAnalog: true, voltageLimit: 5 },
      { id: 'a3', label: 'A3', type: 'analog', x: 10, y: 170, isAnalog: true, voltageLimit: 5 },

      // Right side: Digital pins
      { id: 'a4_sda', label: 'A4/SDA', type: 'bus', x: 130, y: 20, isAnalog: true, voltageLimit: 5 },
      { id: 'a5_scl', label: 'A5/SCL', type: 'bus', x: 130, y: 35, isAnalog: true, voltageLimit: 5 },
      { id: 'd2', label: 'D2', type: 'digital', x: 130, y: 50, voltageLimit: 5 },
      { id: 'd3', label: 'D3', type: 'digital', x: 130, y: 65, isPWM: true, voltageLimit: 5 },
      { id: 'd4', label: 'D4', type: 'digital', x: 130, y: 80, voltageLimit: 5 },
      { id: 'd5', label: 'D5', type: 'digital', x: 130, y: 95, isPWM: true, voltageLimit: 5 },
      { id: 'd6', label: 'D6', type: 'digital', x: 130, y: 110, isPWM: true, voltageLimit: 5 },
      { id: 'd7', label: 'D7', type: 'digital', x: 130, y: 125, voltageLimit: 5 },
      { id: 'd8', label: 'D8', type: 'digital', x: 130, y: 140, voltageLimit: 5 },
      { id: 'd9', label: 'D9', type: 'digital', x: 130, y: 155, isPWM: true, voltageLimit: 5, currentLimit: 0.04 },
      { id: 'd10', label: 'D10 (SS)', type: 'digital', x: 130, y: 170, isPWM: true, voltageLimit: 5 },
    ],
  },
  {
    type: 'breadboard',
    name: 'Breadboard',
    category: 'power',
    description: '830-point solderless breadboard',
    defaultWidth: 400,
    defaultHeight: 200,
    defaultProperties: { name: 'Breadboard', rotation: 0, splitPowerRails: false },
    pins: generateBreadboardPins(),
  },
  {
    type: 'power-supply-5v',
    name: '5V Power Supply',
    category: 'power',
    description: '5V regulated power source',
    defaultWidth: 80,
    defaultHeight: 60,
    defaultProperties: { name: '5V Supply', rotation: 0, voltage: 5 },
    pins: [
      { id: 'vcc', label: '5V', type: 'power', x: 40, y: 10, direction: 'output', voltageLimit: 5 },
      { id: 'gnd', label: 'GND', type: 'ground', x: 40, y: 50 },
    ],
  },
  {
    type: 'battery-9v',
    name: '9V Battery',
    category: 'power',
    description: '9V alkaline battery',
    defaultWidth: 60,
    defaultHeight: 100,
    defaultProperties: { name: '9V Battery', rotation: 0, voltage: 9 },
    pins: [
      { id: 'pos', label: '+', type: 'power', x: 15, y: 10, direction: 'output', voltageLimit: 9 },
      { id: 'neg', label: '-', type: 'ground', x: 45, y: 10 },
    ],
  },
  {
    type: 'battery-12v',
    name: '12V Battery',
    category: 'power',
    description: '12V lead-acid battery',
    defaultWidth: 80,
    defaultHeight: 60,
    defaultProperties: { name: '12V Battery', rotation: 0, voltage: 12 },
    pins: [
      { id: 'pos', label: '+', type: 'power', x: 20, y: 10, direction: 'output', voltageLimit: 12 },
      { id: 'neg', label: '-', type: 'ground', x: 60, y: 10 },
    ],
  },
  {
    type: 'ground',
    name: 'Ground',
    category: 'power',
    description: 'Ground reference node',
    defaultWidth: 40,
    defaultHeight: 40,
    defaultProperties: { name: 'Ground', rotation: 0 },
    pins: [{ id: 'gnd', label: 'GND', type: 'ground', x: 20, y: 10 }],
  },
  {
    type: 'super-capacitor',
    name: 'Super Capacitor',
    category: 'power',
    description: 'High-capacity energy storage',
    defaultWidth: 50,
    defaultHeight: 70,
    defaultProperties: { name: 'Super Cap', rotation: 0, capacitance: 1, voltage: 5.5, storedVoltage: 5.0 },
    pins: [
      { id: 'pos', label: '+', type: 'power', x: 15, y: 55, voltageLimit: 5.5 },
      { id: 'neg', label: '-', type: 'ground', x: 35, y: 55 },
    ],
  },
  {
    type: 'lm7805',
    name: 'LM7805 Regulator',
    category: 'power',
    description: '5V voltage regulator IC',
    defaultWidth: 60,
    defaultHeight: 80,
    defaultProperties: { name: 'LM7805', rotation: 0, voltage: 5 },
    pins: [
      { id: 'in', label: 'IN', type: 'power', x: 10, y: 70, direction: 'input', voltageLimit: 35 },
      { id: 'gnd', label: 'GND', type: 'ground', x: 30, y: 70 },
      { id: 'out', label: 'OUT', type: 'power', x: 50, y: 70, direction: 'output', voltageLimit: 5.0 },
    ],
  },
  {
    type: 'usb-breakout',
    name: 'USB Breakout Board',
    category: 'power',
    description: 'MicroUSB / USB-C 5V breakout board',
    defaultWidth: 60,
    defaultHeight: 40,
    defaultProperties: { name: 'USB Power', rotation: 0, voltage: 5 },
    pins: [
      { id: 'vcc', label: 'VCC', type: 'power', x: 50, y: 12, direction: 'output', voltageLimit: 5 },
      { id: 'd-', label: 'D-', type: 'bus', x: 50, y: 20 },
      { id: 'd+', label: 'D+', type: 'bus', x: 50, y: 28 },
      { id: 'gnd', label: 'GND', type: 'ground', x: 50, y: 36 },
    ],
  },
  {
    type: 'dc-jack',
    name: 'DC Barrel Jack Breakout',
    category: 'power',
    description: 'DC barrel jack breakout board',
    defaultWidth: 60,
    defaultHeight: 40,
    defaultProperties: { name: 'DC Jack', rotation: 0, voltage: 9 },
    pins: [
      { id: 'vcc', label: 'VCC', type: 'power', x: 50, y: 15, direction: 'output', voltageLimit: 24 },
      { id: 'gnd', label: 'GND', type: 'ground', x: 50, y: 30 },
    ],
  },
  {
    type: 'battery-snap-9v',
    name: '9V Battery Snap Connector',
    category: 'power',
    description: '9V battery snap connector with leads',
    defaultWidth: 60,
    defaultHeight: 40,
    defaultProperties: { name: '9V Snap', rotation: 0, voltage: 9 },
    pins: [
      { id: 'pos', label: 'RED (+)', type: 'power', x: 50, y: 15, direction: 'output', voltageLimit: 9 },
      { id: 'neg', label: 'BLK (-)', type: 'ground', x: 50, y: 30 },
    ],
  },
  {
    type: 'battery-18650',
    name: '18650 Battery Cell',
    category: 'power',
    description: '3.7V Lithium-Ion battery cell',
    defaultWidth: 80,
    defaultHeight: 30,
    defaultProperties: { name: '18650 Cell', rotation: 0, voltage: 3.7 },
    pins: [
      { id: 'pos', label: '+', type: 'power', x: 72, y: 15, direction: 'output', voltageLimit: 4.2 },
      { id: 'neg', label: '-', type: 'ground', x: 8, y: 15 },
    ],
  },
  {
    type: 'holder-18650',
    name: '18650 Battery Holder',
    category: 'power',
    description: 'Single-cell 18650 battery holder',
    defaultWidth: 80,
    defaultHeight: 40,
    defaultProperties: { name: '18650 Holder', rotation: 0, voltage: 3.7 },
    pins: [
      { id: 'pos', label: 'RED (+)', type: 'power', x: 72, y: 20, direction: 'output', voltageLimit: 4.2 },
      { id: 'neg', label: 'BLK (-)', type: 'ground', x: 8, y: 20 },
    ],
  },
  {
    type: 'ups-module-5v',
    name: '5V UPS / Backup Power Module',
    category: 'power',
    description: 'Uninterruptible 5V backup power module',
    defaultWidth: 80,
    defaultHeight: 50,
    defaultProperties: { name: '5V UPS', rotation: 0, voltage: 5 },
    pins: [
      { id: 'vin_pos', label: 'VIN+', type: 'power', x: 8, y: 15, direction: 'input', voltageLimit: 5.5 },
      { id: 'vin_neg', label: 'VIN-', type: 'ground', x: 8, y: 35 },
      { id: 'out_pos', label: 'OUT+', type: 'power', x: 72, y: 15, direction: 'output', voltageLimit: 5 },
      { id: 'out_neg', label: 'OUT-', type: 'ground', x: 72, y: 35 },
      { id: 'bat_pos', label: 'BAT+', type: 'power', x: 40, y: 10, voltageLimit: 4.2 },
      { id: 'bat_neg', label: 'BAT-', type: 'ground', x: 40, y: 40 },
    ],
  },
  {
    type: 'terminal-strip-4',
    name: 'Terminal Strip (4-Pin)',
    category: 'power',
    description: '4-Pin bus terminal strip for power distribution',
    defaultWidth: 80,
    defaultHeight: 30,
    defaultProperties: { name: 'Terminal Strip 4', rotation: 0 },
    pins: [
      { id: 'p1', label: '1', type: 'bus', x: 10, y: 15 },
      { id: 'p2', label: '2', type: 'bus', x: 30, y: 15 },
      { id: 'p3', label: '3', type: 'bus', x: 50, y: 15 },
      { id: 'p4', label: '4', type: 'bus', x: 70, y: 15 },
    ],
  },
  {
    type: 'terminal-strip-8',
    name: 'Terminal Strip (8-Pin)',
    category: 'power',
    description: '8-Pin bus terminal strip for power distribution',
    defaultWidth: 160,
    defaultHeight: 30,
    defaultProperties: { name: 'Terminal Strip 8', rotation: 0 },
    pins: [
      { id: 'p1', label: '1', type: 'bus', x: 10, y: 15 },
      { id: 'p2', label: '2', type: 'bus', x: 30, y: 15 },
      { id: 'p3', label: '3', type: 'bus', x: 50, y: 15 },
      { id: 'p4', label: '4', type: 'bus', x: 70, y: 15 },
      { id: 'p5', label: '5', type: 'bus', x: 90, y: 15 },
      { id: 'p6', label: '6', type: 'bus', x: 110, y: 15 },
      { id: 'p7', label: '7', type: 'bus', x: 130, y: 15 },
      { id: 'p8', label: '8', type: 'bus', x: 150, y: 15 },
    ],
  },
  {
    type: 'lm35',
    name: 'LM35 Temperature Sensor',
    category: 'sensors',
    description: 'Analog temperature sensor (Linear, 10mV/°C)',
    defaultWidth: 40,
    defaultHeight: 60,
    defaultProperties: { name: 'LM35', rotation: 0, temperature: 25 },
    pins: [
      { id: 'vcc', label: 'VCC', type: 'power', x: 8, y: 10, direction: 'input', voltageLimit: 20 },
      { id: 'out', label: 'OUT', type: 'analog', x: 20, y: 50, direction: 'output', voltageLimit: 5 },
      { id: 'gnd', label: 'GND', type: 'ground', x: 32, y: 10 },
    ],
  },
  {
    type: 'dht22',
    name: 'DHT22 Humidity Sensor',
    category: 'sensors',
    description: 'Digital humidity & temperature sensor',
    defaultWidth: 50,
    defaultHeight: 60,
    defaultProperties: { name: 'DHT22', rotation: 0, temperature: 25, humidity: 50 },
    pins: [
      { id: 'vcc', label: 'VCC', type: 'power', x: 8, y: 15, direction: 'input', voltageLimit: 6 },
      { id: 'data', label: 'DATA', type: 'digital', x: 25, y: 50, direction: 'bidirectional', voltageLimit: 5 },
      { id: 'gnd', label: 'GND', type: 'ground', x: 42, y: 15 },
    ],
  },
  {
    type: 'ds18b20',
    name: 'DS18B20 Temp Sensor',
    category: 'sensors',
    description: '1-Wire digital temperature sensor (Requires pull-up)',
    defaultWidth: 40,
    defaultHeight: 50,
    defaultProperties: { name: 'DS18B20', rotation: 0, temperature: 25 },
    pins: [
      { id: 'vcc', label: 'VDD', type: 'power', x: 8, y: 10, direction: 'input', voltageLimit: 5.5 },
      { id: 'data', label: 'DQ', type: 'digital', x: 20, y: 42, direction: 'bidirectional', voltageLimit: 5.5 },
      { id: 'gnd', label: 'GND', type: 'ground', x: 32, y: 10 },
    ],
  },
  {
    type: 'led',
    name: 'LED (Standard)',
    category: 'outputs',
    description: 'Standard light emitting diode (Requires resistor)',
    defaultWidth: 30,
    defaultHeight: 50,
    defaultProperties: { name: 'LED', rotation: 0, color: '#ff0000' },
    pins: [
      { id: 'anode', label: 'A (Anode)', type: 'signal', x: 8, y: 40, direction: 'input', voltageLimit: 2.2 },
      { id: 'cathode', label: 'K (Cathode)', type: 'ground', x: 22, y: 40 },
    ],
  },
  {
    type: 'rgb-led',
    name: 'RGB LED',
    category: 'outputs',
    description: 'Common cathode RGB LED (Requires resistors)',
    defaultWidth: 50,
    defaultHeight: 50,
    defaultProperties: { name: 'RGB LED', rotation: 0, color: '#ffffff' },
    pins: [
      { id: 'r', label: 'R (Red)', type: 'signal', x: 10, y: 40, voltageLimit: 2.2 },
      { id: 'gnd', label: 'GND (Cathode)', type: 'ground', x: 20, y: 40 },
      { id: 'g', label: 'G (Green)', type: 'signal', x: 30, y: 40, voltageLimit: 3.2 },
      { id: 'b', label: 'B (Blue)', type: 'signal', x: 40, y: 40, voltageLimit: 3.2 },
    ],
  },
  {
    type: 'bulb',
    name: 'Incandescent Bulb',
    category: 'outputs',
    description: 'Generic low-voltage light bulb',
    defaultWidth: 50,
    defaultHeight: 70,
    defaultProperties: { name: 'Bulb', rotation: 0 },
    pins: [
      { id: 'pos', label: 'Term 1', type: 'signal', x: 15, y: 60 },
      { id: 'neg', label: 'Term 2', type: 'ground', x: 35, y: 60 },
    ],
  },
  {
    type: 'lcd1602',
    name: 'LCD1602 Display (I2C)',
    category: 'outputs',
    description: '16x2 Character LCD with I2C Backpack',
    defaultWidth: 160,
    defaultHeight: 80,
    defaultProperties: { name: 'LCD1602', rotation: 0 },
    pins: [
      { id: 'gnd', label: 'GND', type: 'ground', x: 8, y: 20 },
      { id: 'vcc', label: 'VCC', type: 'power', x: 8, y: 32, direction: 'input', voltageLimit: 5.5 },
      { id: 'sda', label: 'SDA', type: 'bus', x: 8, y: 44, voltageLimit: 5.5 },
      { id: 'scl', label: 'SCL', type: 'bus', x: 8, y: 56, voltageLimit: 5.5 },
    ],
  },
  {
    type: 'oled',
    name: 'OLED Display (I2C)',
    category: 'outputs',
    description: '128x64 Pixel I2C OLED display',
    defaultWidth: 80,
    defaultHeight: 50,
    defaultProperties: { name: 'OLED', rotation: 0 },
    pins: [
      { id: 'vcc', label: 'VCC', type: 'power', x: 10, y: 42, direction: 'input', voltageLimit: 3.6 },
      { id: 'gnd', label: 'GND', type: 'ground', x: 25, y: 42 },
      { id: 'scl', label: 'SCL', type: 'bus', x: 40, y: 42, voltageLimit: 3.6 },
      { id: 'sda', label: 'SDA', type: 'bus', x: 55, y: 42, voltageLimit: 3.6 },
    ],
  },
  {
    type: 'buzzer',
    name: 'Piezo Buzzer',
    category: 'outputs',
    description: 'Piezoelectric audio buzzer',
    defaultWidth: 40,
    defaultHeight: 40,
    defaultProperties: { name: 'Buzzer', rotation: 0 },
    pins: [
      { id: 'pos', label: '+', type: 'signal', x: 12, y: 34, voltageLimit: 12 },
      { id: 'neg', label: '-', type: 'ground', x: 28, y: 34 },
    ],
  },
  {
    type: 'pc-fan',
    name: 'PC Fan (4-Pin PWM)',
    category: 'outputs',
    description: '12V PC cooling fan with PWM & Tach',
    defaultWidth: 80,
    defaultHeight: 80,
    defaultProperties: { name: 'PC Fan', rotation: 0, voltage: 12 },
    pins: [
      { id: 'gnd', label: 'GND (Black)', type: 'ground', x: 10, y: 70 },
      { id: 'vcc', label: '12V (Red)', type: 'power', x: 25, y: 70, direction: 'input', voltageLimit: 13 },
      { id: 'sense', label: 'SENSE (Yellow)', type: 'signal', x: 40, y: 70, direction: 'output', voltageLimit: 5 },
      { id: 'pwm', label: 'PWM (Blue)', type: 'digital', x: 55, y: 70, direction: 'input', voltageLimit: 5 },
    ],
  },
  {
    type: 'dc-motor',
    name: 'DC Toy Motor',
    category: 'outputs',
    description: 'Standard 3-12V brushed DC motor',
    defaultWidth: 70,
    defaultHeight: 70,
    defaultProperties: { name: 'DC Motor', rotation: 0 },
    pins: [
      { id: 'pos', label: 'Term 1', type: 'signal', x: 15, y: 60 },
      { id: 'neg', label: 'Term 2', type: 'ground', x: 55, y: 60 },
    ],
  },
  {
    type: 'push-button',
    name: 'Push Button (NO)',
    category: 'control',
    description: 'Momentary normally-open push button',
    defaultWidth: 40,
    defaultHeight: 40,
    defaultProperties: { name: 'Push Button', rotation: 0 },
    pins: [
      { id: 'a', label: 'Pin A', type: 'signal', x: 10, y: 32 },
      { id: 'b', label: 'Pin B', type: 'signal', x: 30, y: 32 },
    ],
  },
  {
    type: 'toggle-switch-spst',
    name: 'SPST Toggle Switch',
    category: 'control',
    description: 'Single Pole Single Throw toggle switch',
    defaultWidth: 50,
    defaultHeight: 30,
    defaultProperties: { name: 'SPST Switch', rotation: 0, state: false },
    pins: [
      { id: 'a', label: 'A', type: 'signal', x: 15, y: 22 },
      { id: 'b', label: 'B', type: 'signal', x: 35, y: 22 },
    ],
  },
  {
    type: 'toggle-switch-spdt',
    name: 'SPDT Toggle Switch',
    category: 'control',
    description: 'Single Pole Double Throw toggle switch',
    defaultWidth: 50,
    defaultHeight: 30,
    defaultProperties: { name: 'SPDT Switch', rotation: 0, state: 'no' }, // 'no' or 'nc'
    pins: [
      { id: 'com', label: 'COM', type: 'signal', x: 25, y: 22 },
      { id: 'no', label: 'NO', type: 'signal', x: 10, y: 8 },
      { id: 'nc', label: 'NC', type: 'signal', x: 40, y: 8 },
    ],
  },
  {
    type: 'toggle-switch-dpdt',
    name: 'DPDT Toggle Switch',
    category: 'control',
    description: 'Double Pole Double Throw toggle switch',
    defaultWidth: 60,
    defaultHeight: 40,
    defaultProperties: { name: 'DPDT Switch', rotation: 0, state: 'no' },
    pins: [
      { id: 'com1', label: 'COM1', type: 'signal', x: 15, y: 30 },
      { id: 'no1', label: 'NO1', type: 'signal', x: 10, y: 10 },
      { id: 'nc1', label: 'NC1', type: 'signal', x: 20, y: 10 },
      { id: 'com2', label: 'COM2', type: 'signal', x: 45, y: 30 },
      { id: 'no2', label: 'NO2', type: 'signal', x: 40, y: 10 },
      { id: 'nc2', label: 'NC2', type: 'signal', x: 50, y: 10 },
    ],
  },
  {
    type: 'slide-switch-spst',
    name: 'SPST Slide Switch',
    category: 'control',
    description: 'SPST slide switch (clickable handle)',
    defaultWidth: 50,
    defaultHeight: 30,
    defaultProperties: { name: 'SPST Slide', rotation: 0, state: false },
    pins: [
      { id: 'a', label: 'A', type: 'signal', x: 15, y: 22 },
      { id: 'b', label: 'B', type: 'signal', x: 35, y: 22 },
    ],
  },
  {
    type: 'slide-switch-spdt',
    name: 'SPDT Slide Switch',
    category: 'control',
    description: 'SPDT slide switch (clickable handle)',
    defaultWidth: 50,
    defaultHeight: 30,
    defaultProperties: { name: 'SPDT Slide', rotation: 0, state: 'no' },
    pins: [
      { id: 'com', label: 'COM', type: 'signal', x: 25, y: 22 },
      { id: 'no', label: 'NO', type: 'signal', x: 10, y: 8 },
      { id: 'nc', label: 'NC', type: 'signal', x: 40, y: 8 },
    ],
  },
  {
    type: 'slide-switch-dpdt',
    name: 'DPDT Slide Switch',
    category: 'control',
    description: 'DPDT slide switch (clickable handle)',
    defaultWidth: 60,
    defaultHeight: 40,
    defaultProperties: { name: 'DPDT Slide', rotation: 0, state: 'no' },
    pins: [
      { id: 'com1', label: 'COM1', type: 'signal', x: 15, y: 30 },
      { id: 'no1', label: 'NO1', type: 'signal', x: 10, y: 10 },
      { id: 'nc1', label: 'NC1', type: 'signal', x: 20, y: 10 },
      { id: 'com2', label: 'COM2', type: 'signal', x: 45, y: 30 },
      { id: 'no2', label: 'NO2', type: 'signal', x: 40, y: 10 },
      { id: 'nc2', label: 'NC2', type: 'signal', x: 50, y: 10 },
    ],
  },
  {
    type: 'dip-switch-2',
    name: 'DIP Switch (2-Pos)',
    category: 'control',
    description: '2-Position DIP Switch block',
    defaultWidth: 40,
    defaultHeight: 50,
    defaultProperties: { name: 'DIP-2', rotation: 0, state: { s1: false, s2: false } },
    pins: [
      { id: 'a1', label: 'A1', type: 'signal', x: 10, y: 40 },
      { id: 'b1', label: 'B1', type: 'signal', x: 10, y: 10 },
      { id: 'a2', label: 'A2', type: 'signal', x: 30, y: 40 },
      { id: 'b2', label: 'B2', type: 'signal', x: 30, y: 10 },
    ],
  },
  {
    type: 'dip-switch-4',
    name: 'DIP Switch (4-Pos)',
    category: 'control',
    description: '4-Position DIP Switch block',
    defaultWidth: 60,
    defaultHeight: 50,
    defaultProperties: { name: 'DIP-4', rotation: 0, state: { s1: false, s2: false, s3: false, s4: false } },
    pins: [
      { id: 'a1', label: 'A1', type: 'signal', x: 12, y: 40 },
      { id: 'b1', label: 'B1', type: 'signal', x: 12, y: 10 },
      { id: 'a2', label: 'A2', type: 'signal', x: 24, y: 40 },
      { id: 'b2', label: 'B2', type: 'signal', x: 24, y: 10 },
      { id: 'a3', label: 'A3', type: 'signal', x: 36, y: 40 },
      { id: 'b3', label: 'B3', type: 'signal', x: 36, y: 10 },
      { id: 'a4', label: 'A4', type: 'signal', x: 48, y: 40 },
      { id: 'b4', label: 'B4', type: 'signal', x: 48, y: 10 },
    ],
  },
  {
    type: 'dip-switch-8',
    name: 'DIP Switch (8-Pos)',
    category: 'control',
    description: '8-Position DIP Switch block',
    defaultWidth: 110,
    defaultHeight: 50,
    defaultProperties: { name: 'DIP-8', rotation: 0, state: { s1: false, s2: false, s3: false, s4: false, s5: false, s6: false, s7: false, s8: false } },
    pins: [
      { id: 'a1', label: 'A1', type: 'signal', x: 12, y: 40 },
      { id: 'b1', label: 'B1', type: 'signal', x: 12, y: 10 },
      { id: 'a2', label: 'A2', type: 'signal', x: 24, y: 40 },
      { id: 'b2', label: 'B2', type: 'signal', x: 24, y: 10 },
      { id: 'a3', label: 'A3', type: 'signal', x: 36, y: 40 },
      { id: 'b3', label: 'B3', type: 'signal', x: 36, y: 10 },
      { id: 'a4', label: 'A4', type: 'signal', x: 48, y: 40 },
      { id: 'b4', label: 'B4', type: 'signal', x: 48, y: 10 },
      { id: 'a5', label: 'A5', type: 'signal', x: 60, y: 40 },
      { id: 'b5', label: 'B5', type: 'signal', x: 60, y: 10 },
      { id: 'a6', label: 'A6', type: 'signal', x: 72, y: 40 },
      { id: 'b6', label: 'B6', type: 'signal', x: 72, y: 10 },
      { id: 'a7', label: 'A7', type: 'signal', x: 84, y: 40 },
      { id: 'b7', label: 'B7', type: 'signal', x: 84, y: 10 },
      { id: 'a8', label: 'A8', type: 'signal', x: 96, y: 40 },
      { id: 'b8', label: 'B8', type: 'signal', x: 96, y: 10 },
    ],
  },
  {
    type: 'relay',
    name: 'SPDT Relay Module',
    category: 'control',
    description: '5V electromagnetic SPDT relay board',
    defaultWidth: 60,
    defaultHeight: 80,
    defaultProperties: { name: 'Relay', rotation: 0 },
    pins: [
      { id: 'vcc', label: 'VCC', type: 'power', x: 8, y: 20, direction: 'input', voltageLimit: 5.5 },
      { id: 'gnd', label: 'GND', type: 'ground', x: 8, y: 40 },
      { id: 'in', label: 'IN', type: 'digital', x: 8, y: 60, direction: 'input', voltageLimit: 5.5 },
      { id: 'no', label: 'NO', type: 'signal', x: 52, y: 20, voltageLimit: 250 },
      { id: 'com', label: 'COM', type: 'signal', x: 52, y: 40, voltageLimit: 250 },
      { id: 'nc', label: 'NC', type: 'signal', x: 52, y: 60, voltageLimit: 250 },
    ],
  },
  {
    type: 'potentiometer',
    name: '10K Potentiometer',
    category: 'control',
    description: 'Rotary potentiometer (3-terminal)',
    defaultWidth: 50,
    defaultHeight: 50,
    defaultProperties: { name: 'Potentiometer', rotation: 0, resistance: 10000 },
    pins: [
      { id: 'gnd', label: 'GND (1)', type: 'ground', x: 10, y: 40 },
      { id: 'sig', label: 'WIPER (2)', type: 'analog', x: 25, y: 40, direction: 'output', voltageLimit: 5 },
      { id: 'vcc', label: 'VCC (3)', type: 'power', x: 40, y: 40, direction: 'input', voltageLimit: 5 },
    ],
  },
  {
    type: 'resistor',
    name: 'Resistor',
    category: 'electronic',
    description: 'Axial-lead carbon film resistor',
    defaultWidth: 60,
    defaultHeight: 20,
    defaultProperties: { name: 'Resistor', rotation: 0, resistance: 1000 },
    pins: [
      { id: 'a', label: 'Pin A', type: 'signal', x: 4, y: 10 },
      { id: 'b', label: 'Pin B', type: 'signal', x: 56, y: 10 },
    ],
  },
  {
    type: 'capacitor',
    name: 'Capacitor (Ceramic)',
    category: 'electronic',
    description: 'Non-polarized ceramic disc capacitor',
    defaultWidth: 40,
    defaultHeight: 30,
    defaultProperties: { name: 'Capacitor', rotation: 0, capacitance: 100, storedCapVoltage: 0 },
    pins: [
      { id: 'a', label: '1', type: 'signal', x: 10, y: 22 },
      { id: 'b', label: '2', type: 'signal', x: 30, y: 22 },
    ],
  },
  {
    type: 'electrolytic-capacitor',
    name: 'Electrolytic Cap',
    category: 'electronic',
    description: 'Polarized radial capacitor (Check polarity!)',
    defaultWidth: 30,
    defaultHeight: 60,
    defaultProperties: { name: 'Electrolytic Cap', rotation: 0, capacitance: 1000, voltage: 16, storedCapVoltage: 0 },
    pins: [
      { id: 'pos', label: '+', type: 'signal', x: 8, y: 50, voltageLimit: 16 },
      { id: 'neg', label: '-', type: 'ground', x: 22, y: 50 },
    ],
  },
  {
    type: 'ceramic-capacitor',
    name: 'Ceramic Cap (SMD)',
    category: 'electronic',
    description: 'Generic non-polarized ceramic cap',
    defaultWidth: 40,
    defaultHeight: 20,
    defaultProperties: { name: 'Ceramic Cap', rotation: 0, capacitance: 100 },
    pins: [
      { id: 'a', label: '1', type: 'signal', x: 8, y: 10 },
      { id: 'b', label: '2', type: 'signal', x: 32, y: 10 },
    ],
  },
  {
    type: 'n-mosfet',
    name: 'N-Channel MOSFET',
    category: 'electronic',
    description: 'N-channel power MOSFET (TO-220)',
    defaultWidth: 50,
    defaultHeight: 60,
    defaultProperties: { name: 'N-MOSFET', rotation: 0 },
    pins: [
      { id: 'gate', label: 'G (Gate)', type: 'signal', x: 10, y: 50, direction: 'input', voltageLimit: 20 },
      { id: 'drain', label: 'D (Drain)', type: 'signal', x: 25, y: 50 },
      { id: 'source', label: 'S (Source)', type: 'ground', x: 40, y: 50 },
    ],
  },
  {
    type: 'p-mosfet',
    name: 'P-Channel MOSFET',
    category: 'electronic',
    description: 'P-channel power MOSFET (TO-220)',
    defaultWidth: 50,
    defaultHeight: 60,
    defaultProperties: { name: 'P-MOSFET', rotation: 0 },
    pins: [
      { id: 'gate', label: 'G (Gate)', type: 'signal', x: 10, y: 50, direction: 'input', voltageLimit: 20 },
      { id: 'source', label: 'S (Source)', type: 'power', x: 25, y: 50 },
      { id: 'drain', label: 'D (Drain)', type: 'signal', x: 40, y: 50 },
    ],
  },
  {
    type: 'diode-1n4007',
    name: '1N4007 Diode',
    category: 'electronic',
    description: 'Standard 1A rectifier diode',
    defaultWidth: 50,
    defaultHeight: 20,
    defaultProperties: { name: '1N4007', rotation: 0 },
    pins: [
      { id: 'anode', label: 'A (Anode)', type: 'signal', x: 5, y: 10 },
      { id: 'cathode', label: 'K (Cathode)', type: 'signal', x: 45, y: 10 },
    ],
  },
  {
    type: 'schottky-diode',
    name: 'Schottky Diode',
    category: 'electronic',
    description: 'Low forward voltage drop diode',
    defaultWidth: 50,
    defaultHeight: 20,
    defaultProperties: { name: 'Schottky', rotation: 0 },
    pins: [
      { id: 'anode', label: 'A (Anode)', type: 'signal', x: 5, y: 10 },
      { id: 'cathode', label: 'K (Cathode)', type: 'signal', x: 45, y: 10 },
    ],
  },
  {
    type: 'fuse',
    name: 'Glass Fuse',
    category: 'electronic',
    description: 'Configurable current glass tube fuse',
    defaultWidth: 50,
    defaultHeight: 20,
    defaultProperties: { name: 'Fuse', rotation: 0, currentLimit: 1.0, blown: false }, // 1A fuse limit
    pins: [
      { id: 'a', label: 'Term 1', type: 'signal', x: 6, y: 10 },
      { id: 'b', label: 'Term 2', type: 'signal', x: 44, y: 10 },
    ],
  },
  {
    type: 'terminal-block',
    name: '2-Pin Terminal Block',
    category: 'electronic',
    description: 'Screw terminal block connector',
    defaultWidth: 40,
    defaultHeight: 50,
    defaultProperties: { name: 'Terminal Block', rotation: 0 },
    pins: [
      { id: 'a', label: 'Pin 1', type: 'signal', x: 10, y: 40 },
      { id: 'b', label: 'Pin 2', type: 'signal', x: 30, y: 40 },
    ],
  },
]

export function getComponentDefinition(type: string) {
  return COMPONENT_DEFINITIONS.find((c) => c.type === type)
}

export function getComponentsByCategory(category: ComponentCategory) {
  return COMPONENT_DEFINITIONS.filter((c) => c.category === category)
}

export const DEFAULT_CODE = `// Aircraft Fault-Tolerant System Simulator
// Arduino / ESP32 Code

void setup() {
  Serial.begin(9600);
  pinMode(13, OUTPUT);
  pinMode(2, INPUT_PULLUP);
}

void loop() {
  digitalWrite(13, HIGH);
  delay(500);
  digitalWrite(13, LOW);
  delay(500);
  
  int buttonState = digitalRead(2);
  Serial.println(buttonState);
}
`
