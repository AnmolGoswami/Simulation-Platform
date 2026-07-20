import { useMemo } from 'react'
import { useReactFlow } from '@xyflow/react'
import {
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Info,
  Layers,
  Sparkles,
  PlusCircle,
  Zap,
  GitBranch,
  Activity,
  ChevronRight,
} from 'lucide-react'
import { useSimulatorStore } from '@/store/useSimulatorStore'
import { WIRING_TEMPLATES, getWiringRecommendations } from '@/utils/autoWiring'
import type { ComponentType } from '@/types'

export function ValidationPanel() {
  const { fitView } = useReactFlow()
  const storeNodes = useSimulatorStore((s) => s.nodes)
  const storeEdges = useSimulatorStore((s) => s.edges)
  const validation = useSimulatorStore((s) => s.validation)
  const addNode = useSimulatorStore((s) => s.addNode)
  const addEdge = useSimulatorStore((s) => s.addEdge)
  const resetProject = useSimulatorStore((s) => s.resetProject)
  const setSelectedNodes = useSimulatorStore((s) => s.setSelectedNodes)

  const recommendations = useMemo(() => {
    return getWiringRecommendations(storeNodes, storeEdges)
  }, [storeNodes, storeEdges])

  // Center/zoom canvas onto a specific component
  const focusOnNode = (nodeId?: string) => {
    if (!nodeId) return
    setSelectedNodes([nodeId])
    fitView({
      nodes: [{ id: nodeId }],
      duration: 600,
      minZoom: 1.5,
      maxZoom: 1.5,
    })
  }

  // Load a wiring template
  const handleLoadTemplate = (key: string) => {
    const template = WIRING_TEMPLATES[key]
    if (!template) return

    resetProject()

    // Add nodes
    template.nodes.forEach((n) => {
      // Custom add logic that supports specific positions and properties
      useSimulatorStore.setState((state) => {
        const newNode = {
          id: n.id,
          type: n.type,
          position: n.position,
          properties: {
            name: n.properties?.name || n.id.toUpperCase(),
            rotation: 0,
            ...n.properties,
          },
        }
        return {
          nodes: [...state.nodes, newNode],
        }
      })
    })

    // Add edges
    template.edges.forEach((e) => {
      addEdge(e)
    })

    // Auto-fit the view after a short delay
    setTimeout(() => {
      fitView({ duration: 800 })
    }, 200)
  }

  // Recommendation action executor
  const handleApplyRecommendation = (rec: { actionNode?: ComponentType }) => {
    if (!rec.actionNode) return
    // Spawn recommendation component in the center of the workspace view
    addNode(rec.actionNode, { x: 250, y: 150 })
  }

  const errorCount = validation.errors.length
  const warningCount = validation.warnings.length
  const pass = errorCount === 0 && warningCount === 0

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 h-full overflow-hidden p-3 bg-surface-900 text-xs">

      {/* 1. Alerts & Errors List */}
      <div className="flex flex-col border border-border rounded-lg bg-surface-950/60 overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-3 py-2 shrink-0">
          <h3 className="flex items-center gap-1.5 font-bold text-text-primary uppercase tracking-wider text-[10px]">
            <AlertTriangle className="h-3.5 w-3.5 text-warning-500" />
            Circuit Rules &amp; Diagnostics
          </h3>
          <div className="flex items-center gap-1">
            {errorCount > 0 && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-danger-500/10 text-danger-400 border border-danger-500/20 text-[9px] font-bold font-mono tabular-nums">
                <XCircle className="h-2.5 w-2.5" />
                {errorCount}
              </span>
            )}
            {warningCount > 0 && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-warning-500/10 text-warning-400 border border-warning-500/20 text-[9px] font-bold font-mono tabular-nums">
                <AlertTriangle className="h-2.5 w-2.5" />
                {warningCount}
              </span>
            )}
            {pass && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-success-500/10 text-success-400 border border-success-500/20 text-[9px] font-bold uppercase tracking-wide">
                Clean
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
          {pass ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="relative mb-3">
                <div className="absolute inset-0 rounded-full bg-success-500/20 blur-md" />
                <CheckCircle2 className="h-8 w-8 text-success-500 relative" />
              </div>
              <p className="text-text-primary font-semibold">Circuit Validation Passed</p>
              <p className="text-[10px] text-text-muted mt-0.5 max-w-[220px] leading-relaxed">
                No wiring rules or continuity violations detected across {storeNodes.length} component{storeNodes.length === 1 ? '' : 's'}.
              </p>
            </div>
          ) : (
            <>
              {validation.errors.map((err) => (
                <button
                  key={err.id}
                  onClick={() => focusOnNode(err.componentId)}
                  className="group w-full flex gap-2 p-2 border border-danger-500/20 bg-danger-500/5 rounded-md text-left hover:bg-danger-500/10 hover:border-danger-500/40 transition-colors"
                >
                  <XCircle className="h-4 w-4 text-danger-500 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-danger-400 leading-snug">{err.message}</p>
                    {err.componentId && (
                      <span className="flex items-center gap-1 text-[9px] text-text-muted mt-1 font-mono group-hover:text-danger-300 transition-colors">
                        <ChevronRight className="h-2.5 w-2.5 shrink-0" />
                        <span className="truncate">Inspect {err.componentId}</span>
                      </span>
                    )}
                  </div>
                </button>
              ))}
              {validation.warnings.map((warn) => (
                <button
                  key={warn.id}
                  onClick={() => focusOnNode(warn.componentId)}
                  className="group w-full flex gap-2 p-2 border border-warning-500/20 bg-warning-500/5 rounded-md text-left hover:bg-warning-500/10 hover:border-warning-500/40 transition-colors"
                >
                  <AlertTriangle className="h-4 w-4 text-warning-500 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-warning-400 leading-snug">{warn.message}</p>
                    {warn.componentId && (
                      <span className="flex items-center gap-1 text-[9px] text-text-muted mt-1 font-mono group-hover:text-warning-300 transition-colors">
                        <ChevronRight className="h-2.5 w-2.5 shrink-0" />
                        <span className="truncate">Inspect {warn.componentId}</span>
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      {/* 2. Network Continuity & State Inspector */}
      <div className="flex flex-col border border-border rounded-lg bg-surface-950/60 overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-3 py-2 shrink-0">
          <h3 className="flex items-center gap-1.5 font-bold text-text-primary uppercase tracking-wider text-[10px]">
            <Layers className="h-3.5 w-3.5 text-accent-400" />
            Electrical Continuity Networks
          </h3>
          <span className="text-[9px] font-mono text-text-muted tabular-nums">
            {validation.connectedComponents.length}/{storeNodes.length} wired
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-2.5 space-y-3 font-mono text-[10px]">

          {/* Active Power Sources */}
          <div>
            <span className="flex items-center gap-1 text-text-muted font-bold font-sans uppercase tracking-wide text-[9px] mb-1.5">
              <Zap className="h-3 w-3 text-red-400" />
              Power Sources
              <span className="text-text-muted/60">({validation.powerSources.length})</span>
            </span>
            {validation.powerSources.length === 0 ? (
              <span className="flex items-center gap-1 text-warning-500 font-sans font-semibold px-1">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                No active power sources detected
              </span>
            ) : (
              <div className="flex flex-wrap gap-1">
                {validation.powerSources.map((ps) => {
                  const node = storeNodes.find((n) => n.id === ps)
                  return (
                    <button
                      key={ps}
                      onClick={() => focusOnNode(ps)}
                      className="bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/40 transition-colors"
                    >
                      {node?.properties.name || ps}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* GND continuity networks */}
          <div>
            <span className="flex items-center gap-1 text-text-muted font-bold font-sans uppercase tracking-wide text-[9px] mb-1.5">
              <GitBranch className="h-3 w-3 text-success-400" />
              Ground Continuity Networks
              <span className="text-text-muted/60">({validation.groundNets.length})</span>
            </span>
            {validation.groundNets.length === 0 ? (
              <span className="flex items-center gap-1 text-warning-500 font-sans font-semibold px-1">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                No grounded networks
              </span>
            ) : (
              <div className="space-y-1">
                {validation.groundNets.map((net, i) => (
                  <div key={i} className="bg-surface-850 p-1.5 rounded border border-border">
                    <span className="text-success-400 font-bold font-sans block mb-0.5 text-[9px]">
                      Net #{i} · GND
                    </span>
                    <span className="text-[9px] text-text-secondary leading-relaxed break-words">
                      {net.join(' → ')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Voltage Rails */}
          <div>
            <span className="flex items-center gap-1 text-text-muted font-bold font-sans uppercase tracking-wide text-[9px] mb-1.5">
              <Activity className="h-3 w-3 text-accent-400" />
              Active Voltage Rails
            </span>
            {Object.keys(validation.voltageRails).length === 0 ? (
              <span className="text-text-muted italic font-sans block px-1">None active (V &lt; 0.1V)</span>
            ) : (
              <div className="space-y-1">
                {Object.entries(validation.voltageRails).map(([netName, volt]) => (
                  <div key={netName} className="flex justify-between items-center bg-surface-800 px-2 py-1 rounded border border-transparent hover:border-border transition-colors">
                    <span className="text-text-secondary truncate">{netName}</span>
                    <span className="text-success-400 font-bold tabular-nums shrink-0 ml-2">{volt.toFixed(2)}V</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Connected components counter */}
          <div className="border-t border-surface-800 pt-2 flex justify-between items-center font-sans">
            <span className="text-text-muted">Total Wired Nodes</span>
            <span className="text-text-primary font-bold font-mono tabular-nums">
              {validation.connectedComponents.length} / {storeNodes.length}
            </span>
          </div>

        </div>
      </div>

      {/* 3. Wiring Recommendations & Templates */}
      <div className="flex flex-col border border-border rounded-lg bg-surface-950/60 overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-3 py-2 shrink-0">
          <h3 className="flex items-center gap-1.5 font-bold text-text-primary uppercase tracking-wider text-[10px]">
            <Sparkles className="h-3.5 w-3.5 text-success-500" />
            Auto Wiring Assistant
          </h3>
          {recommendations.length > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-accent-500/10 text-accent-400 border border-accent-500/20 text-[9px] font-bold font-mono tabular-nums">
              {recommendations.length}
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-2.5 space-y-3">

          {/* Smart Templates */}
          <div>
            <span className="text-text-muted font-bold block mb-1.5 tracking-wider uppercase text-[9px]">Select a Template</span>
            <div className="grid grid-cols-2 gap-1.5">
              {Object.entries(WIRING_TEMPLATES).map(([key, value]) => (
                <button
                  key={key}
                  onClick={() => handleLoadTemplate(key)}
                  className="flex flex-col text-left p-2 border border-border bg-surface-850 rounded-md hover:bg-surface-800 hover:border-accent-500/50 transition-colors"
                  title={value.description}
                >
                  <span className="font-semibold text-text-primary truncate block w-full">{value.name}</span>
                  <span className="text-[8px] text-text-muted truncate block w-full mt-0.5">{value.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Suggestions */}
          {recommendations.length > 0 && (
            <div className="border-t border-surface-800 pt-2.5">
              <span className="text-text-muted font-bold block mb-1.5 tracking-wider uppercase text-[9px]">Wiring Recommendations</span>
              <div className="space-y-1.5">
                {recommendations.map((rec) => (
                  <div key={rec.id} className="p-2 border border-accent-500/20 bg-accent-500/5 rounded-md">
                    <p className="font-semibold text-accent-400 flex items-center gap-1">
                      <Info className="h-3 w-3 shrink-0" />
                      {rec.title}
                    </p>
                    <p className="text-[10px] text-text-secondary mt-0.5 leading-relaxed">{rec.message}</p>
                    {rec.actionLabel && (
                      <button
                        onClick={() => handleApplyRecommendation(rec)}
                        className="mt-1.5 flex items-center gap-1 px-2 py-1 bg-accent-600 hover:bg-accent-500 active:bg-accent-700 text-white rounded text-[9px] font-semibold transition-colors"
                      >
                        <PlusCircle className="h-3 w-3" />
                        {rec.actionLabel}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

    </div>
  )
}