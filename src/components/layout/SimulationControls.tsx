import {
  Play,
  Pause,
  Square,
  SkipForward,
  RotateCcw,
  Gauge,
  ChevronDown,
} from 'lucide-react'
import { useSimulatorStore } from '@/store/useSimulatorStore'

const STATUS_LABEL: Record<string, string> = {
  running: 'Running',
  paused: 'Paused',
  idle: 'Idle',
}

export function SimulationControls() {
  const simulationStatus = useSimulatorStore((s) => s.simulationStatus)
  const simulationSpeed = useSimulatorStore((s) => s.simulationSpeed)
  const setSimulationStatus = useSimulatorStore((s) => s.setSimulationStatus)
  const setSimulationSpeed = useSimulatorStore((s) => s.setSimulationSpeed)
  const resetSimulationState = useSimulatorStore((s) => s.resetSimulationState)

  const handlePlayPause = () => {
    if (simulationStatus === 'running') {
      setSimulationStatus('paused')
    } else {
      setSimulationStatus('running')
    }
  }

  const handleStop = () => {
    setSimulationStatus('idle')
    resetSimulationState()
  }

  const handleRestart = () => {
    setSimulationStatus('idle')
    resetSimulationState()
    setTimeout(() => {
      setSimulationStatus('running')
    }, 100)
  }

  const handleStep = () => {
    // Run exactly one step by toggling running and then pausing instantly
    setSimulationStatus('running')
    setTimeout(() => {
      setSimulationStatus('paused')
    }, 30)
  }

  const isRunning = simulationStatus === 'running'
  const isIdle = simulationStatus === 'idle'

  return (
    <div className="flex items-center gap-1 bg-surface-950/40 p-1 rounded-lg border border-border">

      {/* Live status indicator */}
      <div className="flex items-center gap-1.5 pl-1.5 pr-2">
        <span className="relative flex h-1.5 w-1.5">
          {isRunning && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success-400 opacity-75" />
          )}
          <span
            className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
              isRunning ? 'bg-success-500' : isIdle ? 'bg-text-muted' : 'bg-warning-500'
            }`}
          />
        </span>
        <span className="text-[9px] font-semibold uppercase tracking-wider text-text-muted w-10 tabular-nums">
          {STATUS_LABEL[simulationStatus] ?? simulationStatus}
        </span>
      </div>

      <div className="h-4 w-px bg-border" />

      {/* Play / Pause */}
      <button
        onClick={handlePlayPause}
        aria-label={isRunning ? 'Pause simulation' : 'Start simulation'}
        className={`flex h-7 w-7 items-center justify-center rounded transition-all active:scale-95 ${
          isRunning
            ? 'bg-warning-600 hover:bg-warning-500 text-white shadow-[0_0_0_1px_rgba(0,0,0,0.15)]'
            : 'bg-success-600 hover:bg-success-500 text-white shadow-[0_0_12px_-2px_theme(colors.success.500/60%)]'
        }`}
        title={isRunning ? 'Pause Simulation' : 'Start Simulation'}
      >
        {isRunning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 fill-current translate-x-[1px]" />}
      </button>

      {/* Step */}
      <button
        onClick={handleStep}
        disabled={isRunning}
        aria-label="Step one frame"
        className="flex h-7 w-7 items-center justify-center rounded text-text-secondary hover:bg-surface-700 hover:text-text-primary disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-text-secondary transition-colors active:scale-95"
        title="Step One Frame"
      >
        <SkipForward className="h-3.5 w-3.5" />
      </button>

      {/* Restart */}
      <button
        onClick={handleRestart}
        disabled={isIdle}
        aria-label="Restart simulation"
        className="flex h-7 w-7 items-center justify-center rounded text-text-secondary hover:bg-surface-700 hover:text-text-primary disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-text-secondary transition-colors active:scale-95"
        title="Restart"
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </button>

      {/* Stop */}
      <button
        onClick={handleStop}
        disabled={isIdle}
        aria-label="Stop simulation"
        className="flex h-7 w-7 items-center justify-center rounded text-text-secondary hover:bg-danger-500/20 hover:text-danger-500 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-text-secondary transition-colors active:scale-95"
        title="Stop Simulation"
      >
        <Square className="h-3.5 w-3.5 fill-current" />
      </button>

      {/* Divider */}
      <div className="h-4 w-px bg-border mx-1" />

      {/* Speed Selector */}
      <div className="flex items-center gap-1.5 pl-1 pr-2 text-text-secondary text-[10px] font-semibold">
        <Gauge className={`h-3.5 w-3.5 text-accent-400 shrink-0 ${isRunning ? 'animate-pulse' : ''}`} />
        <div className="relative">
          <select
            value={String(simulationSpeed)}
            onChange={(e) => {
              const val = e.target.value
              setSimulationSpeed(val === 'unlimited' ? 'unlimited' : parseFloat(val) as any)
            }}
            aria-label="Simulation speed factor"
            className="appearance-none bg-surface-850 text-text-primary text-[10px] font-semibold outline-none cursor-pointer border border-border rounded pl-1.5 pr-4 py-1 hover:border-accent-500/50 focus:border-accent-500 focus:ring-1 focus:ring-accent-500/40 transition-colors"
            title="Simulation Speed Factor"
          >
            <option value="0.25">0.25x</option>
            <option value="0.5">0.5x</option>
            <option value="1">1.0x (Realtime)</option>
            <option value="2">2.0x</option>
            <option value="5">5.0x</option>
            <option value="10">10x</option>
            <option value="unlimited">Max (Unlimited)</option>
          </select>
          <ChevronDown className="h-3 w-3 text-text-muted absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>
    </div>
  )
}