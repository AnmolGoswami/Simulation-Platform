import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Terminal,
  Radio,
  Activity,
  Trash2,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Cpu,
  Flame,
  Clock,
  ArrowDownCircle,
} from 'lucide-react'
import { PanelHeader } from './ResizablePanel'
import { useSimulatorStore } from '@/store/useSimulatorStore'
import { ValidationPanel } from './ValidationPanel'
import { InspectorPanel } from './InspectorPanel'
import { OscilloscopePanel } from '../instruments/OscilloscopePanel'
import { FaultInjectionPanel } from '../instruments/FaultInjectionPanel'
import { TimelinePanel } from '../instruments/TimelinePanel'
import type { BottomPanelTab } from '@/types'

const TABS: { id: BottomPanelTab; label: string; icon: typeof Terminal }[] = [
  { id: 'console', label: 'Console', icon: Terminal },
  { id: 'serial', label: 'Serial Monitor', icon: Radio },
  { id: 'simulation', label: 'Simulation Logs', icon: Activity },
  { id: 'validation', label: 'Circuit Validation', icon: ShieldAlert },
  { id: 'inspector', label: 'Pin Inspector', icon: Cpu },
  { id: 'oscilloscope', label: 'Oscilloscope', icon: Activity },
  { id: 'faults', label: 'Fault Injection', icon: Flame },
  { id: 'timeline', label: 'Flight Timeline', icon: Clock },
]

// Tabs whose content is drawn from `logs` — used to skip filtering/scroll
// work entirely when a non-log tab (validation, oscilloscope, etc.) is active.
const LOG_TABS = new Set<BottomPanelTab>(['console', 'serial', 'simulation'])

const levelColors: Record<string, string> = {
  info: 'text-text-secondary',
  warn: 'text-warning-500',
  error: 'text-danger-500',
  debug: 'text-text-muted',
  serial: 'text-accent-400',
}

// How close to the bottom (in px) counts as "still following the stream".
const AUTO_SCROLL_THRESHOLD = 48

