import { useSimulatorStore } from '@/store/useSimulatorStore'
import { getComponentDefinition } from '@/utils/componentDefinitions'
import type { WorkspaceNode, WorkspaceEdge, ComponentType } from '@/types'
import { solveCircuitNew as solveCircuit } from './solver/newCircuitSolver'

// C++ Constants
export const HIGH = 1
export const LOW = 0
export const INPUT = 0
export const OUTPUT = 1
export const INPUT_PULLUP = 2

/**
 * Resolves whatever pin identifier a user sketch passes (e.g. digitalWrite(13, HIGH)
 * -> "13", or digitalWrite(A0, ...) -> "A0") into the *actual* pin ID string used by
 * this board's component definition (e.g. "d13", "a0", "gpio2" — whichever convention
 * componentDefinitions.ts actually declares for this component type).
 *
 * This avoids hardcoding an assumed prefix convention: it looks at the board's real
 * pin list and matches by trailing digits, so it stays correct even if Arduino Uno
 * and ESP32 (or future boards) use different naming schemes internally.
 */
function normalizePinId(nodeType: ComponentType, rawPin: number | string): string {
  const raw = String(rawPin).toLowerCase()
  const def = getComponentDefinition(nodeType)
  if (!def) return raw

  // Exact match already — nothing to do (e.g. sketch already passed "d13" or "a0")
  if (def.pins.some((p) => p.id.toLowerCase() === raw)) {
    return def.pins.find((p) => p.id.toLowerCase() === raw)!.id
  }

  // Extract trailing digits from what the sketch passed (e.g. "13" -> "13", "a0" -> "0")
  const rawDigits = raw.match(/(\d+)$/)?.[1]
  if (rawDigits !== undefined) {
    // Find a real pin on this board whose ID ends in the same digits and is a
    // digital/GPIO-style pin (not power/ground), preferring an exact digit match
    // over a substring coincidence (so "2" doesn't accidentally match "12").
    const candidates = def.pins.filter((p) => {
      const pinDigits = p.id.match(/(\d+)$/)?.[1]
      return pinDigits !== undefined && pinDigits === rawDigits
    })

    // Prefer digital/gpio-typed pins over analog/power/ground if multiple match
    const best =
      candidates.find((p) => p.type === 'digital' || p.type === 'gpio' || p.type === 'bus') ??
      candidates[0]

    if (best) return best.id
  }

  // No confident match found — return as-is and let the solver's undefined-junction
  // guard handle it gracefully (pin simply won't be stamped, rather than throwing).
  return raw
}

/**
 * Perform BFS electrical continuity trace to determine the digital logic level of a pin.
 */
export function getPinNetState(
  nodes: WorkspaceNode[],
  edges: WorkspaceEdge[],
  targetNodeId: string,
  targetPinId: string,
  gpioPinStates: Record<string, Record<string, any>>
): 'HIGH' | 'LOW' {
  const activeFaults = useSimulatorStore.getState().activeFaults || {}
  const solution = solveCircuit(nodes, edges, gpioPinStates, activeFaults)
  const volt = solution.nodeVoltages[`${targetNodeId}:${targetPinId}`] || 0.0

  if (volt >= 1.5) return 'HIGH'

  // If pin has an internal pull-up and isn't grounded, it floats HIGH
  const isGrounded = solution.nodeGND[`${targetNodeId}:${targetPinId}`] || false
  const pinState = gpioPinStates[targetNodeId]?.[targetPinId]
  if (pinState === 'INPUT_PULLUP' && !isGrounded) return 'HIGH'

  return 'LOW'
}

/**
 * Creates the global context environment for executing compiled Arduino / ESP32 code.
 */
