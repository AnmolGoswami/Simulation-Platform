import { memo, useState, useMemo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { ComponentSVG } from '@/assets/component-svgs/ComponentSVG'
import { BreadboardNode } from '@/components/breadboard/Breadboard'
import { getComponentDefinition } from '@/utils/componentDefinitions'
import { useSimulatorStore } from '@/store/useSimulatorStore'
import type { ComponentType, PinDefinition } from '@/types'

export interface SimulatorNodeData {
  componentType: ComponentType
  label: string
  rotation: number
  color?: string
  [key: string]: unknown
}

function getBreadboardConnectedHoles(pinId: string, splitPowerRails: boolean): string[] {
  if (pinId.startsWith('hole-')) {
    const parts = pinId.split('-')
    const row = parts[1]
    const col = parts[2]
    const isTopHalf = ['a', 'b', 'c', 'd', 'e'].includes(row)
    const rowGroup = isTopHalf ? ['a', 'b', 'c', 'd', 'e'] : ['f', 'g', 'h', 'i', 'j']
    return rowGroup.map((r) => `hole-${r}-${col}`)
  }
  
  if (pinId.startsWith('rail-')) {
    const parts = pinId.split('-')
    const pos = parts[1] // top or bottom
    const pol = parts[2] // pos or neg
    const col = parseInt(parts[3], 10)
    
    if (splitPowerRails) {
      const isLeft = col <= 15
      const cols = isLeft
        ? Array.from({ length: 15 }, (_, i) => i + 1)
        : Array.from({ length: 15 }, (_, i) => i + 16)
      return cols.map((c) => `rail-${pos}-${pol}-${c}`)
    } else {
      const cols = Array.from({ length: 30 }, (_, i) => i + 1)
      return cols.map((c) => `rail-${pos}-${pol}-${c}`)
    }
  }
  
  return [pinId]
}

function SimulatorComponentNode({ id, data, selected }: NodeProps) {
  const nodeData = data as SimulatorNodeData
  const def = getComponentDefinition(nodeData.componentType)
  const width = def?.defaultWidth ?? 60
  const height = def?.defaultHeight ?? 60

  const [hoveredPinId, setHoveredPinId] = useState<string | null>(null)
  const [tooltipPin, setTooltipPin] = useState<PinDefinition | null>(null)

  // Retrieve properties if node is in store (to check split power rails etc.)
  const storeNode = useSimulatorStore((s) => s.nodes.find((n) => n.id === id))
  const splitPowerRails = storeNode?.properties.splitPowerRails as boolean || false
  const wireToolActive = useSimulatorStore((s) => s.wireToolActive)
  const updateNodeProperties = useSimulatorStore((s) => s.updateNodeProperties)

  const handleNodeClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('.workspace-handle') || target.closest('.tooltip-container')) return

    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left

    if (nodeData.componentType.startsWith('toggle-switch') || nodeData.componentType.startsWith('slide-switch')) {
      const currentState = storeNode?.properties.state
      let nextState: any = false
      if (nodeData.componentType.endsWith('-spst')) {
        nextState = !currentState
      } else {
        nextState = currentState === 'no' ? 'nc' : 'no'
      }
      updateNodeProperties(id, { state: nextState })
      useSimulatorStore.getState().pushHistory()
    } else if (nodeData.componentType.startsWith('dip-switch-')) {
      const currentState = (storeNode?.properties.state as Record<string, boolean>) || {}
      const positions = nodeData.componentType.endsWith('-2') ? 2 : nodeData.componentType.endsWith('-4') ? 4 : 8
      const colWidth = rect.width / positions
      const switchIdx = Math.max(1, Math.min(positions, Math.floor(clickX / colWidth) + 1))
      const key = `s${switchIdx}`
      const nextState = { ...currentState, [key]: !currentState[key] }
      updateNodeProperties(id, { state: nextState })
      useSimulatorStore.getState().pushHistory()
    }
  }

  const hoveredConnectedPins = useMemo(() => {
    if (!hoveredPinId || nodeData.componentType !== 'breadboard') return []
    return getBreadboardConnectedHoles(hoveredPinId, splitPowerRails)
  }, [hoveredPinId, nodeData.componentType, splitPowerRails])

  const renderPinTooltip = (pin: PinDefinition) => {
    const isDigital = pin.type === 'digital' || pin.type === 'gpio' || pin.type === 'bus'
    const isAnalog = pin.isAnalog || pin.type === 'analog'
    const isPWM = pin.isPWM
    const direction = pin.direction ? pin.direction.toUpperCase() : 'GPIO'

    return (
      <div className="absolute bottom-full left-1/2 z-50 mb-2 w-40 -translate-x-1/2 rounded-md border border-surface-700 bg-surface-900/95 p-2 text-[10px] text-text-secondary shadow-xl backdrop-blur-sm pointer-events-none">
        <div className="font-semibold text-text-primary border-b border-surface-700 pb-1 mb-1">
          {pin.label}
        </div>
        <div className="flex justify-between mb-0.5">
          <span>Voltage:</span>
          <span className="text-accent-400 font-mono">
            {pin.voltageLimit !== undefined ? `${pin.voltageLimit}V Max` : '5V Tolerant'}
          </span>
        </div>
        {pin.currentLimit !== undefined && (
          <div className="flex justify-between mb-0.5">
            <span>Current:</span>
            <span className="text-warning-400 font-mono">{(pin.currentLimit * 1000).toFixed(0)}mA Max</span>
          </div>
        )}
        <div className="flex justify-between mb-0.5">
          <span>Type:</span>
          <span className="text-text-primary">{direction}</span>
        </div>
        <div className="mt-1 flex flex-wrap gap-1 border-t border-surface-800 pt-1.5">
          {isDigital && <span className="bg-blue-500/10 text-blue-400 px-1 rounded-sm text-[8px]">DIGITAL</span>}
          {isAnalog && <span className="bg-orange-500/10 text-orange-400 px-1 rounded-sm text-[8px]">ANALOG</span>}
          {isPWM && <span className="bg-purple-500/10 text-purple-400 px-1 rounded-sm text-[8px]">PWM</span>}
          {pin.type === 'power' && <span className="bg-red-500/10 text-red-400 px-1 rounded-sm text-[8px]">POWER</span>}
          {pin.type === 'ground' && <span className="bg-gray-500/10 text-gray-400 px-1 rounded-sm text-[8px]">GND</span>}
        </div>
      </div>
    )
  }

  if (nodeData.componentType === 'breadboard') {
    return (
      <div
        className={`relative transition-transform ${
          selected ? 'ring-2 ring-accent-400 rounded-sm' : ''
        }`}
        style={{
          transform: `rotate(${nodeData.rotation}deg)`,
          width: width,
          height: height,
        }}
      >
        <BreadboardNode selected={selected} />

        {def?.pins.map((pin) => {
          const isHighlighted = hoveredConnectedPins.includes(pin.id)
          return (
            <div
              key={pin.id}
              className="absolute"
              style={{
                left: `${pin.x}px`,
                top: `${pin.y}px`,
                transform: 'translate(-50%, -50%)',
                zIndex: 20,
              }}
              onMouseEnter={() => {
                setHoveredPinId(pin.id)
                setTooltipPin(pin)
              }}
              onMouseLeave={() => {
                setHoveredPinId(null)
                setTooltipPin(null)
              }}
            >
              <Handle
                type="source"
                position={Position.Top}
                id={pin.id}
                style={{
                  position: 'relative',
                  left: 0,
                  top: 0,
                  transform: 'none',
                  background: isHighlighted
                    ? '#22c55e'
                    : pin.type === 'power'
                      ? '#dc2626'
                      : pin.type === 'ground'
                        ? '#2563eb'
                        : '#9ca3af',
                  width: isHighlighted ? 6 : 4,
                  height: isHighlighted ? 6 : 4,
                  borderRadius: '50%',
                  border: isHighlighted ? '1.5px solid white' : 'none',
                  opacity: isHighlighted ? 1 : (wireToolActive ? 0.35 : 0.05),
                  cursor: 'crosshair',
                  transition: 'opacity 0.15s, transform 0.15s, background-color 0.15s',
                }}
                className={`hover:!opacity-100 hover:scale-150 ${wireToolActive ? 'animate-pulse' : ''}`}
              />
              {tooltipPin?.id === pin.id && renderPinTooltip(pin)}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div
      onClick={handleNodeClick}
      className={`relative rounded-lg border bg-surface-850/80 p-1 backdrop-blur-sm transition-shadow ${
        selected ? 'border-accent-400 shadow-lg shadow-accent-500/20' : 'border-border'
      }`}
      style={{
        transform: `rotate(${nodeData.rotation}deg)`,
        width: width + 8,
        minHeight: height + 8,
      }}
    >
      {storeNode?.properties.temperature !== undefined && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-surface-950 border border-border px-1.5 py-0.5 rounded text-[8px] font-bold text-accent-400 whitespace-nowrap shadow-md z-30 flex items-center gap-1">
          🌡️ {String(storeNode.properties.temperature)}°C
          {storeNode.properties.humidity !== undefined && ` | 💧 ${String(storeNode.properties.humidity)}%`}
        </div>
      )}

      <ComponentSVG
        type={nodeData.componentType}
        width={width}
        height={height}
        color={nodeData.color}
        selected={selected}
        state={storeNode?.properties.state}
        properties={storeNode?.properties}
      />

      {/* Inline controls for sensors (potentiometer, dht22, ds18b20, lm35) */}
      {['lm35', 'dht22', 'ds18b20', 'potentiometer'].includes(nodeData.componentType) && (
        <div className="nodrag mt-2 border-t border-surface-800/60 pt-2 flex flex-col gap-1.5 text-[8px] text-text-secondary select-none">
          {nodeData.componentType === 'potentiometer' && (
            <div className="flex flex-col gap-0.5">
              <div className="flex justify-between text-text-muted font-bold">
                <span>WIPER</span>
                <span className="text-accent-400 font-mono">
                  {Math.round((Number(storeNode?.properties.resistance ?? 10000) / 10000) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="10000"
                step="100"
                value={Number(storeNode?.properties.resistance ?? 10000)}
                onChange={(e) => updateNodeProperties(id, { resistance: Number(e.target.value) })}
                className="w-full h-1 bg-surface-700 rounded-sm appearance-none cursor-pointer accent-accent-500"
              />
            </div>
          )}
          {['lm35', 'ds18b20', 'dht22'].includes(nodeData.componentType) && (
            <div className="flex flex-col gap-0.5">
              <div className="flex justify-between text-text-muted font-bold">
                <span>TEMP</span>
                <span className="text-red-400 font-mono">
                  {Number(storeNode?.properties.temperature ?? 25)}°C
                </span>
              </div>
              <input
                type="range"
                min="-40"
                max="125"
                step="1"
                value={Number(storeNode?.properties.temperature ?? 25)}
                onChange={(e) => updateNodeProperties(id, { temperature: Number(e.target.value) })}
                className="w-full h-1 bg-surface-700 rounded-sm appearance-none cursor-pointer accent-accent-500"
              />
            </div>
          )}
          {nodeData.componentType === 'dht22' && (
            <div className="flex flex-col gap-0.5">
              <div className="flex justify-between text-text-muted font-bold">
                <span>HUM</span>
                <span className="text-blue-400 font-mono">
                  {Number(storeNode?.properties.humidity ?? 50)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={Number(storeNode?.properties.humidity ?? 50)}
                onChange={(e) => updateNodeProperties(id, { humidity: Number(e.target.value) })}
                className="w-full h-1 bg-surface-700 rounded-sm appearance-none cursor-pointer accent-accent-500"
              />
            </div>
          )}
        </div>
      )}

      <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] text-text-muted bg-surface-950/60 px-1 rounded-sm">
        {nodeData.label}
      </div>

      {def?.pins.map((pin) => {
        let side = Position.Left
        if (pin.y <= 12) side = Position.Top
        else if (pin.y >= height - 12) side = Position.Bottom
        else if (pin.x >= width - 12) side = Position.Right
        else if (pin.x <= 12) side = Position.Left

        return (
          <div
            key={pin.id}
            className="absolute"
            style={{
              left: `${pin.x + 4}px`, // accounting for p-1 wrapper
              top: `${pin.y + 4}px`,
              transform: 'translate(-50%, -50%)',
              zIndex: 20,
            }}
            onMouseEnter={() => setTooltipPin(pin)}
            onMouseLeave={() => setTooltipPin(null)}
          >
            <Handle
              type="source"
              position={side}
              id={pin.id}
              style={{
                position: 'relative',
                left: 0,
                top: 0,
                transform: 'none',
                background: pin.type === 'power'
                  ? '#ef4444'
                  : pin.type === 'ground'
                    ? '#1e293b'
                    : pin.type === 'bus'
                      ? '#22c55e'
                      : '#3b82f6',
                width: 7,
                height: 7,
                borderRadius: '50%',
                border: '1.5px solid #ffffff',
                cursor: 'crosshair',
                transition: 'transform 0.15s, background-color 0.15s',
              }}
              className="hover:scale-150 hover:bg-accent-400"
            />
            {tooltipPin?.id === pin.id && renderPinTooltip(pin)}
          </div>
        )
      })}
    </div>
  )
}

export default memo(SimulatorComponentNode)
