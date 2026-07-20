import { useSimulatorStore } from '@/store/useSimulatorStore'
import { Clock, ShieldAlert, CheckCircle, Flame, Trash2 } from 'lucide-react'

export function TimelinePanel() {
  const events = useSimulatorStore((s) => s.timelineEvents)
  const clearTimeline = useSimulatorStore((s) => s.clearTimeline)

  // Sort events chronologically (newest first for scrolling layout ease)
  const sortedEvents = [...events].reverse()

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'fault_injected':
        return <ShieldAlert className="h-3.5 w-3.5 text-danger-500" />
      case 'fault_cleared':
        return <CheckCircle className="h-3.5 w-3.5 text-success-500" />
      case 'scenario':
        return <Flame className="h-3.5 w-3.5 text-orange-400" />
      default:
        return <Clock className="h-3.5 w-3.5 text-accent-400" />
    }
  }

  return (
    <div className="flex flex-col h-full bg-surface-900 text-xs p-3 overflow-hidden">
      <div className="flex items-center justify-between border-b border-border pb-2 mb-3">
        <div className="flex items-center gap-1.5">
          <Clock className="h-4 w-4 text-accent-400" />
          <span className="font-bold text-text-primary text-[10px] uppercase tracking-wider">Flight Event Timeline</span>
        </div>
        <button
          onClick={clearTimeline}
          disabled={events.length === 0}
          className="flex items-center gap-1 text-[10px] text-text-muted hover:text-red-400 disabled:opacity-40 disabled:hover:text-text-muted px-2 py-0.5 rounded border border-border bg-surface-850 hover:bg-surface-800 transition-colors"
        >
          <Trash2 className="h-3 w-3" />
          Clear Log
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1 font-mono">
        {sortedEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-text-muted opacity-50 p-4">
            <Clock className="h-8 w-8 mb-1" />
            <p>No timeline logs. Trigger faults or scenarios to log events.</p>
          </div>
        ) : (
          sortedEvents.map((evt) => {
            const timeSec = (evt.timestamp / 1000).toFixed(2)
            return (
              <div
                key={evt.id}
                className="flex items-start gap-2.5 bg-surface-950/40 p-2 rounded border border-border/60 hover:border-border transition-colors"
              >
                <div className="mt-0.5 shrink-0">{getEventIcon(evt.type)}</div>
                <div className="flex-1">
                  <div className="flex justify-between items-center text-[9px]">
                    <span className="font-bold text-accent-400">T+{timeSec}s</span>
                    <span className="text-[8px] text-text-muted uppercase tracking-wider">{evt.type.replace('_', ' ')}</span>
                  </div>
                  <p className="text-[10px] text-text-primary mt-0.5 font-sans leading-relaxed">{evt.msg}</p>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
export default TimelinePanel
