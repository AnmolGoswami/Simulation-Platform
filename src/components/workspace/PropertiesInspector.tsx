import {
  Settings2,
  Trash2,
  Copy,
  RotateCw,
  Lock,
  Unlock,
  ToggleLeft,
  ToggleRight,
  Gauge,
  Thermometer,
  Droplets,
} from 'lucide-react'
import { PanelHeader } from '@/components/layout/ResizablePanel'
import { useSimulatorStore, useSelectedNode } from '@/store/useSimulatorStore'
import { getComponentDefinition } from '@/utils/componentDefinitions'

const COLOR_BUBBLES = [
  { id: 'red', name: 'Positive (Red)', hex: '#ef4444' },
  { id: 'black', name: 'Ground (Black)', hex: '#18181b' },
  { id: 'green', name: 'I2C (Green)', hex: '#10b981' },
  { id: 'yellow', name: 'Signal (Yellow)', hex: '#f59e0b' },
  { id: 'blue', name: 'PWM (Blue)', hex: '#3b82f6' },
  { id: 'orange', name: 'Analog (Orange)', hex: '#f97316' },
  { id: 'purple', name: 'SPI (Purple)', hex: '#8b5cf6' },
  { id: 'white', name: 'Signal (White)', hex: '#f8fafc' },
]

