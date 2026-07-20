import type { ComponentType, ComponentProperties } from './components'

export type WireColor =
  | 'red'
  | 'black'
  | 'green'
  | 'yellow'
  | 'blue'
  | 'orange'
  | 'purple'
  | 'white'

export type SimulationStatus = 'idle' | 'running' | 'paused' | 'error'

export type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'serial'

export interface LogEntry {
  id: string
  timestamp: number
  level: LogLevel
  message: string
  source: 'console' | 'serial' | 'simulation'
}

export interface WorkspaceNode {
  id: string
  type: ComponentType
  position: { x: number; y: number }
  properties: ComponentProperties
  selected?: boolean
  zIndex?: number
}

export interface WorkspaceEdge {
  id: string
  sourceNodeId: string
  sourcePinId: string
  targetNodeId: string
  targetPinId: string
  color: WireColor
  thickness?: number        // Wire line width (default: 2)
  label?: string            // Custom wire label
  isLocked?: boolean        // Prevent deleting/moving
  isHidden?: boolean        // Toggle visibility
  curved?: boolean          // Straight/orthogonal vs curved Bezier routing
  bendingPoints?: { x: number; y: number }[]
  data?: {
    color?: string
    thickness?: number
    label?: string
    isLocked?: boolean
    isHidden?: boolean
    curved?: boolean
    bendingPoints?: { x: number; y: number }[]
    currentFlow?: number
  }
  currentFlow?: number      // Current in mA (positive = source to target)
}

export interface PanelSizes {
  leftWidth: number
  rightWidth: number
  bottomHeight: number
}

export type EditorTheme = 'vs-dark' | 'light'

export type BottomPanelTab = 'console' | 'serial' | 'simulation' | 'validation' | 'inspector' | 'oscilloscope' | 'faults' | 'timeline'

export interface ValidationError {
  id: string
  componentId?: string
  pinId?: string
  message: string
  type: 'error' | 'warning'
}

export interface CircuitValidationResults {
  errors: ValidationError[]
  warnings: ValidationError[]
  connectedComponents: string[]
  powerSources: string[]
  groundNets: string[][] // Array of nets connected to GND
  voltageRails: Record<string, number> // Map of net identifier -> voltage
}
