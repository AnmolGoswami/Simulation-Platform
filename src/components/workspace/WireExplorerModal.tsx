import React, { useState, useMemo } from 'react'
import { X, Search, Eye, EyeOff, CheckSquare, Square, Filter, Palette, Sparkles, CheckCircle2 } from 'lucide-react'
import { useSimulatorStore } from '@/store/useSimulatorStore'
import { useReactFlow } from '@xyflow/react'

const COLOR_MAP: Record<string, { hex: string; label: string; bg: string }> = {
  red: { hex: '#ef4444', label: 'Red (Power +)', bg: 'bg-red-500/20 text-red-400 border-red-500/30' },
  black: { hex: '#18181b', label: 'Black (Ground -)', bg: 'bg-zinc-800 text-zinc-300 border-zinc-700' },
  green: { hex: '#10b981', label: 'Green (Gate/Signal)', bg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  yellow: { hex: '#f59e0b', label: 'Yellow (Sense/ADC)', bg: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  blue: { hex: '#3b82f6', label: 'Blue (PWM/Control)', bg: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  orange: { hex: '#f97316', label: 'Orange (Battery/Fuse)', bg: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  purple: { hex: '#8b5cf6', label: 'Purple (Audio/I2C)', bg: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  white: { hex: '#f8fafc', label: 'White (Aux)', bg: 'bg-slate-100/20 text-slate-200 border-slate-300/30' },
}

export function WireExplorerModal() {
  const isWireExplorerOpen = useSimulatorStore((s) => s.isWireExplorerOpen)
  const setWireExplorerOpen = useSimulatorStore((s) => s.setWireExplorerOpen)
  const edges = useSimulatorStore((s) => s.edges)
  const nodes = useSimulatorStore((s) => s.nodes)
  const updateEdge = useSimulatorStore((s) => s.updateEdge)
  const highlightedEdgeId = useSimulatorStore((s) => s.highlightedEdgeId)
  const setHighlightedEdgeId = useSimulatorStore((s) => s.setHighlightedEdgeId)
  const completedWireIds = useSimulatorStore((s) => s.completedWireIds)
  const toggleWireCompleted = useSimulatorStore((s) => s.toggleWireCompleted)
  const { setCenter } = useReactFlow()

  const [searchQuery, setSearchQuery] = useState('')
  const [colorFilter, setColorFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'pending'>('all')

  const connectionList = useMemo(() => {
    return edges
      .filter((edge) => !edge.data?.isHidden)
      .map((edge) => {
        const sourceNode = nodes.find((n) => n.id === edge.sourceNodeId || n.id === edge.source)
        const targetNode = nodes.find((n) => n.id === edge.targetNodeId || n.id === edge.target)

        const sourceName = String(sourceNode?.properties?.name || sourceNode?.type || edge.sourceNodeId || edge.source).replace(/-/g, ' ').toUpperCase()
        const targetName = String(targetNode?.properties?.name || targetNode?.type || edge.targetNodeId || edge.target).replace(/-/g, ' ').toUpperCase()
        const sourcePin = edge.sourcePinId || (edge.data?.sourcePinId as string) || edge.sourceHandle || 'pin'
        const targetPin = edge.targetPinId || (edge.data?.targetPinId as string) || edge.targetHandle || 'pin'
        const color = (edge.data?.color as string) || edge.color || 'red'
        const isCompleted = completedWireIds.includes(edge.id)

        return {
          id: edge.id,
          sourceName,
          sourcePin,
          targetName,
          targetPin,
          color,
          isCompleted,
          sourcePos: sourceNode?.position,
          targetPos: targetNode?.position,
        }
      })
  }, [edges, nodes, completedWireIds])

  const filteredConnections = useMemo(() => {
    return connectionList.filter((item) => {
      if (colorFilter !== 'all' && item.color !== colorFilter) return false
      if (statusFilter === 'completed' && !item.isCompleted) return false
      if (statusFilter === 'pending' && item.isCompleted) return false
      if (searchQuery.trim() === '') return true

      const q = searchQuery.toLowerCase()
      return (
        item.sourceName.toLowerCase().includes(q) ||
        item.sourcePin.toLowerCase().includes(q) ||
        item.targetName.toLowerCase().includes(q) ||
        item.targetPin.toLowerCase().includes(q) ||
        item.color.toLowerCase().includes(q)
      )
    })
  }, [connectionList, searchQuery, colorFilter, statusFilter])

  const completedCount = connectionList.filter((c) => c.isCompleted).length
  const totalCount = connectionList.length
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  if (!isWireExplorerOpen) return null

  const handleFocusWire = (item: typeof connectionList[0]) => {
    const isCurrentlyHighlighted = highlightedEdgeId === item.id
    if (isCurrentlyHighlighted) {
      setHighlightedEdgeId(null)
    } else {
      setHighlightedEdgeId(item.id)
      if (item.sourcePos && item.targetPos) {
        const midX = (item.sourcePos.x + item.targetPos.x) / 2
        const midY = (item.sourcePos.y + item.targetPos.y) / 2
        setCenter(midX, midY, { zoom: 1.15, duration: 400 })
      }
    }
  }

  const handleColorChange = (edgeId: string, newColor: string) => {
    updateEdge(edgeId, { color: newColor })
  }

  return (
    <div className="fixed right-4 top-16 z-50 w-full max-w-2xl rounded-2xl border border-border bg-surface-900/95 shadow-2xl backdrop-blur-xl transition-all flex flex-col max-h-[80vh] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-surface-850 px-5 py-3.5 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-500/20 text-accent-400 border border-accent-500/30 shadow-inner">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
              Real-World Wiring Explorer & Checklist
            </h3>
            <p className="text-[11px] text-text-muted">
              Trace every wire connection step-by-step and check off items as you wire your breadboard
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {highlightedEdgeId && (
            <button
              onClick={() => setHighlightedEdgeId(null)}
              className="flex items-center gap-1.5 rounded-lg border border-warning-500/30 bg-warning-500/10 px-2.5 py-1 text-xs font-semibold text-warning-400 hover:bg-warning-500/20 transition-colors"
            >
              <EyeOff className="h-3.5 w-3.5" />
              Clear X-Ray Focus
            </button>
          )}
          <button
            onClick={() => setWireExplorerOpen(false)}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-surface-800 text-text-muted hover:bg-surface-700 hover:text-text-primary transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Progress & Quick Filters Toolbar */}
      <div className="border-b border-border bg-surface-850/60 px-5 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
        {/* Progress Bar */}
        <div className="flex items-center gap-3 min-w-[200px] flex-1">
          <div className="flex flex-col gap-1 w-full">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-text-secondary flex items-center gap-1.5">
                <CheckCircle2 className={`h-3.5 w-3.5 ${progressPct === 100 ? 'text-success-400' : 'text-accent-400'}`} />
                Hardware Assembly Progress
              </span>
              <span className="text-accent-400 font-mono">{completedCount} / {totalCount} wires ({progressPct}%)</span>
            </div>
            <div className="h-2 w-full rounded-full bg-surface-950 overflow-hidden border border-border">
              <div
                className="h-full bg-gradient-to-r from-accent-500 to-emerald-400 transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
          <input
            type="text"
            placeholder="Search component or pin..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface-950 pl-8 pr-3 py-1.5 text-xs text-text-primary placeholder-text-muted focus:border-accent-500 focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Color chips and status tabs */}
      <div className="flex items-center justify-between gap-2 px-5 py-2.5 bg-surface-900 border-b border-border shrink-0 overflow-x-auto text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-text-muted flex items-center gap-1 font-semibold mr-1">
            <Filter className="h-3 w-3" /> Color:
          </span>
          <button
            onClick={() => setColorFilter('all')}
            className={`px-2.5 py-1 rounded-md border font-semibold transition-colors ${
              colorFilter === 'all' ? 'bg-accent-500/20 border-accent-500/50 text-accent-400' : 'bg-surface-800 border-border text-text-muted hover:text-text-primary'
            }`}
          >
            All ({connectionList.length})
          </button>
          {Object.entries(COLOR_MAP).map(([colorKey, colorInfo]) => {
            const count = connectionList.filter((c) => c.color === colorKey).length
            if (count === 0) return null
            return (
              <button
                key={colorKey}
                onClick={() => setColorFilter(colorKey)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md border font-semibold transition-colors ${
                  colorFilter === colorKey ? colorInfo.bg + ' ring-1 ring-white/20' : 'bg-surface-800 border-border text-text-muted hover:text-text-primary'
                }`}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colorInfo.hex }} />
                <span className="capitalize">{colorKey} ({count})</span>
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-1 border-l border-border pl-3 ml-auto shrink-0">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-2 py-1 rounded-md font-semibold transition-colors ${statusFilter === 'all' ? 'bg-surface-750 text-text-primary' : 'text-text-muted hover:text-text-primary'}`}
          >
            All
          </button>
          <button
            onClick={() => setStatusFilter('pending')}
            className={`px-2 py-1 rounded-md font-semibold transition-colors ${statusFilter === 'pending' ? 'bg-warning-500/20 text-warning-400' : 'text-text-muted hover:text-text-primary'}`}
          >
            Pending
          </button>
          <button
            onClick={() => setStatusFilter('completed')}
            className={`px-2 py-1 rounded-md font-semibold transition-colors ${statusFilter === 'completed' ? 'bg-success-500/20 text-success-400' : 'text-text-muted hover:text-text-primary'}`}
          >
            Done
          </button>
        </div>
      </div>

      {/* Table Body */}
      <div className="flex-1 overflow-y-auto divide-y divide-border/50">
        {filteredConnections.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-text-muted">
            <Sparkles className="h-8 w-8 text-text-muted/40 mb-2" />
            <p className="text-xs font-semibold">No wire connections matched your search/filter.</p>
          </div>
        ) : (
          filteredConnections.map((item) => {
            const isFocused = highlightedEdgeId === item.id
            const colorInfo = COLOR_MAP[item.color] || COLOR_MAP.red

            return (
              <div
                key={item.id}
                className={`flex items-center justify-between gap-4 px-5 py-2.5 transition-colors ${
                  isFocused
                    ? 'bg-accent-500/15 border-l-4 border-l-accent-400'
                    : item.isCompleted
                      ? 'bg-surface-950/40 opacity-75 hover:opacity-100 hover:bg-surface-850'
                      : 'hover:bg-surface-850'
                }`}
              >
                {/* Checkbox */}
                <button
                  onClick={() => toggleWireCompleted(item.id)}
                  className="flex items-center gap-3 text-left focus:outline-none group shrink-0"
                  title="Check off wire as completed on your real-world hardware breadboard"
                >
                  {item.isCompleted ? (
                    <CheckSquare className="h-4 w-4 text-success-400 group-hover:scale-110 transition-transform" />
                  ) : (
                    <Square className="h-4 w-4 text-text-muted group-hover:text-accent-400 transition-colors" />
                  )}
                </button>

                {/* Wire Color Pill & Picker */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className={`flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${colorInfo.bg}`}>
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: colorInfo.hex }} />
                    <span className="capitalize">{item.color}</span>
                  </div>
                </div>

                {/* Connection Details */}
                <div className="flex flex-1 items-center gap-3 min-w-0 text-xs">
                  {/* Source */}
                  <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-end">
                    <span className={`font-semibold truncate ${item.isCompleted ? 'text-text-secondary line-through decoration-text-muted' : 'text-accent-300'}`}>
                      {item.sourceName}
                    </span>
                    <span className="rounded bg-surface-950 px-1.5 py-0.5 font-mono text-[10px] text-accent-400 border border-accent-500/20 shrink-0">
                      {item.sourcePin}
                    </span>
                  </div>

                  {/* Arrow */}
                  <span className="text-text-muted font-bold px-1 shrink-0">➔</span>

                  {/* Target */}
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span className="rounded bg-surface-950 px-1.5 py-0.5 font-mono text-[10px] text-emerald-400 border border-emerald-500/20 shrink-0">
                      {item.targetPin}
                    </span>
                    <span className={`font-semibold truncate ${item.isCompleted ? 'text-text-secondary line-through decoration-text-muted' : 'text-emerald-300'}`}>
                      {item.targetName}
                    </span>
                  </div>
                </div>

                {/* Focus / Highlight & Action buttons */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleFocusWire(item)}
                    className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-all ${
                      isFocused
                        ? 'border-accent-400 bg-accent-500 text-white shadow-lg scale-105'
                        : 'border-border bg-surface-800 text-text-secondary hover:bg-surface-750 hover:text-text-primary'
                    }`}
                    title="Focus and X-Ray highlight this exact wire on the schematic canvas"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>{isFocused ? 'Focused' : 'X-Ray Focus'}</span>
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Footer / Quick Tip */}
      <div className="border-t border-border bg-surface-950 px-5 py-2.5 text-[11px] text-text-muted flex items-center justify-between shrink-0">
        <span>💡 <strong>Tip:</strong> Hovering or clicking any wire right on the canvas will also show a floating connection badge.</span>
        <span>Check off wires as you build physically to prevent mistakes!</span>
      </div>
    </div>
  )
}
