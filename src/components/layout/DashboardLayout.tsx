import { lazy, Suspense, useEffect, Component, type ReactNode } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { AlertTriangle, RotateCw } from 'lucide-react'
import { Header } from './Header'
import { ResizablePanel } from './ResizablePanel'
import { BottomPanel } from './BottomPanel'
import { ComponentLibrary } from '@/components/component-library/ComponentLibrary'
import { PropertiesInspector } from '@/components/workspace/PropertiesInspector'
import { useResizable } from '@/hooks/useResizable'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useSimulatorStore } from '@/store/useSimulatorStore'

const SimulationWorkspace = lazy(
  () => import('@/components/workspace/SimulationWorkspace'),
)
const CodeEditor = lazy(() => import('@/components/editor/CodeEditor'))

function PanelLoader({ label }: { label?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 bg-surface-900">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
      {label && <span className="text-[10px] text-text-muted">{label}</span>}
    </div>
  )
}

// Lazy-loaded panels (the simulation canvas, the code editor) live behind a
// dynamic import. If that chunk fails to fetch — flaky network, a stale
// deploy, an ad-blocker choking on the request — an unguarded <Suspense>
// lets the thrown error bubble all the way up and blank the entire app,
// including the header and both side panels that were rendering fine.
// This boundary contains the failure to just the panel that broke, and
// gives the user a way to retry without reloading the whole simulator
// (which would also blow away any unsaved wiring/code).
class PanelErrorBoundary extends Component<
  { children: ReactNode; label: string },
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    console.error('Panel failed to load:', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-2 bg-surface-900 px-4 text-center">
          <AlertTriangle className="h-6 w-6 text-danger-500" />
          <p className="text-[11px] text-text-secondary">
            {this.props.label} failed to load.
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="flex items-center gap-1.5 rounded-md border border-border bg-surface-800 px-2.5 py-1 text-[10px] font-semibold text-text-secondary hover:bg-surface-700 hover:text-text-primary transition-colors"
          >
            <RotateCw className="h-3 w-3" />
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export function DashboardLayout() {
  const panelSizes = useSimulatorStore((s) => s.panelSizes)
  const setPanelSizes = useSimulatorStore((s) => s.setPanelSizes)
  const bottomPanelOpen = useSimulatorStore((s) => s.bottomPanelOpen)
  const { handleKeyDown } = useKeyboardShortcuts()

  const leftPanel = useResizable({
    initialSize: panelSizes.leftWidth,
    minSize: 220,
    maxSize: 420,
    direction: 'horizontal',
    onResize: (size) => setPanelSizes({ leftWidth: size }),
  })

  const rightPanel = useResizable({
    initialSize: panelSizes.rightWidth,
    minSize: 320,
    maxSize: 600,
    direction: 'horizontal',
    invert: true,
    onResize: (size) => setPanelSizes({ rightWidth: size }),
  })

  const bottomPanel = useResizable({
    initialSize: panelSizes.bottomHeight,
    minSize: 120,
    maxSize: 400,
    direction: 'vertical',
    invert: true,
    onResize: (size) => setPanelSizes({ bottomHeight: size }),
  })

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <ReactFlowProvider>
      {/*
        Note: no blanket `select-none` on the root here. A global
        text-selection lock also blocks selecting diagnostics output,
        pin labels, error messages, and code in the editor — not just
        the resize handles it was meant to protect. ResizablePanel
        already locks selection on `document.body` for the exact
        duration of a drag, which is the correct scope for that fix.
      */}
      <div className="flex h-screen flex-col overflow-hidden bg-surface-950 text-text-secondary">
        <Header />
        <div className="flex flex-1 overflow-hidden">
          <ResizablePanel
            size={leftPanel.size}
            direction="horizontal"
            position="start"
            onResize={leftPanel.handleMouseDown}
            isDragging={leftPanel.isDragging}
            className="border-r border-border bg-surface-900"
          >
            <ComponentLibrary />
          </ResizablePanel>

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="relative min-h-0 flex-1">
              <PanelErrorBoundary label="Simulation workspace">
                <Suspense fallback={<PanelLoader label="Loading workspace…" />}>
                  <SimulationWorkspace />
                </Suspense>
              </PanelErrorBoundary>
            </div>

            {bottomPanelOpen && (
              <ResizablePanel
                size={bottomPanel.size}
                direction="vertical"
                position="end"
                onResize={bottomPanel.handleMouseDown}
                isDragging={bottomPanel.isDragging}
                className="border-t border-border bg-surface-900"
              >
                <BottomPanel />
              </ResizablePanel>
            )}
          </div>

          <ResizablePanel
            size={rightPanel.size}
            direction="horizontal"
            position="end"
            onResize={rightPanel.handleMouseDown}
            isDragging={rightPanel.isDragging}
            className="border-l border-border bg-surface-900"
          >
            <div className="flex h-full flex-col">
              <PanelErrorBoundary label="Code editor">
                <Suspense fallback={<PanelLoader label="Loading editor…" />}>
                  <CodeEditor />
                </Suspense>
              </PanelErrorBoundary>
              <PropertiesInspector />
            </div>
          </ResizablePanel>
        </div>
      </div>
    </ReactFlowProvider>
  )
}