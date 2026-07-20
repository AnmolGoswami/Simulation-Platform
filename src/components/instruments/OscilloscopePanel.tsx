import { useState } from 'react'
import { useSimulatorStore } from '@/store/useSimulatorStore'
import { getComponentDefinition } from '@/utils/componentDefinitions'
import { Activity, Trash2, Snowflake } from 'lucide-react'

export function OscilloscopePanel() {
  const nodes = useSimulatorStore((s) => s.nodes)
  const probedPins = useSimulatorStore((s) => s.probedPins)
  const togglePinProbe = useSimulatorStore((s) => s.togglePinProbe)
  const waveformBuffers = useSimulatorStore((s) => s.waveformBuffers)

  const [timeScale, setTimeScale] = useState(1.0) // Zoom X
  const [voltScale, setVoltScale] = useState(1.0) // Zoom Y
  const [frozen, setFrozen] = useState(false)
  const [frozenBuffers, setFrozenBuffers] = useState<typeof waveformBuffers>({})

  // Gather list of pins to display in the selector dropdown
  const mcuNodes = nodes.filter(n => n.type === 'arduino-uno' || n.type === 'esp32-devkit')
  const availablePins: { key: string; label: string }[] = []
  
  mcuNodes.forEach(mcu => {
    const def = getComponentDefinition(mcu.type)
    if (!def) return
    def.pins.forEach(pin => {
      if (pin.type === 'digital' || pin.type === 'analog' || pin.type === 'gpio') {
        availablePins.push({
          key: `${mcu.id}:${pin.id}`,
          label: `${mcu.properties.name || def.name} - Pin ${pin.label} (${pin.id})`
        })
      }
    })
  })

  const toggleFreeze = () => {
    if (!frozen) {
      // Snapshot current state
      setFrozenBuffers(JSON.parse(JSON.stringify(waveformBuffers)))
    }
    setFrozen(!frozen)
  }

  const activeBuffers = frozen ? frozenBuffers : waveformBuffers

  // Channel colors
  const colors = ['#f59e0b', '#22d3ee', '#ec4899', '#22c55e']

  // SVG grid sizing
  const width = 600
  const height = 180

  const drawPath = (pinKey: string): string => {
    const buffer = activeBuffers[pinKey] || []
    if (buffer.length < 2) return ''

    // Map points to SVG coordinates
    // X goes from 0 to width
    // Y goes from height (0V) to 0 (5V)
    // We scale by timeScale and voltScale
    const points: string[] = []
    
    // We render the last N points based on timeScale
    const visibleCount = Math.max(10, Math.floor(buffer.length * timeScale))
    const subset = buffer.slice(-visibleCount)

    subset.forEach((pt, idx) => {
      const x = (idx / (subset.length - 1)) * width
      // 5V is top (0), 0V is bottom (height)
      const voltage = pt.val * voltScale
      const y = height - Math.max(0, Math.min(height, (voltage / 5.0) * height))
      points.push(`${x},${y}`)
    })

    return `M ${points.join(' L ')}`
  }

  return (
    <div className="flex flex-col h-full bg-surface-900 text-xs p-3 overflow-hidden">
      
      {/* Control panel */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-2.5 mb-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-warning-500" />
          <span className="font-bold text-text-primary text-[10px] uppercase tracking-wider">Multi-Channel Digital Oscilloscope</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Zoom controls */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-text-muted mr-1">Time Div:</span>
            <button
              onClick={() => setTimeScale(s => Math.min(2.0, s + 0.2))}
              className="bg-surface-800 border border-border px-1.5 py-0.5 rounded font-mono hover:bg-surface-750 text-text-primary"
              title="Zoom Out Time"
            >
              -
            </button>
            <span className="font-mono text-[9px] w-8 text-center text-text-secondary">{(1 / timeScale).toFixed(1)}x</span>
            <button
              onClick={() => setTimeScale(s => Math.max(0.2, s - 0.2))}
              className="bg-surface-800 border border-border px-1.5 py-0.5 rounded font-mono hover:bg-surface-750 text-text-primary"
              title="Zoom In Time"
            >
              +
            </button>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-[10px] text-text-muted mr-1">Volt Div:</span>
            <button
              onClick={() => setVoltScale(s => Math.max(0.2, s - 0.2))}
              className="bg-surface-800 border border-border px-1.5 py-0.5 rounded font-mono hover:bg-surface-750 text-text-primary"
              title="Zoom Out Voltage"
            >
              -
            </button>
            <span className="font-mono text-[9px] w-8 text-center text-text-secondary">{voltScale.toFixed(1)}x</span>
            <button
              onClick={() => setVoltScale(s => Math.min(3.0, s + 0.2))}
              className="bg-surface-800 border border-border px-1.5 py-0.5 rounded font-mono hover:bg-surface-750 text-text-primary"
              title="Zoom In Voltage"
            >
              +
            </button>
          </div>

          {/* Freeze */}
          <button
            onClick={toggleFreeze}
            className={`flex items-center gap-1 px-2.5 py-0.5 rounded border transition-colors ${
              frozen
                ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400 font-bold'
                : 'bg-surface-800 border-border text-text-secondary hover:bg-surface-750 hover:text-text-primary'
            }`}
          >
            <Snowflake className="h-3 w-3" />
            {frozen ? 'FROZEN' : 'FREEZE'}
          </button>
        </div>
      </div>

      {/* Selector dropdown and channel badges */}
      <div className="flex flex-wrap items-center gap-2 mb-3 bg-surface-950/40 p-2 rounded border border-border">
        <span className="text-text-muted text-[10px] font-bold uppercase">Probes:</span>
        <select
          onChange={(e) => {
            if (e.target.value) {
              togglePinProbe(e.target.value)
              e.target.value = ''
            }
          }}
          className="bg-surface-800 border border-border rounded px-2 py-0.5 text-text-primary text-[10px]"
        >
          <option value="">+ Add Probe Channel</option>
          {availablePins.map(p => (
            <option key={p.key} value={p.key} disabled={probedPins.includes(p.key)}>
              {p.label}
            </option>
          ))}
        </select>

        <div className="flex flex-wrap gap-2 ml-auto">
          {probedPins.map((pinKey, idx) => {
            const [, pinId] = pinKey.split(':')
            return (
              <span
                key={pinKey}
                style={{ borderColor: colors[idx], color: colors[idx] }}
                className="flex items-center gap-1.5 border bg-surface-850 px-2 py-0.5 rounded text-[9px] font-bold"
              >
                <span>CH{idx+1}: {pinId.toUpperCase()}</span>
                <button
                  onClick={() => togglePinProbe(pinKey)}
                  className="hover:text-red-400 p-0.5"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </span>
            )
          })}
        </div>
      </div>

      {/* SVG Scope Canvas */}
      <div className="flex-1 bg-surface-950 rounded-lg border border-border relative overflow-hidden flex items-center justify-center min-h-[160px]">
        {probedPins.length === 0 ? (
          <div className="text-center text-text-muted p-4">
            <Activity className="h-8 w-8 text-text-muted mx-auto mb-1 opacity-50" />
            <p>No channels connected. Choose a probe from the selection menu.</p>
          </div>
        ) : (
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
            {/* Grid Lines */}
            {Array.from({ length: 10 }).map((_, i) => {
              const x = (i / 10) * width
              return (
                <line
                  key={`v-${i}`}
                  x1={x}
                  y1={0}
                  x2={x}
                  y2={height}
                  stroke="#334155"
                  strokeWidth="0.5"
                  strokeDasharray="2,2"
                />
              )
            })}
            {Array.from({ length: 6 }).map((_, i) => {
              const y = (i / 6) * height
              return (
                <line
                  key={`h-${i}`}
                  x1={0}
                  y1={y}
                  x2={width}
                  y2={y}
                  stroke="#334155"
                  strokeWidth="0.5"
                  strokeDasharray="2,2"
                />
              )
            })}

            {/* Trace Lines */}
            {probedPins.map((pinKey, idx) => (
              <path
                key={pinKey}
                d={drawPath(pinKey)}
                fill="none"
                stroke={colors[idx]}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </svg>
        )}
      </div>
    </div>
  )
}
export default OscilloscopePanel