export function BottomPanel() {
  const bottomPanelTab = useSimulatorStore((s) => s.bottomPanelTab)
  const setBottomPanelTab = useSimulatorStore((s) => s.setBottomPanelTab)
  const toggleBottomPanel = useSimulatorStore((s) => s.toggleBottomPanel)
  const logs = useSimulatorStore((s) => s.logs)
  const clearLogs = useSimulatorStore((s) => s.clearLogs)

  const logContainerRef = useRef<HTMLDivElement>(null)
  const [isPinnedToBottom, setIsPinnedToBottom] = useState(true)

  // Stable empty-array sentinel typed against the store's own `logs` shape
  // (rather than a guessed import) so non-log tabs don't trigger new-array
  // identity churn on every render.
  const emptyLogs = useMemo(() => [] as typeof logs, [])

  // Only filter when a log-driven tab is actually visible — validation,
  // inspector, oscilloscope, faults, and timeline don't use `filteredLogs`
  // at all, so re-scanning the (potentially large, fast-growing) logs array
  // on every render while those tabs are open was pure wasted work.
  const filteredLogs = useMemo(() => {
    if (!LOG_TABS.has(bottomPanelTab)) return emptyLogs
    if (bottomPanelTab === 'console') return logs.filter((log) => log.source === 'console')
    if (bottomPanelTab === 'serial') return logs.filter((log) => log.source === 'serial')
    return logs.filter((log) => log.source === 'simulation')
  }, [logs, bottomPanelTab, emptyLogs])

  const logCounts = useMemo(() => {
    const counts = { console: 0, serial: 0, simulation: 0 }
    for (const log of logs) {
      if (log.source === 'console') counts.console++
      else if (log.source === 'serial') counts.serial++
      else if (log.source === 'simulation') counts.simulation++
    }
    return counts
  }, [logs])

  // Re-pin to the bottom whenever the visible log stream changes tabs, so
  // switching from Serial to Console (say) always starts following live
  // output rather than preserving an unrelated scroll position.
  useEffect(() => {
    setIsPinnedToBottom(true)
  }, [bottomPanelTab])

  // A real-time log view that doesn't auto-follow is nearly useless during
  // an active simulation — but auto-scrolling out from under someone who
  // scrolled up to read an earlier line is just as bad. So: only snap to
  // the bottom on new entries if the user was already at (or near) the
  // bottom; otherwise leave their scroll position alone and surface a
  // "Jump to latest" affordance instead.
  useEffect(() => {
    if (isPinnedToBottom && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [filteredLogs.length, isPinnedToBottom])

  const handleLogScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    setIsPinnedToBottom(distanceFromBottom < AUTO_SCROLL_THRESHOLD)
  }

  const jumpToLatest = () => {
    setIsPinnedToBottom(true)
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }

  const isLogTab = LOG_TABS.has(bottomPanelTab)

  return (
    <div className="flex h-full flex-col">
      <PanelHeader
        title=""
        actions={
          <div className="flex w-full items-center justify-between gap-2 min-w-0">
            <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
              {TABS.map(({ id, label, icon: Icon }) => {
                const count = id in logCounts ? logCounts[id as keyof typeof logCounts] : 0
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setBottomPanelTab(id)}
                    className={`flex shrink-0 items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors ${
                      bottomPanelTab === id
                        ? 'bg-surface-700 text-text-primary'
                        : 'text-text-muted hover:text-text-secondary hover:bg-surface-800'
                    }`}
                  >
                    <Icon className="h-3 w-3 shrink-0" />
                    <span>{label}</span>
                    {count > 0 && (
                      <span
                        className={`rounded-full px-1 text-[9px] font-mono tabular-nums ${
                          bottomPanelTab === id
                            ? 'bg-surface-600 text-text-primary'
                            : 'bg-surface-800 text-text-muted'
                        }`}
                      >
                        {count > 999 ? '999+' : count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {isLogTab && (
                <button
                  type="button"
                  onClick={clearLogs}
                  className="rounded p-1 text-text-muted hover:bg-surface-700 hover:text-text-secondary transition-colors"
                  title="Clear logs"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={toggleBottomPanel}
                className="rounded p-1 text-text-muted hover:bg-surface-700 hover:text-text-secondary transition-colors"
                title="Collapse panel"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        }
      />

      <div className="relative flex-1 overflow-hidden">
        {bottomPanelTab === 'validation' ? (
          <ValidationPanel />
        ) : bottomPanelTab === 'inspector' ? (
          <InspectorPanel />
        ) : bottomPanelTab === 'oscilloscope' ? (
          <OscilloscopePanel />
        ) : bottomPanelTab === 'faults' ? (
          <FaultInjectionPanel />
        ) : bottomPanelTab === 'timeline' ? (
          <TimelinePanel />
        ) : (
          <>
            <div
              ref={logContainerRef}
              onScroll={handleLogScroll}
              className="h-full overflow-y-auto p-2 font-mono text-xs"
            >
              {filteredLogs.length === 0 ? (
                <p className="px-2 py-4 text-center text-text-muted">No logs yet</p>
              ) : (
                filteredLogs.map((log) => (
                  <div key={log.id} className="flex gap-2 px-2 py-0.5 hover:bg-surface-850 rounded">
                    <span className="shrink-0 text-text-muted tabular-nums">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span className={`shrink-0 uppercase ${levelColors[log.level] ?? 'text-text-secondary'}`}>
                      [{log.level}]
                    </span>
                    <span className="text-text-secondary break-words">{log.message}</span>
                  </div>
                ))
              )}
            </div>

            {!isPinnedToBottom && filteredLogs.length > 0 && (
              <button
                type="button"
                onClick={jumpToLatest}
                className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-accent-500/40 bg-surface-800 px-3 py-1 text-[10px] font-semibold text-accent-400 shadow-lg hover:bg-surface-750 transition-colors"
              >
                <ArrowDownCircle className="h-3 w-3" />
                Jump to latest
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export function BottomPanelToggle() {
  const bottomPanelOpen = useSimulatorStore((s) => s.bottomPanelOpen)
  const toggleBottomPanel = useSimulatorStore((s) => s.toggleBottomPanel)

  if (bottomPanelOpen) return null

  return (
    <button
      type="button"
      onClick={toggleBottomPanel}
      className="absolute bottom-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-surface-800 px-3 py-1 text-xs text-text-secondary shadow-lg hover:bg-surface-750 transition-colors"
    >
      <ChevronUp className="h-3 w-3" />
      Show Console
    </button>
  )
}