export function PropertiesInspector() {
  const selectedNode = useSelectedNode()
  const selectedEdgeIds = useSimulatorStore((s) => s.selectedEdgeIds)
  const edges = useSimulatorStore((s) => s.edges)
  
  const updateNodeProperties = useSimulatorStore((s) => s.updateNodeProperties)
  const removeNode = useSimulatorStore((s) => s.removeNode)
  const duplicateNode = useSimulatorStore((s) => s.duplicateNode)
  const rotateNode = useSimulatorStore((s) => s.rotateNode)

  const updateEdge = useSimulatorStore((s) => s.updateEdge)
  const removeEdge = useSimulatorStore((s) => s.removeEdge)

  const selectedEdge = edges.find((e) => e.id === selectedEdgeIds[0])

  const bringToFront = useSimulatorStore((s) => s.bringToFront)
  const sendToBack = useSimulatorStore((s) => s.sendToBack)
  const resetLayers = useSimulatorStore((s) => s.resetLayers)

  // Hoist workspace visual configuration hooks to avoid conditional React hook calls
  const workspaceBg = useSimulatorStore((s) => s.workspaceBackground)
  const gridStyle = useSimulatorStore((s) => s.gridStyle)
  const gridOpacity = useSimulatorStore((s) => s.gridOpacity)
  const gridSpacing = useSimulatorStore((s) => s.gridSpacing)
  const workbenchTheme = useSimulatorStore((s) => s.workbenchTheme)

  const setWorkspaceBackground = useSimulatorStore((s) => s.setWorkspaceBackground)
  const setGridStyle = useSimulatorStore((s) => s.setGridStyle)
  const setGridOpacity = useSimulatorStore((s) => s.setGridOpacity)
  const setGridSpacing = useSimulatorStore((s) => s.setGridSpacing)
  const setWorkbenchTheme = useSimulatorStore((s) => s.setWorkbenchTheme)

  // CASE 1: Render Wire Properties
  if (selectedEdge && !selectedNode) {
    const isLocked = selectedEdge.isLocked || false
    return (
      <div className="flex max-h-64 shrink-0 flex-col border-t border-border">
        <PanelHeader
          title="Wire Properties"
          icon={<Settings2 className="h-3.5 w-3.5" />}
          actions={
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => updateEdge(selectedEdge.id, { isLocked: !isLocked })}
                className={`rounded p-1 transition-colors ${
                  isLocked ? 'text-warning-500 bg-warning-500/10' : 'text-text-muted hover:bg-surface-700'
                }`}
                title={isLocked ? 'Unlock wire' : 'Lock wire'}
              >
                {isLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
              </button>
              <button
                type="button"
                disabled={isLocked}
                onClick={() => removeEdge(selectedEdge.id)}
                className="rounded p-1 text-text-muted hover:bg-danger-500/20 hover:text-danger-500 disabled:opacity-30"
                title="Delete wire"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          }
        />

        <div className="overflow-y-auto p-3 grid grid-cols-2 gap-3">
          {/* Wire Color Selection */}
          <div className="col-span-2">
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-text-muted">
              Wire Color
            </label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {COLOR_BUBBLES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  disabled={isLocked}
                  onClick={() => updateEdge(selectedEdge.id, { color: c.id as any })}
                  className={`h-5 w-5 rounded-full border transition-all hover:scale-110 ${
                    selectedEdge.color === c.id
                      ? 'border-white ring-2 ring-accent-500 scale-105'
                      : 'border-surface-700'
                  }`}
                  style={{ backgroundColor: c.hex }}
                  title={c.name}
                />
              ))}
            </div>
          </div>

          {/* Wire Label */}
          <div>
            <PropertyField
              label="Wire Label"
              value={selectedEdge.label || ''}
              disabled={isLocked}
              onChange={(v) => updateEdge(selectedEdge.id, { label: v })}
            />
          </div>

          {/* Wire Thickness */}
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-text-muted">
              Thickness ({selectedEdge.thickness || 2}px)
            </label>
            <input
              type="range"
              min="1"
              max="8"
              disabled={isLocked}
              value={selectedEdge.thickness || 2}
              onChange={(e) => updateEdge(selectedEdge.id, { thickness: parseInt(e.target.value) })}
              className="w-full h-1 bg-surface-700 rounded-lg appearance-none cursor-pointer accent-accent-500"
            />
          </div>

          {/* Curved vs Orthogonal Routing */}
          <div className="col-span-2 flex items-center justify-between border-t border-surface-800 pt-2 mt-1">
            <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
              Curved Bezier Routing
            </span>
            <button
              type="button"
              disabled={isLocked}
              onClick={() => updateEdge(selectedEdge.id, { curved: !selectedEdge.curved })}
              className="text-text-secondary hover:text-text-primary disabled:opacity-40"
            >
              {selectedEdge.curved ? (
                <ToggleRight className="h-6 w-6 text-accent-400" />
              ) : (
                <ToggleLeft className="h-6 w-6 text-text-muted" />
              )}
            </button>
          </div>

          {/* Wire Routing Tip */}
          <div className="col-span-2 border-t border-surface-800 pt-3 mt-1 text-[10px] text-text-muted leading-relaxed">
            <span className="font-bold text-accent-400">💡 Wire Routing Tip:</span>
            <ul className="list-disc pl-4 mt-1 space-y-1">
              <li>Double-click the wire to add a draggable bend/routing point.</li>
              <li>Drag the blue circles to route the wire around components.</li>
              <li>Right-click a bend point to remove it.</li>
            </ul>
          </div>
        </div>
      </div>
    )
  }

  // CASE 2: Render Workspace CAD Properties
  if (!selectedNode) {

    return (
      <div className="flex max-h-64 shrink-0 flex-col border-t border-border bg-surface-900 text-xs">
        <PanelHeader title="CAD Workspace Settings" icon={<Settings2 className="h-3.5 w-3.5 text-accent-400" />} />
        
        <div className="overflow-y-auto p-3 grid grid-cols-2 gap-2.5">
          {/* Workspace Background */}
          <div>
            <label className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-text-muted">
              Background Canvas
            </label>
            <select
              value={workspaceBg}
              onChange={(e) => setWorkspaceBackground(e.target.value as any)}
              className="w-full rounded border border-border bg-surface-850 px-2 py-1 text-text-primary text-xs"
            >
              <option value="dark-blue">CAD Dark Blue</option>
              <option value="light-grid">Light Workspace</option>
              <option value="engineering">Engineering Paper</option>
              <option value="graph">Graph Grid Paper</option>
              <option value="pcb-green">PCB Green Mask</option>
              <option value="grey-cad">Graphite CAD Grey</option>
              <option value="white">Blank Whiteboard</option>
            </select>
          </div>

          {/* Grid Style */}
          <div>
            <label className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-text-muted">
              Grid Layout
            </label>
            <select
              value={gridStyle}
              onChange={(e) => setGridStyle(e.target.value as any)}
              className="w-full rounded border border-border bg-surface-850 px-2 py-1 text-text-primary text-xs"
            >
              <option value="dots">Aligned Dots</option>
              <option value="squares">Square Grid</option>
              <option value="engineering">Fine Engineering</option>
              <option value="pcb">Copper PCB Crosses</option>
              <option value="none">No Grid</option>
            </select>
          </div>

          {/* Grid Opacity Slider */}
          <div>
            <label className="mb-1 flex justify-between text-[9px] font-bold uppercase tracking-wider text-text-muted">
              <span>Grid Opacity</span>
              <span className="font-mono text-accent-400 font-bold">{Math.round(gridOpacity * 100)}%</span>
            </label>
            <input
              type="range"
              min="0.05"
              max="0.80"
              step="0.05"
              value={gridOpacity}
              onChange={(e) => setGridOpacity(parseFloat(e.target.value))}
              className="w-full h-1 bg-surface-700 rounded-lg appearance-none cursor-pointer accent-accent-500"
            />
          </div>

          {/* Grid Spacing Slider */}
          <div>
            <label className="mb-1 flex justify-between text-[9px] font-bold uppercase tracking-wider text-text-muted">
              <span>Grid Cell size</span>
              <span className="font-mono text-accent-400 font-bold">{gridSpacing}px</span>
            </label>
            <input
              type="range"
              min="10"
              max="50"
              step="5"
              value={gridSpacing}
              onChange={(e) => setGridSpacing(parseInt(e.target.value))}
              className="w-full h-1 bg-surface-700 rounded-lg appearance-none cursor-pointer accent-accent-500"
            />
          </div>

          {/* Workbench Theme Profile */}
          <div className="col-span-2 border-t border-surface-800 pt-2.5 mt-1">
            <label className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-text-muted">
              Workbench Visual Skin Theme
            </label>
            <select
              value={workbenchTheme}
              onChange={(e) => setWorkbenchTheme(e.target.value as any)}
              className="w-full rounded border border-border bg-surface-850 px-2 py-1 text-text-primary text-xs"
            >
              <option value="dark">Professional Dark Engineering</option>
              <option value="light">Professional Light Workbench</option>
              <option value="wokwi">Wokwi Inspired Mint</option>
              <option value="tinkercad">Tinkercad Inspired Blue</option>
              <option value="proteus">Proteus Inspired Schematic</option>
              <option value="pcb">Copper-clad PCB Green</option>
              <option value="engineering-blue">Aviation Blueprint Blue</option>
            </select>
          </div>
        </div>
      </div>
    )
  }

  const def = getComponentDefinition(selectedNode.type)
  const { properties } = selectedNode

  return (
    <div className="flex max-h-64 shrink-0 flex-col border-t border-border bg-surface-900">
      <PanelHeader
        title="Properties"
        icon={<Settings2 className="h-3.5 w-3.5" />}
        actions={
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => rotateNode(selectedNode.id)}
              className="rounded p-1 text-text-muted hover:bg-surface-700 hover:text-text-secondary"
              title="Rotate"
            >
              <RotateCw className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => duplicateNode(selectedNode.id)}
              className="rounded p-1 text-text-muted hover:bg-surface-700 hover:text-text-secondary"
              title="Duplicate"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => removeNode(selectedNode.id)}
              className="rounded p-1 text-text-muted hover:bg-danger-500/20 hover:text-danger-500"
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        }
      />

      <div className="overflow-y-auto p-3">
        <div className="mb-3">
          <p className="text-xs font-bold text-text-primary flex items-center gap-1.5">
            <Gauge className="h-3.5 w-3.5 text-accent-400" />
            {def?.name}
          </p>
          <p className="text-[10px] text-text-muted mt-0.5">{def?.description}</p>
        </div>

        <div className="space-y-2.5">
          <PropertyField
            label="Name"
            value={properties.name}
            onChange={(v) => updateNodeProperties(selectedNode.id, { name: v })}
          />

          <div className="grid grid-cols-2 gap-2">
            <PropertyField
              label="Rotation"
              value={String(properties.rotation)}
              type="number"
              onChange={(v) =>
                updateNodeProperties(selectedNode.id, { rotation: Number(v) || 0 })
              }
            />

            {properties.gpio !== undefined && (
              <PropertyField
                label="GPIO"
                value={String(properties.gpio)}
                type="number"
                onChange={(v) =>
                  updateNodeProperties(selectedNode.id, { gpio: Number(v) || 0 })
                }
              />
            )}

            {properties.voltage !== undefined && (
              <PropertyField
                label="Voltage (V)"
                value={String(properties.voltage)}
                type="number"
                onChange={(v) =>
                  updateNodeProperties(selectedNode.id, { voltage: Number(v) || 0 })
                }
              />
            )}

            {properties.resistance !== undefined && (
              <PropertyField
                label="Resistance (Ω)"
                value={String(properties.resistance)}
                type="number"
                onChange={(v) =>
                  updateNodeProperties(selectedNode.id, { resistance: Number(v) || 0 })
                }
              />
            )}

            {properties.capacitance !== undefined && (
              <PropertyField
                label={selectedNode.type === 'super-capacitor' ? "Capacitance (F)" : "Capacitance (µF)"}
                value={String(properties.capacitance)}
                type="number"
                onChange={(v) =>
                  updateNodeProperties(selectedNode.id, { capacitance: Math.max(0.001, Number(v) || 0) })
                }
              />
            )}

            {properties.storedVoltage !== undefined && selectedNode.type === 'super-capacitor' && (
              <PropertyField
                label="Stored Charge (V)"
                value={Number(properties.storedVoltage).toFixed(2)}
                type="number"
                onChange={(v) =>
                  updateNodeProperties(selectedNode.id, { storedVoltage: Math.max(0, Number(v) || 0) })
                }
              />
            )}

            {properties.storedCapVoltage !== undefined && (selectedNode.type === 'capacitor' || selectedNode.type === 'electrolytic-capacitor' || selectedNode.type === 'ceramic-capacitor') && (
              <PropertyField
                label="Stored Voltage (V)"
                value={Number(properties.storedCapVoltage).toFixed(2)}
                type="number"
                onChange={(v) =>
                  updateNodeProperties(selectedNode.id, { storedCapVoltage: Math.max(0, Number(v) || 0) })
                }
              />
            )}

            {selectedNode.type === 'fuse' && (
              <div className="flex flex-col gap-2 border-t border-surface-800 pt-2 mt-2">
                <PropertyField
                  label="Current Limit (A)"
                  value={String(properties.currentLimit ?? 1.0)}
                  type="number"
                  onChange={(v) =>
                    updateNodeProperties(selectedNode.id, { currentLimit: Math.max(0.01, Number(v) || 1.0) })
                  }
                />
                <button
                  type="button"
                  onClick={() => updateNodeProperties(selectedNode.id, { blown: !properties.blown })}
                  className={`w-full py-1.5 px-3 rounded text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm ${
                    properties.blown
                      ? 'bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30'
                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30'
                  }`}
                >
                  {properties.blown ? '💥 Fuse Blown (Click to Replace/Reset)' : '⚡ Fuse Intact (Click to Blow)'}
                </button>
              </div>
            )}
          </div>

          {/* Temperature Controls */}
          {properties.temperature !== undefined && (
            <div className="border-t border-surface-800 pt-2 mt-2">
              <label className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-text-muted">
                <span className="flex items-center gap-1"><Thermometer className="h-3 w-3 text-red-400" /> Temperature</span>
                <span className="text-accent-400 font-mono font-bold text-xs">{String(properties.temperature)}°C</span>
              </label>
              <input
                type="range"
                min="-40"
                max="125"
                step="1"
                value={Number(properties.temperature)}
                onChange={(e) => updateNodeProperties(selectedNode.id, { temperature: Number(e.target.value) })}
                className="w-full h-1.5 bg-surface-700 rounded-lg appearance-none cursor-pointer accent-accent-500"
              />
            </div>
          )}

          {/* Humidity Controls */}
          {properties.humidity !== undefined && (
            <div className="border-t border-surface-800 pt-2">
              <label className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-text-muted">
                <span className="flex items-center gap-1"><Droplets className="h-3 w-3 text-blue-400" /> Humidity</span>
                <span className="text-accent-400 font-mono font-bold text-xs">{String(properties.humidity)}%</span>
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={Number(properties.humidity)}
                onChange={(e) => updateNodeProperties(selectedNode.id, { humidity: Number(e.target.value) })}
                className="w-full h-1.5 bg-surface-700 rounded-lg appearance-none cursor-pointer accent-accent-500"
              />
            </div>
          )}

          {properties.color !== undefined && (
            <div>
              <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-text-muted">
                Color Override
              </label>
              <input
                type="color"
                value={String(properties.color)}
                onChange={(e) =>
                  updateNodeProperties(selectedNode.id, { color: e.target.value })
                }
                className="h-7 w-full cursor-pointer rounded border border-border bg-surface-850"
              />
            </div>
          )}

          {/* CAD Stacking Depth Controls */}
          <div className="border-t border-surface-800 pt-2 mt-1">
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-text-muted">
              CAD Stacking Layer
            </label>
            <div className="flex gap-1.5 mt-1">
              <button
                type="button"
                onClick={() => bringToFront(selectedNode.id)}
                className="flex-1 bg-surface-800 border border-border hover:bg-surface-700 text-text-primary px-1.5 py-1 rounded transition-colors text-[9px] font-semibold text-center"
              >
                Bring Front
              </button>
              <button
                type="button"
                onClick={() => sendToBack(selectedNode.id)}
                className="flex-1 bg-surface-800 border border-border hover:bg-surface-700 text-text-primary px-1.5 py-1 rounded transition-colors text-[9px] font-semibold text-center"
              >
                Send Back
              </button>
              <button
                type="button"
                onClick={() => resetLayers()}
                className="flex-1 bg-surface-800 border border-border hover:bg-surface-700 text-text-primary px-1.5 py-1 rounded transition-colors text-[9px] font-semibold text-center"
                title="Reset layering z-indexes based on component class"
              >
                Auto depth
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function PropertyField({
  label,
  value,
  type = 'text',
  disabled = false,
  onChange,
}: {
  label: string
  value: string
  type?: string
  disabled?: boolean
  onChange: (value: string) => void
}) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-text-muted">
        {label}
      </label>
      <input
        type={type}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-border bg-surface-850 px-2 py-1 text-xs text-text-primary focus:border-accent-500 focus:outline-none disabled:opacity-40"
      />
    </div>
  )
}
