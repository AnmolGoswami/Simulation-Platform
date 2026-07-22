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
export const INPUT_PULLDOWN = 3
export const LED_BUILTIN = 13
export const A0 = 'A0'
export const A1 = 'A1'
export const A2 = 'A2'
export const A3 = 'A3'
export const A4 = 'A4'
export const A5 = 'A5'
export const A6 = 'A6'
export const A7 = 'A7'
export const A8 = 'A8'
export const A9 = 'A9'
export const A10 = 'A10'
export const A11 = 'A11'
export const A12 = 'A12'
export const A13 = 'A13'
export const A14 = 'A14'
export const A15 = 'A15'

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
 * Resolves the simulated voltage of any pin using the circuit solver.
 */
export function getPinVoltage(
  nodes: WorkspaceNode[],
  edges: WorkspaceEdge[],
  targetNodeId: string,
  targetPinId: string,
  gpioPinStates: Record<string, Record<string, any>>
): number {
  const activeFaults = useSimulatorStore.getState().activeFaults || {}
  const solution = solveCircuit(nodes, edges, gpioPinStates, activeFaults)
  return solution.nodeVoltages[`${targetNodeId}:${targetPinId}`] || 0.0
}

/**
 * Global timer registries for all active simulation contexts to guarantee exact cleanup on reset/stop.
 */
const globalActiveIntervals = new Set<any>()
const globalActiveTimeouts = new Set<any>()