export function createSimulationContext(
  nodeId: string,
  simStartRealTime: number,
  getSpeedRatio: () => number,
  onPinStateChange?: (pinId: string, value: any) => void
) {
  const store = useSimulatorStore.getState()

  // Resolve the board's component type once, so every GPIO call below can
  // normalize pin IDs against its real pin list instead of guessing a prefix.
  const boardNode = store.nodes.find((n) => n.id === nodeId)
  const boardType = (boardNode?.type ?? 'arduino-uno') as ComponentType

  const resolvePin = (pin: number | string): string => normalizePinId(boardType, pin)

  let lastYield = performance.now()

  const setPinState = (pinStr: string, value: any) => {
    if (onPinStateChange) {
      onPinStateChange(pinStr, value)
    } else {
      store.updateGpioPinState(nodeId, pinStr, value)
    }
  }

  return {
    _yield: async () => {
      const now = performance.now()
      if (now - lastYield > 50) {
        await new Promise<void>((resolve) => setTimeout(resolve, 0))
        lastYield = performance.now()
      }
    },
    // Mode Constants
    HIGH,
    LOW,
    INPUT,
    OUTPUT,
    INPUT_PULLUP,

    // OLED Constants
    SSD1306_WHITE: 1,
    SSD1306_BLACK: 0,
    SH110X_WHITE: 1,
    SH110X_BLACK: 0,

    // I2C Wire mock
    Wire: {
      begin: () => {},
      beginTransmission: () => {},
      write: () => {},
      endTransmission: () => 0,
      requestFrom: () => {},
    },

    // Timing APIs
    millis: () => Math.floor((Date.now() - simStartRealTime) * getSpeedRatio()),
    micros: () => Math.floor((Date.now() - simStartRealTime) * 1000 * getSpeedRatio()),
    delay: (ms: number) => new Promise<void>((resolve) => {
      const speed = getSpeedRatio()
      setTimeout(resolve, speed === Infinity ? 0 : ms / speed)
    }),
    delayMicroseconds: (us: number) => new Promise<void>((resolve) => {
      const speed = getSpeedRatio()
      setTimeout(resolve, speed === Infinity ? 0 : (us / 1000) / speed)
    }),

    // GPIO APIs — every pin argument is resolved against the board's real
    // pin list before touching the store, so keys written here always match
    // the keys the solver looks up (fixes the digitalWrite -> solver mismatch).
    pinMode: (pin: number | string, mode: number) => {
      const pinStr = resolvePin(pin)
      const modeStr = mode === INPUT ? 'INPUT' : mode === OUTPUT ? 'OUTPUT' : 'INPUT_PULLUP'
      setPinState(pinStr, modeStr)
    },
    digitalWrite: (pin: number | string, val: number) => {
      const pinStr = resolvePin(pin)
      setPinState(pinStr, val === HIGH ? 'HIGH' : 'LOW')
    },
    digitalRead: (pin: number | string) => {
      const pinStr = resolvePin(pin)
      const state = getPinNetState(store.nodes, store.edges, nodeId, pinStr, store.gpioPinStates)
      return state === 'HIGH' ? HIGH : LOW
    },

    // Analog & PWM APIs
    analogWrite: (pin: number | string, val: number) => {
      // PWM value is 0-255. Convert to fraction/number representation
      setPinState(resolvePin(pin), val)
    },
    analogRead: (pin: number | string) => {
      // Find what sensor is connected to this analog pin, and return its value mapped to 0-1023
      const pinStr = resolvePin(pin).toLowerCase()
      // Let's resolve the net connected to this pin
      const startPin = `${nodeId}:${pinStr}`
      const visited = new Set<string>()
      const queue = [startPin]
      let sensorNode: WorkspaceNode | null = null

      while (queue.length > 0) {
        const current = queue.shift()!
        if (visited.has(current)) continue
        visited.add(current)

        const [currNodeId] = current.split(':')
        const node = store.nodes.find(n => n.id === currNodeId)
        if (node && (node.type === 'lm35' || node.type === 'potentiometer' || node.type === 'battery-12v')) {
          sensorNode = node
          break
        }

        // Trace wires
        store.edges.forEach((edge) => {
          const pA = `${edge.sourceNodeId}:${edge.sourcePinId}`
          const pB = `${edge.targetNodeId}:${edge.targetPinId}`
          if (pA === current) queue.push(pB)
          if (pB === current) queue.push(pA)
        })
      }

      if (sensorNode) {
        const activeFaults = store.activeFaults || {}
        if (sensorNode.type === 'lm35') {
          if (activeFaults['lm35-disconnect']) {
            return 0
          }
          let temp = Number(sensorNode.properties.temperature || 25)
          if (activeFaults['lm35-freeze']) {
            temp = 80
          }
          if (activeFaults['lm35-noise']) {
            temp += (Math.random() - 0.5) * 15
          }
          if (activeFaults['lm35-drift']) {
            const simTime = store.simulationDiagnostics.executionTime / 1000
            temp += simTime * 0.5
          }

          const voltage = temp * 0.01
          return Math.max(0, Math.min(1023, Math.floor((voltage / 5.0) * 1023)))
        }
        if (sensorNode.type === 'potentiometer') {
          const resistance = Number(sensorNode.properties.resistance || 500)
          return Math.floor((resistance / 10000) * 1023)
        }
        if (sensorNode.type === 'battery-12v') {
          const volt = Number(sensorNode.properties.voltage || 12)
          return Math.floor((volt / 15.0) * 1023)
        }
      }

      return 0
    },
    tone: (pin: number | string, frequency: number) => {
      setPinState(resolvePin(pin), frequency)
    },
    noTone: (pin: number | string) => {
      setPinState(resolvePin(pin), 0)
    },

    // Serial
    Serial: {
      begin: (baud: number) => {
        store.addLog('info', `Serial interface initialized at ${baud} baud.`, 'serial')
      },
      print: (val: any) => {
        store.addLog('serial', String(val), 'serial')
      },
      println: (val: any) => {
        store.addLog('serial', String(val), 'serial')
      },
      available: () => 0,
      read: () => -1,
      write: (val: any) => {
        store.addLog('serial', String(val), 'serial')
      },
    },

    // LCD1602 Class
    LiquidCrystal_I2C: class {
      addr: number
      cols: number
      rows: number
      backlightState = true
      displayBuffer: string[][]
      cursorCol = 0
      cursorRow = 0

      constructor(addr: number, cols: number, rows: number) {
        this.addr = addr
        this.cols = cols
        this.rows = rows
        this.displayBuffer = Array.from({ length: rows }, () => Array(cols).fill(' '))
      }

      init() { this.clear() }
      begin() { this.clear() }
      backlight() {
        this.backlightState = true
        this.updateStore()
      }
      noBacklight() {
        this.backlightState = false
        this.updateStore()
      }
      clear() {
        this.displayBuffer = Array.from({ length: this.rows }, () => Array(this.cols).fill(' '))
        this.cursorCol = 0
        this.cursorRow = 0
        this.updateStore()
      }
      home() {
        this.cursorCol = 0
        this.cursorRow = 0
      }
      setCursor(col: number, row: number) {
        this.cursorCol = Math.max(0, Math.min(this.cols - 1, col))
        this.cursorRow = Math.max(0, Math.min(this.rows - 1, row))
      }
      print(val: any) {
        const str = String(val)
        for (let i = 0; i < str.length; i++) {
          if (this.cursorCol >= this.cols) break
          this.displayBuffer[this.cursorRow][this.cursorCol] = str[i]
          this.cursorCol++
        }
        this.updateStore()
      }
      updateStore() {
        const lcdNode = store.nodes.find(n => n.type === 'lcd1602')
        if (lcdNode) {
          store.updateNodeProperties(lcdNode.id, {
            displayBuffer: this.displayBuffer,
            backlight: this.backlightState
          })
        }
      }
    },

    // DHT Class
    DHT: class {
      pin: number
      type: number
      constructor(pin: number, type: number) {
        this.pin = pin
        this.type = type
      }
      begin() {}
      readTemperature() {
        const activeFaults = store.activeFaults || {}
        if (activeFaults['dht22-failure']) return -999.0
        const node = store.nodes.find(n => n.type === 'dht22')
        let temp = node?.properties.temperature !== undefined ? Number(node.properties.temperature) : 25.0
        if (activeFaults['dht22-noise']) {
          temp += (Math.random() - 0.5) * 10
        }
        return temp
      }
      readHumidity() {
        const activeFaults = store.activeFaults || {}
        if (activeFaults['dht22-failure']) return -999.0
        const node = store.nodes.find(n => n.type === 'dht22')
        let hum = node?.properties.humidity !== undefined ? Number(node.properties.humidity) : 50.0
        if (activeFaults['dht22-noise']) {
          hum += (Math.random() - 0.5) * 15
        }
        return Math.max(0, Math.min(100, hum))
      }
    },

    // DS18B20/OneWire Classes
    OneWire: class {
      pin: number
      constructor(pin: number) {
        this.pin = pin
      }
    },
    DallasTemperature: class {
      oneWire: any
      constructor(oneWire: any) {
        this.oneWire = oneWire
      }
      begin() {}
      requestTemperatures() {}
      getTempCByIndex(_idx: number) {
        const activeFaults = store.activeFaults || {}
        if (activeFaults['ds18b20-failure']) return -999.0
        const node = store.nodes.find(n => n.type === 'ds18b20')
        let temp = node?.properties.temperature !== undefined ? Number(node.properties.temperature) : 25.0
        if (activeFaults['ds18b20-noise']) {
          temp += (Math.random() - 0.5) * 8
        }
        return temp
      }
    },

    // OLED Classes
    Adafruit_SSD1306: class {
      width: number
      height: number
      cursorX = 0
      cursorY = 0
      textSize = 1
      textColor = 1
      displayLines: string[] = []

      constructor(width?: any, height?: any, _wire?: any, _resetPin?: any) {
        this.width = typeof width === 'number' ? width : 128
        this.height = typeof height === 'number' ? height : 64
      }

      begin() { this.clearDisplay() }
      init() { this.clearDisplay() }
      clearDisplay() {
        this.displayLines = []
        this.cursorX = 0
        this.cursorY = 0
        this.updateStore()
      }
      clear() { this.clearDisplay() }
      display() { this.updateStore() }
      show() { this.updateStore() }

      setTextSize(size: number) { this.textSize = size || 1 }
      setTextColor(color: number) { this.textColor = color }
      setCursor(x: number, y: number) {
        this.cursorX = x
        this.cursorY = y
      }

      print(val: any) {
        const str = String(val)
        const lineIdx = Math.floor(this.cursorY / (8 * this.textSize))
        while (this.displayLines.length <= lineIdx) {
          this.displayLines.push('')
        }

        const charWidth = 6 * this.textSize
        const charCol = Math.floor(this.cursorX / charWidth)
        let line = this.displayLines[lineIdx]
        if (line.length < charCol) {
          line = line.padEnd(charCol, ' ')
        }

        const before = line.substring(0, charCol)
        const after = line.substring(charCol + str.length)
        this.displayLines[lineIdx] = before + str + after

        this.cursorX += str.length * charWidth
      }

      println(val?: any) {
        if (val !== undefined) {
          this.print(val)
        }
        this.cursorX = 0
        this.cursorY += 8 * this.textSize
      }

      updateStore() {
        const currentStore = useSimulatorStore.getState()
        const oledNode = currentStore.nodes.find(n => n.type === 'oled')
        if (oledNode) {
          currentStore.updateNodeProperties(oledNode.id, {
            displayLines: [...this.displayLines]
          })
        }
      }
    },
    Adafruit_SH1106G: class {
      width: number
      height: number
      cursorX = 0
      cursorY = 0
      textSize = 1
      textColor = 1
      displayLines: string[] = []

      constructor(width?: any, height?: any, _wire?: any, _resetPin?: any) {
        this.width = typeof width === 'number' ? width : 128
        this.height = typeof height === 'number' ? height : 64
      }

      begin() { this.clearDisplay() }
      init() { this.clearDisplay() }
      clearDisplay() {
        this.displayLines = []
        this.cursorX = 0
        this.cursorY = 0
        this.updateStore()
      }
      clear() { this.clearDisplay() }
      display() { this.updateStore() }
      show() { this.updateStore() }

      setTextSize(size: number) { this.textSize = size || 1 }
      setTextColor(color: number) { this.textColor = color }
      setCursor(x: number, y: number) {
        this.cursorX = x
        this.cursorY = y
      }

      print(val: any) {
        const str = String(val)
        const lineIdx = Math.floor(this.cursorY / (8 * this.textSize))
        while (this.displayLines.length <= lineIdx) {
          this.displayLines.push('')
        }

        const charWidth = 6 * this.textSize
        const charCol = Math.floor(this.cursorX / charWidth)
        let line = this.displayLines[lineIdx]
        if (line.length < charCol) {
          line = line.padEnd(charCol, ' ')
        }

        const before = line.substring(0, charCol)
        const after = line.substring(charCol + str.length)
        this.displayLines[lineIdx] = before + str + after

        this.cursorX += str.length * charWidth
      }

      println(val?: any) {
        if (val !== undefined) {
          this.print(val)
        }
        this.cursorX = 0
        this.cursorY += 8 * this.textSize
      }

      updateStore() {
        const currentStore = useSimulatorStore.getState()
        const oledNode = currentStore.nodes.find(n => n.type === 'oled')
        if (oledNode) {
          currentStore.updateNodeProperties(oledNode.id, {
            displayLines: [...this.displayLines]
          })
        }
      }
    }
  }
}