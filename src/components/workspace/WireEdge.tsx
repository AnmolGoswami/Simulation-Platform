import React, { useState } from 'react'
import { useReactFlow, type EdgeProps } from '@xyflow/react'
import { useSimulatorStore } from '@/store/useSimulatorStore'

const COLOR_MAP: Record<string, string> = {
  red: '#ef4444',
  black: '#18181b',
  green: '#10b981',
  yellow: '#f59e0b',
  blue: '#3b82f6',
  orange: '#f97316',
  purple: '#8b5cf6',
  white: '#f8fafc',
}

export default function WireEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  selected,
  data,
}: EdgeProps) {
  const { screenToFlowPosition } = useReactFlow()
  const updateEdge = useSimulatorStore((s) => s.updateEdge)
  const pushHistory = useSimulatorStore((s) => s.pushHistory)

  // Dragging state for bending points
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null)

  const wireColor = (data?.color as string) || 'red'
  const hexColor = COLOR_MAP[wireColor] || COLOR_MAP.red
  const thickness = (data?.thickness as number) || 2
  const label = data?.label as string | undefined
  const isLocked = data?.isLocked as boolean | undefined
  const isHidden = data?.isHidden as boolean | undefined
  const curved = data?.curved as boolean | undefined
  const bendingPoints = (data?.bendingPoints as { x: number; y: number }[]) || []
  const currentFlow = (data?.currentFlow as number) || 0

  if (isHidden) return null

  // Calculate paths
  const getOrthogonalPath = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    points: { x: number; y: number }[]
  ) => {
    let path = `M ${x1} ${y1}`
    let prevX = x1
    let prevY = y1

    for (const pt of points) {
      const midX = prevX + (pt.x - prevX) / 2
      path += ` L ${midX} ${prevY} L ${midX} ${pt.y} L ${pt.x} ${pt.y}`
      prevX = pt.x
      prevY = pt.y
    }

    const midX = prevX + (x2 - prevX) / 2
    path += ` L ${midX} ${prevY} L ${midX} ${y2} L ${x2} ${y2}`
    return path
  }

  const getCurvedPath = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    points: { x: number; y: number }[]
  ) => {
    if (points.length === 0) {
      const dx = Math.max(Math.abs(x1 - x2) / 2, 40)
      return `M ${x1} ${y1} C ${x1 + (x2 > x1 ? dx : -dx)} ${y1}, ${x2 + (x2 > x1 ? -dx : dx)} ${y2}, ${x2} ${y2}`
    }

    let path = `M ${x1} ${y1}`
    let prev = { x: x1, y: y1 }
    for (let i = 0; i < points.length; i++) {
      const pt = points[i]
      const midX = (prev.x + pt.x) / 2
      const midY = (prev.y + pt.y) / 2
      path += ` Q ${prev.x} ${prev.y}, ${midX} ${midY}`
      prev = pt
    }
    path += ` T ${x2} ${y2}`
    return path
  }

  const edgePath = curved
    ? getCurvedPath(sourceX, sourceY, targetX, targetY, bendingPoints)
    : getOrthogonalPath(sourceX, sourceY, targetX, targetY, bendingPoints)

  // Label coordinate (mid-point of the edge)
  const getLabelCoords = () => {
    if (bendingPoints.length > 0) {
      const midIdx = Math.floor(bendingPoints.length / 2)
      return { x: bendingPoints[midIdx].x, y: bendingPoints[midIdx].y }
    }
    return { x: (sourceX + targetX) / 2, y: (sourceY + targetY) / 2 }
  }

  const labelCoords = getLabelCoords()

  // Handle double click to add bending point
  const handleDoubleClick = (e: React.MouseEvent) => {
    if (isLocked) return
    e.stopPropagation()
    const coords = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    
    // Insert point: we can sort them by distance to source to keep them ordered
    const newPoints = [...bendingPoints, coords]
    updateEdge(id, { bendingPoints: newPoints })
    pushHistory()
  }

  // Handle dragging bending point
  const handleBendingPointMouseDown = (e: React.MouseEvent, index: number) => {
    if (isLocked) return
    e.stopPropagation()
    e.preventDefault()
    setDraggingIdx(index)

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const coords = screenToFlowPosition({ x: moveEvent.clientX, y: moveEvent.clientY })
      const updatedPoints = [...bendingPoints]
      updatedPoints[index] = coords
      updateEdge(id, { bendingPoints: updatedPoints })
    }

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      setDraggingIdx(null)
      pushHistory()
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  const handleBendingPointRightClick = (e: React.MouseEvent, index: number) => {
    if (isLocked) return
    e.preventDefault()
    e.stopPropagation()
    const updatedPoints = [...bendingPoints]
    updatedPoints.splice(index, 1)
    updateEdge(id, { bendingPoints: updatedPoints })
    pushHistory()
  }

  // Styling
  const shadowFilter = selected ? 'drop-shadow(0 0 4px rgba(59, 130, 246, 0.6))' : ''
  const isAnimating = currentFlow !== 0

  return (
    <>
      {/* Thick invisible background path for easy hovering and double clicking */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={14}
        className="cursor-pointer"
        onDoubleClick={handleDoubleClick}
      />

      {/* Selected Glow Path */}
      {selected && (
        <path
          d={edgePath}
          fill="none"
          stroke="#60a5fa"
          strokeWidth={thickness + 4}
          opacity={0.3}
          style={{ pointerEvents: 'none' }}
        />
      )}

      {/* Main wire path */}
      <path
        d={edgePath}
        fill="none"
        stroke={hexColor}
        strokeWidth={thickness}
        style={{
          filter: shadowFilter,
          pointerEvents: 'none',
          transition: 'stroke 0.15s, stroke-width 0.15s',
        }}
      />

      {/* Animated current flow path */}
      {isAnimating && (
        <path
          d={edgePath}
          fill="none"
          stroke="#facc15"
          strokeWidth={thickness * 0.6}
          strokeDasharray="4, 6"
          className="animate-wire-current"
          style={{
            pointerEvents: 'none',
            animation: `wire-current-flow ${1.5 / Math.abs(currentFlow)}s linear infinite`,
            // If current flow is negative, reverse direction
            animationDirection: currentFlow < 0 ? 'reverse' : 'normal',
          }}
        />
      )}

      {/* Render custom label */}
      {label && (
        <g transform={`translate(${labelCoords.x}, ${labelCoords.y})`} style={{ pointerEvents: 'none' }}>
          <rect
            x={-30}
            y={-8}
            width={60}
            height={16}
            rx={2}
            fill="#0f172a"
            stroke="#334155"
            strokeWidth={1}
          />
          <text
            y={3}
            textAnchor="middle"
            fill="#e2e8f0"
            fontSize={8}
            fontWeight="bold"
            fontFamily="monospace"
          >
            {label}
          </text>
        </g>
      )}

      {/* Render interactive bending point handles */}
      {selected &&
        bendingPoints.map((pt, idx) => (
          <circle
            key={idx}
            cx={pt.x}
            cy={pt.y}
            r={draggingIdx === idx ? 6 : 4}
            fill={draggingIdx === idx ? '#3b82f6' : '#60a5fa'}
            stroke="#ffffff"
            strokeWidth={1.5}
            className="cursor-move z-30 transition-all hover:scale-125"
            onMouseDown={(e) => handleBendingPointMouseDown(e, idx)}
            onContextMenu={(e) => handleBendingPointRightClick(e, idx)}
            style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}
          />
        ))}

      {/* Wire Source Connection Node */}
      {isAnimating && (
        <circle cx={sourceX} cy={sourceY} r={7} fill="#facc15" opacity={0.4} className="animate-ping" style={{ pointerEvents: 'none' }} />
      )}
      <circle
        cx={sourceX}
        cy={sourceY}
        r={3.5}
        fill={selected ? '#3b82f6' : (isAnimating ? '#eab308' : '#10b981')}
        stroke="#ffffff"
        strokeWidth={1}
        style={{ pointerEvents: 'none' }}
      />

      {/* Wire Target Connection Node */}
      {isAnimating && (
        <circle cx={targetX} cy={targetY} r={7} fill="#facc15" opacity={0.4} className="animate-ping" style={{ pointerEvents: 'none' }} />
      )}
      <circle
        cx={targetX}
        cy={targetY}
        r={3.5}
        fill={selected ? '#3b82f6' : (isAnimating ? '#eab308' : '#10b981')}
        stroke="#ffffff"
        strokeWidth={1}
        style={{ pointerEvents: 'none' }}
      />

      {/* CSS style for animations */}
      <style>{`
        @keyframes wire-current-flow {
          to {
            stroke-dashoffset: -20;
          }
        }
        .animate-wire-current {
          stroke-dasharray: 4, 6;
        }
      `}</style>
    </>
  )
}