export function cleanupGlobalSimulationTimers() {
  globalActiveIntervals.forEach((id) => clearInterval(id))
  globalActiveIntervals.clear()
  globalActiveTimeouts.forEach((id) => clearTimeout(id))
  globalActiveTimeouts.clear()
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
  const store = new Proxy({} as ReturnType<typeof useSimulatorStore.getState>, {
    get(_, prop) {
      const liveState = useSimulatorStore.getState()
      const val = (liveState as any)[prop]
      return typeof val === 'function' ? val.bind(liveState) : val
    }
  })

  // Resolve the board's component type once, so every GPIO call below can
  // normalize pin IDs against its real pin list instead of guessing a prefix.
  const boardNode = store.nodes.find((n) => n.id === nodeId)
  const boardType = (boardNode?.type ?? 'arduino-uno') as ComponentType

  const resolvePin = (pin: number | string): string => normalizePinId(boardType, pin)

  let lastYield = performance.now()
  let _isAborted = false
  const activeIntervals = new Set<any>()
  const activeTimeouts = new Set<any>()

  const setPinState = (pinStr: string, value: any) => {
    if (onPinStateChange) {
      onPinStateChange(pinStr, value)
    } else {
      store.updateGpioPinState(nodeId, pinStr, value)
    }
  }

  const ledcChannels: Record<number, string | number> = {}

  // Buffers text written via Serial.print()/write() and only emits a log
  // line on Serial.println() (or when the buffer already has content
  // flushed) — mirrors how a real Serial monitor renders one logical line
  // per println(), instead of one log entry per print()/println() call.
  let serialLineBuffer = ''

  let currentAdcBits = boardType.includes('esp32') ? 12 : 10
  const getAdcMax = () => (1 << currentAdcBits) - 1
  const getVRef = () => boardType.includes('esp32') ? 3.3 : 5.0

  const analogReadImpl = (pin: number | string) => {
    const pinStr = resolvePin(pin).toLowerCase()
    const startPin = `${nodeId}:${pinStr}`
    const visited = new Set<string>()
    const queue = [startPin]
    let sensorNode: WorkspaceNode | null = null

    while (queue.length > 0) {
      const current = queue.shift()!
      if (visited.has(current)) continue
      visited.add(current)

      const [currNodeId, currPinId] = current.split(':')
      const node = store.nodes.find(n => n.id === currNodeId)
      if (node) {
        if (node.type === 'lm35' || node.type === 'potentiometer' || node.type === 'battery-12v' || node.type === 'super-capacitor' || node.type === 'capacitor' || node.type === 'electrolytic-capacitor' || node.type === 'ceramic-capacitor') {
          sensorNode = node
          break
        }

        // Pass-through internal connections across switches and fuses
        const activeFaults = store.activeFaults || {}
        if (node.type.startsWith('toggle-switch-spst') || node.type.startsWith('slide-switch-spst')) {
          const isClosed = node.properties.state === true || node.properties.state === 'true'
          if (isClosed) {
            if (currPinId === 'a') queue.push(`${currNodeId}:b`)
            if (currPinId === 'b') queue.push(`${currNodeId}:a`)
          }
        } else if (node.type.startsWith('toggle-switch-spdt') || node.type.startsWith('slide-switch-spdt') || node.type === 'toggle-switch') {
          const isNc = node.properties.state === 'nc' || node.properties.state === false
          if (currPinId === 'com') queue.push(`${currNodeId}:${isNc ? 'nc' : 'no'}`)
          if (currPinId === 'nc' && isNc) queue.push(`${currNodeId}:com`)
          if (currPinId === 'no' && !isNc) queue.push(`${currNodeId}:com`)
        } else if (node.type === 'fuse') {
          const isBlown = activeFaults['fuse-blown'] || (node.properties.blown as boolean) || false
          if (!isBlown) {
            if (currPinId === 'a') queue.push(`${currNodeId}:b`)
            if (currPinId === 'b') queue.push(`${currNodeId}:a`)
          }
        } else if (node.type === 'diode-1n4007' || node.type === 'schottky-diode') {
          if (currPinId === 'cathode') queue.push(`${currNodeId}:anode`)
        } else if (node.type === 'resistor') {
          if (currPinId === 'a') queue.push(`${currNodeId}:b`)
          if (currPinId === 'b') queue.push(`${currNodeId}:a`)
        }
      }

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
        const maxAdc = getAdcMax()
        return Math.min(maxAdc, Math.floor((voltage / getVRef()) * maxAdc))
      }
      if (sensorNode.type === 'potentiometer') {
        const resistance = Number(sensorNode.properties.resistance || 500)
        return Math.floor((resistance / 10000) * getAdcMax())
      }
      if (sensorNode.type === 'battery-12v') {
        const volt = Number(sensorNode.properties.voltage || 12)
        const maxAdc = getAdcMax()
        return Math.min(maxAdc, Math.floor(((volt / 4.03) / getVRef()) * maxAdc))
      }
      if (sensorNode.type === 'super-capacitor') {
        const volt = Number(sensorNode.properties.storedVoltage ?? sensorNode.properties.voltage ?? 0)
        const maxAdc = getAdcMax()
        return Math.max(0, Math.min(maxAdc, Math.floor(((volt / 5.545) / getVRef()) * maxAdc)))
      }
      if (sensorNode.type === 'capacitor' || sensorNode.type === 'electrolytic-capacitor' || sensorNode.type === 'ceramic-capacitor') {
        const volt = Number(sensorNode.properties.storedCapVoltage ?? 0)
        const maxAdc = getAdcMax()
        return Math.max(0, Math.min(maxAdc, Math.floor((volt / getVRef()) * maxAdc)))
      }
    }

    if (pinStr === 'gpio34' || pinStr === '34' || pinStr === 'gpio35' || pinStr === '35' || pinStr === 'gpio33' || pinStr === '33') {
      return 0
    }

    const solverVolt = getPinVoltage(store.nodes, store.edges, nodeId, pinStr, store.gpioPinStates)
    if (solverVolt > 0.001) {
      const maxAdc = getAdcMax()
      return Math.max(0, Math.min(maxAdc, Math.floor((solverVolt / getVRef()) * maxAdc)))
    }
    return 0
  }

  return {
    _cleanup: () => {
      _isAborted = true
      activeIntervals.forEach((id) => { clearInterval(id); globalActiveIntervals.delete(id) })
      activeIntervals.clear()
      activeTimeouts.forEach((id) => { clearTimeout(id); globalActiveTimeouts.delete(id) })
      activeTimeouts.clear()
    },
    get _isAborted() { return _isAborted },
    _yield: async () => {
      if (_isAborted) return
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
    INPUT_PULLDOWN,
    LED_BUILTIN,

    // Analog Pin Constants
    A0,
    A1,
    A2,
    A3,
    A4,
    A5,
    A6,
    A7,
    A8,
    A9,
    A10,
    A11,
    A12,
    A13,
    A14,
    A15,

    // ESP32 ADC & Interrupt constants
    ADC_11db: 3,
    FALLING: 2,

    // OLED Constants
    SSD1306_WHITE: 1,
    SSD1306_BLACK: 0,
    SH110X_WHITE: 1,
    SH110X_BLACK: 0,

    // Arduino byte(x) cast — clamps/wraps a value into the 0-255 range,
    // matching the real language's `byte` type conversion. Needed for
    // sketches that do things like `lcd.write(byte(1))`.
    byte: (val: number) => val & 0xff,

    // Interrupt enable/disable — real hardware pauses/resumes the global
    // interrupt controller; there's nothing to pause here since interrupt
    // callbacks are just a setInterval (see attachInterrupt below), so
    // these are safe no-ops. Without them, any sketch that briefly guards
    // a shared variable (e.g. `noInterrupts(); x = counter; interrupts();`)
    // — a very common Arduino pattern — throws "is not defined".
    noInterrupts: () => {},
    interrupts: () => {},

    // Common Arduino built-in globals that are macros/functions in the
    // real language but don't exist as bare globals in JS. Added so
    // ordinary sketches (this one uses abs(); others commonly use the
    // rest) don't crash one missing-function at a time.
    abs: (val: number) => Math.abs(val),
    min: (a: number, b: number) => Math.min(a, b),
    max: (a: number, b: number) => Math.max(a, b),
    constrain: (val: number, low: number, high: number) => Math.min(Math.max(val, low), high),
    map: (val: number, inMin: number, inMax: number, outMin: number, outMax: number) =>
      ((val - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin,
    sq: (val: number) => val * val,
    random: (a: number, b?: number) => {
      // Arduino's random(max) or random(min, max), both integer, exclusive of max
      const [lo, hi] = b === undefined ? [0, a] : [a, b]
      return Math.floor(Math.random() * (hi - lo)) + lo
    },

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
      if (_isAborted) { resolve(); return }
      const speed = getSpeedRatio()
      const timeoutId = setTimeout(() => {
        activeTimeouts.delete(timeoutId)
        globalActiveTimeouts.delete(timeoutId)
        resolve()
      }, speed === Infinity ? 0 : ms / speed)
      activeTimeouts.add(timeoutId)
      globalActiveTimeouts.add(timeoutId)
    }),
    delayMicroseconds: (us: number) => new Promise<void>((resolve) => {
      if (_isAborted) { resolve(); return }
      const speed = getSpeedRatio()
      const timeoutId = setTimeout(() => {
        activeTimeouts.delete(timeoutId)
        globalActiveTimeouts.delete(timeoutId)
        resolve()
      }, speed === Infinity ? 0 : (us / 1000) / speed)
      activeTimeouts.add(timeoutId)
      globalActiveTimeouts.add(timeoutId)
    }),

    // GPIO APIs — every pin argument is resolved against the board's real
    // pin list before touching the store, so keys written here always match
    // the keys the solver looks up (fixes the digitalWrite -> solver mismatch).
    pinMode: (pin: number | string, mode: number) => {
      const pinStr = resolvePin(pin)
      const modeStr =
        mode === INPUT
          ? 'INPUT'
          : mode === OUTPUT
          ? 'OUTPUT'
          : mode === INPUT_PULLUP
          ? 'INPUT_PULLUP'
          : 'INPUT_PULLDOWN'
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
    analogRead: analogReadImpl,
    analogReadResolution: (res: number) => {
      if (res >= 8 && res <= 16) {
        currentAdcBits = res
      }
    },
    analogSetAttenuation: (_att: number) => {},
    analogReadMilliVolts: (pin: number | string) => {
      const val = analogReadImpl(pin)
      const maxAdc = getAdcMax()
      return Math.floor((val / maxAdc) * (getVRef() * 1000))
    },

    // PWM ledc APIs
    ledcSetup: (_channel: number, _freq: number, _resolution: number) => {},
    ledcAttachPin: (pin: number | string, channel: number) => {
      ledcChannels[channel] = pin
    },
    ledcWrite: (channel: number, val: number) => {
      const pin = ledcChannels[channel]
      if (pin !== undefined) {
        const pinStr = resolvePin(pin)
        setPinState(pinStr, 'OUTPUT')
        setPinState(pinStr, val)
      }
    },

    // Interrupt APIs
    digitalPinToInterrupt: (pin: any) => pin,
    attachInterrupt: (_pin: any, callback: () => void, _mode: any) => {
      // Run the callback periodically in a setInterval to simulate hardware tachometer pulses!
      let pulseAccumulator = 0
      const interval = setInterval(() => {
        if (_isAborted || useSimulatorStore.getState().simulationStatus !== 'running') {
          clearInterval(interval)
          activeIntervals.delete(interval)
          globalActiveIntervals.delete(interval)
          return
        }
        const storeInstance = useSimulatorStore.getState()
        const fanNode = storeInstance.nodes.find(n => n.type === 'pc-fan' || n.type === 'dc-motor')
        const rpm = Number(fanNode?.properties?.rpm ?? 0)

        if (rpm > 0) {
          pulseAccumulator += rpm / 1500
          while (pulseAccumulator >= 1) {
            pulseAccumulator -= 1
            try {
              callback()
            } catch (e) {
              // ignore
            }
          }
        } else {
          pulseAccumulator = 0
        }
      }, 20)
      activeIntervals.add(interval)
      globalActiveIntervals.add(interval)
    },

    // String formatting
    dtostrf: (val: number, width: number, precision: number, buf: any[]) => {
      const str = val.toFixed(precision)
      const padded = str.padStart(width)
      buf.length = 0
      for (let i = 0; i < padded.length; i++) {
        buf.push(padded[i])
      }
      buf.toString = () => padded
      buf.join = () => padded
    },

    tone: (pin: number | string, frequency: number) => {
      setPinState(resolvePin(pin), frequency)
    },
    noTone: (pin: number | string) => {
      setPinState(resolvePin(pin), 0)
    },

    // Serial — buffers text from print()/write() and only emits a log
    // line on println() (matching how a real Serial monitor renders
    // output). Previously every print()/println() call logged its own
    // line, which split single logical lines like
    // "Active source: SUPERCAP (EMERGENCY)" into two separate log rows,
    // and also stringified a no-arg println() (a blank-line separator)
    // into the literal text "undefined".
    Serial: {
      begin: (baud: number) => {
        serialLineBuffer = ''
        store.addLog('info', `Serial interface initialized at ${baud} baud.`, 'serial')
      },
      print: (val?: any, arg2?: any) => {
        if (val !== undefined) {
          if (typeof val === 'number' && typeof arg2 === 'number') {
            if (!Number.isInteger(val) && arg2 >= 0 && arg2 <= 10) {
              serialLineBuffer += val.toFixed(arg2)
            } else if (Number.isInteger(val) && [2, 8, 10, 16].includes(arg2)) {
              serialLineBuffer += val.toString(arg2).toUpperCase()
            } else {
              serialLineBuffer += val.toFixed(arg2 >= 0 && arg2 <= 10 ? arg2 : 2)
            }
          } else {
            serialLineBuffer += String(val)
          }
        }
      },
      println: (val?: any, arg2?: any) => {
        if (val !== undefined) {
          if (typeof val === 'number' && typeof arg2 === 'number') {
            if (!Number.isInteger(val) && arg2 >= 0 && arg2 <= 10) {
              serialLineBuffer += val.toFixed(arg2)
            } else if (Number.isInteger(val) && [2, 8, 10, 16].includes(arg2)) {
              serialLineBuffer += val.toString(arg2).toUpperCase()
            } else {
              serialLineBuffer += val.toFixed(arg2 >= 0 && arg2 <= 10 ? arg2 : 2)
            }
          } else {
            serialLineBuffer += String(val)
          }
        }
        store.addLog('serial', serialLineBuffer, 'serial')
        serialLineBuffer = ''
      },
      printf: (fmt?: any, ...args: any[]) => {
        if (typeof fmt !== 'string') return
        let i = 0
        const formatted = fmt.replace(/%([0-9A-Za-z.\-]+)/g, (match, spec) => {
          if (match === '%%') return '%'
          const arg = args[i++]
          if (arg === undefined) return match
          if (spec.includes('f')) {
            const precMatch = spec.match(/\.(\d+)f/)
            const prec = precMatch ? parseInt(precMatch[1], 10) : 6
            const num = typeof arg === 'number' ? arg : parseFloat(arg)
            return !isNaN(num) ? num.toFixed(prec) : String(arg)
          }
          if (spec.includes('d') || spec.includes('i')) {
            const num = typeof arg === 'number' ? arg : parseInt(arg, 10)
            return !isNaN(num) ? String(Math.floor(num)) : String(arg)
          }
          if (spec.includes('x') || spec.includes('X')) {
            const num = typeof arg === 'number' ? arg : parseInt(arg, 10)
            return !isNaN(num) ? Math.floor(num).toString(16).toUpperCase() : String(arg)
          }
          if (spec.includes('s')) {
            return String(arg)
          }
          return String(arg)
        })
        const parts = (serialLineBuffer + formatted).split('\n')
        serialLineBuffer = parts.pop() || ''
        for (const line of parts) {
          store.addLog('serial', line, 'serial')
        }
      },
      available: () => 0,
      read: () => -1,
      write: (val?: any) => {
        serialLineBuffer += val === undefined ? '' : String(val)
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
      // Custom character glyphs registered via createChar(), keyed by the
      // 0-7 index the sketch used. Each value is the raw 8-byte bitmap
      // passed in — kept around in case a richer LCD renderer wants to
      // draw the actual pixel pattern rather than a stand-in glyph.
      customChars: Record<number, number[]> = {}

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

      // Registers an 8-byte custom glyph bitmap under index 0-7, matching
      // the real LiquidCrystal_I2C::createChar(uint8_t, uint8_t[]).
      createChar(index: number, bitmap: number[]) {
        this.customChars[index & 0x7] = Array.isArray(bitmap) ? [...bitmap] : []
      }

      // lcd.write(byte(n)) writes a *raw* character code rather than
      // printable text. Codes 0-7 render whatever glyph was registered
      // via createChar (shown here as a stand-in symbol, since this is a
      // text-buffer display rather than a pixel-level one); any other
      // code falls back to its printable ASCII character.
      write(val: number) {
        if (this.cursorCol >= this.cols) return
        const code = val & 0xff
        const glyph = code >= 0 && code <= 7 ? this.customChars[code] : undefined
        const ch = glyph ? '\u25A0' /* ▪ stand-in for a registered custom icon */ : String.fromCharCode(code)
        this.displayBuffer[this.cursorRow][this.cursorCol] = ch
        this.cursorCol++
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