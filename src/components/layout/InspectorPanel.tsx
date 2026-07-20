import { useSimulatorStore } from '@/store/useSimulatorStore'
import { getComponentDefinition } from '@/utils/componentDefinitions'
import { Cpu, Activity, Zap } from 'lucide-react'

const PIN_LEGEND = [
  { label: 'HIGH', swatch: 'bg-red-400', desc: 'Digital output driven high' },
  { label: 'LOW', swatch: 'bg-blue-400', desc: 'Digital output driven low' },
  { label: 'PWM / analog', swatch: 'bg-purple-400', desc: 'Numeric duty cycle or reading' },
  { label: 'PULLUP', swatch: 'bg-accent-400', desc: 'Input with internal pull-up' },
  { label: 'INPUT', swatch: 'bg-text-secondary', desc: 'Configured as input' },
  { label: 'FLOAT', swatch: 'bg-text-muted', desc: 'Unconfigured / floating' },
]

export function InspectorPanel() {
  const nodes = useSimulatorStore((s) => s.nodes)
  const gpioPinStates = useSimulatorStore((s) => s.gpioPinStates)
  const diagnostics = useSimulatorStore((s) => s.simulationDiagnostics)
  const status = useSimulatorStore((s) => s.simulationStatus)

  // Find all active microcontrollers
  const boards = nodes.filter((n) => n.type === 'arduino-uno' || n.type === 'esp32-devkit')


  const isIdle = status === 'idle'
  const isRunning = status === 'running'

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 h-full overflow-hidden p-3 bg-surface-900 text-xs">

      {/* 1. Diagnostics & Loop Stats */}
      <div className="flex flex-col border border-border rounded-lg bg-surface-950/60 overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-3 py-2 shrink-0">
          <h3 className="flex items-center gap-1.5 font-bold text-text-primary uppercase tracking-wider text-[10px]">
            <Activity className="h-3.5 w-3.5 text-accent-400" />
            Runtime Diagnostics
          </h3>
        </div>

        <div className="flex-1 flex flex-col justify-center gap-1.5 font-mono p-2.5">
          <div className="flex justify-between items-center bg-surface-850 px-2.5 py-2 rounded border border-border">
            <span className="text-text-muted font-sans">Sim Status</span>
            <span className="flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                {isRunning && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success-400 opacity-75" />
                )}
                <span
                  className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
                    isRunning ? 'bg-success-500' : status === 'paused' ? 'bg-warning-500' : 'bg-text-muted'
                  }`}
                />
              </span>
              <span
                className={`font-bold capitalize ${
                  isRunning ? 'text-success-400' : status === 'paused' ? 'text-warning-400' : 'text-text-secondary'
                }`}
              >
                {status}
              </span>
            </span>
          </div>

          <div className="flex justify-between items-center bg-surface-850 px-2.5 py-2 rounded border border-border">
            <span className="text-text-muted font-sans">Loops Executed</span>
            <span className="text-text-primary font-bold tabular-nums">
              {(isIdle ? 0 : diagnostics.loopCount).toLocaleString()}
            </span>
          </div>

          <div className="flex justify-between items-center bg-surface-850 px-2.5 py-2 rounded border border-border">
            <span className="text-text-muted font-sans">Virtual Time</span>
            <span className="text-text-primary font-bold tabular-nums">
              {isIdle ? '0.00' : (diagnostics.executionTime / 1000).toFixed(2)}s
            </span>
          </div>

          <div className="flex justify-between items-center bg-surface-850 px-2.5 py-2 rounded border border-border">
            <span className="text-text-muted font-sans">Loop Execution Rate</span>
            <span className="text-accent-400 font-bold tabular-nums">
              {isIdle ? 0 : diagnostics.loopFps} Hz
            </span>
          </div>

          {/* Pin-state legend — reference for the grid on the right */}
          <div className="border-t border-surface-800 mt-1 pt-2.5">
            <span className="text-text-muted font-bold font-sans uppercase tracking-wide text-[9px] block mb-1.5">
              Pin State Key
            </span>
            <div className="grid grid-cols-2 gap-y-1 gap-x-2 font-sans">
              {PIN_LEGEND.map((item) => (
                <div key={item.label} className="flex items-center gap-1.5" title={item.desc}>
                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${item.swatch}`} />
                  <span className="text-text-secondary text-[9px] truncate">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 2. MCU Pins Inspector */}
      <div className="flex flex-col md:col-span-2 border border-border rounded-lg bg-surface-950/60 overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-3 py-2 shrink-0">
          <h3 className="flex items-center gap-1.5 font-bold text-text-primary uppercase tracking-wider text-[10px]">
            <Cpu className="h-3.5 w-3.5 text-success-500" />
            GPIO &amp; Peripheral Pin Grid
          </h3>
          {boards.length > 0 && (
            <span className="text-[9px] font-mono text-text-muted tabular-nums">
              {boards.length} board{boards.length === 1 ? '' : 's'}
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto space-y-2.5 p-2.5">
          {boards.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <Cpu className="h-8 w-8 text-text-muted mb-2 opacity-60" />
              <p className="text-text-muted">No microcontrollers found in the workspace canvas.</p>
              <p className="text-[9px] text-text-muted/70 mt-1">Add an Arduino Uno or ESP32 to inspect live GPIO state.</p>
            </div>
          ) : (
            boards.map((board) => {
              const def = getComponentDefinition(board.type)
              const pinMap = gpioPinStates[board.id] || {}

              // Filter logic pins (exclude standard vcc/gnd pins)
              const logicPins = def?.pins.filter(p =>
                p.type === 'digital' ||
                p.type === 'gpio' ||
                p.type === 'analog' ||
                p.type === 'bus'
              ) || []

              const activeCount = logicPins.filter((pin) => {
                const v = pinMap[pin.id]
                return v === 'HIGH' || v === 'LOW' || typeof v === 'number'
              }).length

              return (
                <div key={board.id} className="bg-surface-850 p-2 rounded-lg border border-border">
                  <div className="font-bold text-text-primary border-b border-surface-700 pb-1.5 mb-2 text-[10px] flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <Zap className={`h-3 w-3 shrink-0 ${activeCount > 0 && isRunning ? 'text-accent-400' : 'text-text-muted'}`} />
                      <span className="truncate">{board.properties.name || def?.name}</span>
                    </span>
                    <span className="text-[9px] text-text-muted font-mono shrink-0">{board.id}</span>
                  </div>

                  {logicPins.length === 0 ? (
                    <p className="text-[9px] text-text-muted italic px-1 py-2">
                      No addressable logic pins defined for this component.
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1.5">
                      {logicPins.map((pin) => {
                        const value = pinMap[pin.id]
                        const isHigh = value === 'HIGH'
                        const isLow = value === 'LOW'

                        let displayVal = 'FLOAT'
                        let bgClass = 'bg-surface-800 border-surface-700 text-text-muted'
                        let dotClass = 'bg-text-muted/50'

                        if (isHigh) {
                          displayVal = 'HIGH'
                          bgClass = 'bg-red-500/10 border-red-500/30 text-red-400 font-bold'
                          dotClass = 'bg-red-400'
                        } else if (isLow) {
                          displayVal = 'LOW'
                          bgClass = 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                          dotClass = 'bg-blue-400'
                        } else if (typeof value === 'number') {
                          // PWM or Frequency
                          displayVal = `${value}`
                          bgClass = 'bg-purple-500/10 border-purple-500/30 text-purple-400 font-bold font-mono'
                          dotClass = 'bg-purple-400'
                        } else if (value === 'INPUT') {
                          displayVal = 'INPUT'
                          bgClass = 'bg-surface-800 border-surface-700 text-text-secondary'
                          dotClass = 'bg-text-secondary/70'
                        } else if (value === 'INPUT_PULLUP') {
                          displayVal = 'PULLUP'
                          bgClass = 'bg-accent-500/10 border-accent-500/30 text-accent-400'
                          dotClass = 'bg-accent-400'
                        }

                        const isLive = isRunning && (isHigh || isLow || typeof value === 'number')

                        return (
                          <div
                            key={pin.id}
                            className={`relative flex flex-col items-center justify-center gap-0.5 p-1 rounded border text-[9px] min-h-[38px] text-center transition-colors ${bgClass}`}
                            title={`Pin Label: ${pin.label} (${pin.id}) — ${displayVal}`}
                          >
                            <span className="absolute top-1 right-1 flex h-1.5 w-1.5">
                              {isLive && (
                                <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${dotClass}`} />
                              )}
                              <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${dotClass}`} />
                            </span>
                            <span className="font-semibold text-text-primary text-[8px] truncate max-w-full uppercase">{pin.label}</span>
                            <span className="text-[8px] opacity-80 tabular-nums">{displayVal}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

    </div>
  )
}