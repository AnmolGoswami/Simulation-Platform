export type ComponentCategory =
  | 'boards'
  | 'power'
  | 'sensors'
  | 'outputs'
  | 'control'
  | 'electronic'
  | 'connection'

export type ComponentType =
  | 'esp32-devkit'
  | 'arduino-uno'
  | 'breadboard'
  | 'power-supply-5v'
  | 'battery-9v'
  | 'battery-12v'
  | 'ground'
  | 'super-capacitor'
  | 'lm7805'
  | 'lm35'
  | 'dht22'
  | 'ds18b20'
  | 'led'
  | 'rgb-led'
  | 'bulb'
  | 'lcd1602'
  | 'oled'
  | 'buzzer'
  | 'pc-fan'
  | 'dc-motor'
  | 'push-button'
  | 'toggle-switch' // Legacy generic toggle switch
  | 'toggle-switch-spst'
  | 'toggle-switch-spdt'
  | 'toggle-switch-dpdt'
  | 'slide-switch-spst'
  | 'slide-switch-spdt'
  | 'slide-switch-dpdt'
  | 'dip-switch-2'
  | 'dip-switch-4'
  | 'dip-switch-8'
  | 'usb-breakout'
  | 'dc-jack'
  | 'battery-snap-9v'
  | 'battery-18650'
  | 'holder-18650'
  | 'ups-module-5v'
  | 'terminal-strip-4'
  | 'terminal-strip-8'
  | 'relay'
  | 'potentiometer'
  | 'resistor'
  | 'capacitor'
  | 'electrolytic-capacitor'
  | 'ceramic-capacitor'
  | 'n-mosfet'
  | 'p-mosfet'
  | 'diode-1n4007'
  | 'schottky-diode'
  | 'fuse'
  | 'terminal-block'
  | 'jumper-wire'

export interface PinDefinition {
  id: string
  label: string
  type: 'power' | 'ground' | 'gpio' | 'analog' | 'digital' | 'signal' | 'bus'
  x: number
  y: number
  voltageLimit?: number    // Max tolerated voltage (e.g. 3.3 for ESP32, 5.0 for Uno)
  currentLimit?: number    // Max source/sink current (e.g. 0.04 for Uno GPIO)
  isPWM?: boolean
  isAnalog?: boolean
  direction?: 'input' | 'output' | 'bidirectional'
}

export interface ComponentProperties {
  name: string
  rotation: number
  gpio?: number
  voltage?: number
  resistance?: number
  capacitance?: number
  color?: string
  state?: boolean | number | string | Record<string, boolean> // Switch toggle positions, switch state etc.
  [key: string]: unknown
}

export interface ComponentDefinition {
  type: ComponentType
  name: string
  category: ComponentCategory
  description: string
  defaultWidth: number
  defaultHeight: number
  defaultProperties: ComponentProperties
  pins: PinDefinition[]
}
