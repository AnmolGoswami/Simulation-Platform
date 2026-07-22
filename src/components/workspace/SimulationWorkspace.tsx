import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  useReactFlow,
  ConnectionMode,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type OnNodeDrag,
  type OnSelectionChangeParams,
  type NodeChange,
  type EdgeChange,
  type Connection,
  Panel,
} from '@xyflow/react'
import {
  ZoomIn,
  ZoomOut,
  Maximize,
  Grid3X3,
  Magnet,
  Undo2,
  Redo2,
  Trash2,
  Copy,
  RotateCw,
  Cable,
  Camera,
} from 'lucide-react'
import SimulatorNode from './SimulatorNode'
import WireEdge from './WireEdge'
import { exportDiagramAsImage } from '@/utils/diagramExporter'
import { BottomPanelToggle } from '@/components/layout/BottomPanel'
import { useSimulatorStore } from '@/store/useSimulatorStore'
import { getComponentDefinition } from '@/utils/componentDefinitions'
import { useSimulationRunner } from '@/hooks/useSimulationRunner'
import { MultimeterOverlay } from '../instruments/MultimeterOverlay'
import type { ComponentType, ComponentProperties, WireColor, WorkspaceNode } from '@/types'

function snapNodeToBreadboard(
  node: { id: string; type: ComponentType; position: { x: number; y: number }; properties: ComponentProperties },
  allNodes: WorkspaceNode[],
  snapDistance = 20
): { x: number; y: number } | null {
  const breadboard = allNodes.find((n) => n.type === 'breadboard')
  if (!breadboard || node.type === 'breadboard') return null

  const nodeDef = getComponentDefinition(node.type)
  const bbDef = getComponentDefinition('breadboard')
  if (!nodeDef || !bbDef || nodeDef.pins.length === 0) return null

  const bbWidth = bbDef.defaultWidth
  const bbHeight = bbDef.defaultHeight
  const width = nodeDef.defaultWidth
  const height = nodeDef.defaultHeight

  // Use the first pin of the dragged node for snapping alignment
  const primaryPin = nodeDef.pins[0]

  // Rotated coordinates of dragged node pin relative to its center
  const rad = ((node.properties?.rotation || 0) * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const localX = primaryPin.x - width / 2
  const localY = primaryPin.y - height / 2
  const rotatedLocalX = localX * cos - localY * sin
  const rotatedLocalY = localX * sin + localY * cos
  const absPinX = node.position.x + width / 2 + rotatedLocalX
  const absPinY = node.position.y + height / 2 + rotatedLocalY

  let closestHole: { absX: number; absY: number } | null = null
  let minDistance = snapDistance

  // Calculate breadboard rotation details
  const bbRad = ((breadboard.properties?.rotation || 0) * Math.PI) / 180
  const bbCos = Math.cos(bbRad)
  const bbSin = Math.sin(bbRad)

  // Find closest hole in absolute coordinates using a synchronous for...of loop
  for (const hole of bbDef.pins) {
    const localHoleX = hole.x - bbWidth / 2
    const localHoleY = hole.y - bbHeight / 2
    const rotatedLocalHoleX = localHoleX * bbCos - localHoleY * bbSin
    const rotatedLocalHoleY = localHoleX * bbSin + localHoleY * bbCos
    const absHoleX = breadboard.position.x + bbWidth / 2 + rotatedLocalHoleX
    const absHoleY = breadboard.position.y + bbHeight / 2 + rotatedLocalHoleY

    const dist = Math.hypot(absPinX - absHoleX, absPinY - absHoleY)
    if (dist < minDistance) {
      minDistance = dist
      closestHole = { absX: absHoleX, absY: absHoleY }
    }
  }

  if (closestHole) {
    // Snap node position so that primary pin aligns exactly with closestHole
    return {
      x: closestHole.absX - width / 2 - rotatedLocalX,
      y: closestHole.absY - height / 2 - rotatedLocalY,
    }
  }

  return null
}

const nodeTypes = {
  simulatorComponent: SimulatorNode,
}

const edgeTypes = {
  wire: WireEdge,
}

function WorkspaceCanvas() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition, fitView, zoomIn, zoomOut } = useReactFlow()

  const storeNodes = useSimulatorStore((s) => s.nodes)
  const storeEdges = useSimulatorStore((s) => s.edges)
  const addNode = useSimulatorStore((s) => s.addNode)
  const updateNode = useSimulatorStore((s) => s.updateNode)
  const addEdge = useSimulatorStore((s) => s.addEdge)
  const removeEdge = useSimulatorStore((s) => s.removeEdge)
  const setSelectedNodes = useSimulatorStore((s) => s.setSelectedNodes)
  const setSelectedEdges = useSimulatorStore((s) => s.setSelectedEdges)
  const removeNode = useSimulatorStore((s) => s.removeNode)
  const duplicateNode = useSimulatorStore((s) => s.duplicateNode)
  const rotateNode = useSimulatorStore((s) => s.rotateNode)
  const undo = useSimulatorStore((s) => s.undo)
  const redo = useSimulatorStore((s) => s.redo)
  const pushHistory = useSimulatorStore((s) => s.pushHistory)
  
  const selectedNodeIds = useSimulatorStore((s) => s.selectedNodeIds)
  const selectedEdgeIds = useSimulatorStore((s) => s.selectedEdgeIds)
  const snapToGrid = useSimulatorStore((s) => s.snapToGrid)
  const gridSize = useSimulatorStore((s) => s.gridSize)
  const showGrid = useSimulatorStore((s) => s.showGrid)
  const wireToolActive = useSimulatorStore((s) => s.wireToolActive)
  const setWireToolActive = useSimulatorStore((s) => s.setWireToolActive)

  const workspaceBg = useSimulatorStore((s) => s.workspaceBackground)
  const gridStyle = useSimulatorStore((s) => s.gridStyle)
  const gridOpacity = useSimulatorStore((s) => s.gridOpacity)
  const gridSpacing = useSimulatorStore((s) => s.gridSpacing)

  // Custom theme-based canvas background colors and grid accent shades
  const bgStyles: Record<string, { bg: string; gridColor: string }> = {
    'dark-blue': { bg: '#0b132b', gridColor: `rgba(96, 165, 250, ${gridOpacity})` },
    'light-grid': { bg: '#f8fafc', gridColor: `rgba(100, 116, 139, ${gridOpacity})` },
    'engineering': { bg: '#fdfce9', gridColor: `rgba(180, 83, 9, ${gridOpacity * 0.7})` },
    'graph': { bg: '#ffffff', gridColor: `rgba(59, 130, 246, ${gridOpacity * 0.5})` },
    'pcb-green': { bg: '#0b3920', gridColor: `rgba(52, 211, 153, ${gridOpacity})` },
    'grey-cad': { bg: '#1c1c1f', gridColor: `rgba(148, 163, 184, ${gridOpacity})` },
    'white': { bg: '#ffffff', gridColor: `rgba(226, 232, 240, ${gridOpacity})` },
  }

  const activeStyle = bgStyles[workspaceBg] || bgStyles['dark-blue']

  let reactFlowVariant = BackgroundVariant.Dots
  if (gridStyle === 'squares' || gridStyle === 'engineering') {
    reactFlowVariant = BackgroundVariant.Lines
  } else if (gridStyle === 'pcb') {
    reactFlowVariant = BackgroundVariant.Cross
  }

  const flowNodes: Node[] = useMemo(
    () =>
      storeNodes.map((node) => ({
        id: node.id,
        type: 'simulatorComponent',
        position: node.position,
        data: {
          componentType: node.type,
          label: node.properties.name,
          rotation: node.properties.rotation,
          color: node.properties.color,
        },
        selected: selectedNodeIds.includes(node.id),
        zIndex: node.zIndex ?? (node.type === 'breadboard' ? 1 : (node.type === 'arduino-uno' || node.type === 'esp32-devkit' ? 2 : 3)),
      })),
    [storeNodes, selectedNodeIds],
  )

  const flowEdges = useMemo(
    () =>
      storeEdges.map((edge) => ({
        id: edge.id,
        source: edge.sourceNodeId,
        sourceHandle: edge.sourcePinId,
        target: edge.targetNodeId,
        targetHandle: edge.targetPinId,
        type: 'wire',
        data: {
          color: edge.color,
          thickness: edge.thickness ?? 2,
          label: edge.label,
          isLocked: edge.isLocked,
          isHidden: edge.isHidden,
          curved: edge.curved,
          bendingPoints: edge.bendingPoints,
          currentFlow: edge.currentFlow,
        },
        selected: selectedEdgeIds.includes(edge.id),
      })),
    [storeEdges, selectedEdgeIds],
  )

  const [nodes, setNodes] = useState<Node[]>(flowNodes)
  const [edges, setEdges] = useState<Edge[]>(flowEdges)

  useEffect(() => {
    const timer = setTimeout(() => {
      setNodes((prevNodes) => {
        const prevMap = new Map(prevNodes.map((n) => [n.id, n]))
        return flowNodes.map((fn) => {
          const prev = prevMap.get(fn.id)
          if (!prev) return fn

          const isDataEqual =
            prev.data.componentType === fn.data.componentType &&
            prev.data.label === fn.data.label &&
            prev.data.rotation === fn.data.rotation &&
            prev.data.color === fn.data.color

          if (
            isDataEqual &&
            prev.position.x === fn.position.x &&
            prev.position.y === fn.position.y &&
            prev.selected === fn.selected &&
            prev.zIndex === fn.zIndex
          ) {
            return prev
          }

          return {
            ...prev,
            ...fn,
            measured: prev.measured ?? fn.measured,
            width: prev.width ?? fn.width,
            height: prev.height ?? fn.height,
            dragging: prev.dragging ?? fn.dragging,
            data: isDataEqual ? prev.data : fn.data,
          }
        })
      })
    }, 0)
    return () => clearTimeout(timer)
  }, [flowNodes])

  useEffect(() => {
    const timer = setTimeout(() => {
      setEdges((prevEdges) => {
        const prevMap = new Map(prevEdges.map((e) => [e.id, e]))
        return flowEdges.map((fe) => {
          const prev = prevMap.get(fe.id)
          if (!prev || !prev.data || !fe.data) return fe

          const isDataEqual =
            prev.data.color === fe.data.color &&
            prev.data.thickness === fe.data.thickness &&
            prev.data.label === fe.data.label &&
            prev.data.isLocked === fe.data.isLocked &&
            prev.data.isHidden === fe.data.isHidden &&
            prev.data.curved === fe.data.curved &&
            prev.data.currentFlow === fe.data.currentFlow &&
            prev.data.bendingPoints === fe.data.bendingPoints

          if (
            isDataEqual &&
            prev.source === fe.source &&
            prev.sourceHandle === fe.sourceHandle &&
            prev.target === fe.target &&
            prev.targetHandle === fe.targetHandle &&
            prev.selected === fe.selected
          ) {
            return prev
          }

          return {
            ...prev,
            ...fe,
            data: isDataEqual ? prev.data : fe.data,
          }
        })
      })
    }, 0)
    return () => clearTimeout(timer)
  }, [flowEdges])

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds) => applyNodeChanges(changes, nds))
      changes.forEach((change) => {
        if (change.type === 'remove') {
          removeNode(change.id)
        }
      })
    },
    [removeNode]
  )

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((eds) => applyEdgeChanges(changes, eds))
      changes.forEach((change) => {
        if (change.type === 'remove') {
          removeEdge(change.id)
        }
      })
    },
    [removeEdge]
  )

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const type = e.dataTransfer.getData('application/component-type') as ComponentType
      if (!type) return

      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      addNode(type, position)
    },
    [screenToFlowPosition, addNode],
  )

  const onNodeDragStop: OnNodeDrag = useCallback(
    (_event, node) => {
      const storeNode = storeNodes.find((n) => n.id === node.id)
      if (!storeNode) return

      const snapped = snapNodeToBreadboard(
        {
          id: node.id,
          type: storeNode.type,
          position: node.position || { x: 0, y: 0 },
          properties: storeNode.properties,
        },
        storeNodes,
        20
      )
      const finalPos = snapped || node.position

      updateNode(node.id, { position: finalPos })
      pushHistory()
    },
    [updateNode, storeNodes, pushHistory],
  )

  const onSelectionChange = useCallback(
    ({ nodes: selectedNodes, edges: selectedEdges }: OnSelectionChangeParams) => {
      setSelectedNodes(selectedNodes.map((n) => n.id))
      setSelectedEdges(selectedEdges.map((e) => e.id))
    },
    [setSelectedNodes, setSelectedEdges],
  )

  const onConnect = useCallback(
    (params: Connection) => {
      const sourceNode = storeNodes.find((n) => n.id === params.source)
      const targetNode = storeNodes.find((n) => n.id === params.target)
      if (!sourceNode || !targetNode) return

      const sourcePinDef = getComponentDefinition(sourceNode.type)?.pins.find((p) => p.id === params.sourceHandle)
      const targetPinDef = getComponentDefinition(targetNode.type)?.pins.find((p) => p.id === params.targetHandle)

      // Suggest wire color based on standard conventions
      let color: WireColor = 'yellow' // default signal
      const isPower = sourcePinDef?.type === 'power' || targetPinDef?.type === 'power'
      const isGnd = sourcePinDef?.type === 'ground' || targetPinDef?.type === 'ground'
      const isBus = sourcePinDef?.type === 'bus' || targetPinDef?.type === 'bus'
      const isAnalog = sourcePinDef?.type === 'analog' || targetPinDef?.type === 'analog'
      
      if (isPower) color = 'red'
      else if (isGnd) color = 'black'
      else if (isBus) color = 'green'
      else if (isAnalog) color = 'orange'
      else if (sourcePinDef?.isPWM || targetPinDef?.isPWM) color = 'blue'

      if (!params.sourceHandle || !params.targetHandle) return

      addEdge({
        sourceNodeId: params.source,
        sourcePinId: params.sourceHandle,
        targetNodeId: params.target,
        targetPinId: params.targetHandle,
        color,
        curved: true, // Make new wires curved/bendable by default!
      })
    },
    [addEdge, storeNodes],
  )

  const handleDelete = () => {
    selectedNodeIds.forEach((id) => removeNode(id))
    selectedEdgeIds.forEach((id) => removeEdge(id))
  }

  const handleDuplicate = () => {
    selectedNodeIds.forEach((id) => duplicateNode(id))
  }

  const handleRotate = () => {
    if (selectedNodeIds[0]) rotateNode(selectedNodeIds[0])
  }

  return (
    <div ref={reactFlowWrapper} className="h-full w-full bg-surface-950">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        style={{ backgroundColor: activeStyle.bg, transition: 'background-color 0.25s' }}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeDragStop={onNodeDragStop}
        onSelectionChange={onSelectionChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        snapToGrid={snapToGrid}
        snapGrid={[gridSize, gridSize]}
        connectionMode={ConnectionMode.Loose}
        fitView
        minZoom={0.2}
        maxZoom={4}
        defaultEdgeOptions={{
          type: 'wire',
          style: { strokeWidth: 2 },
        }}
        proOptions={{ hideAttribution: true }}
      >
        {showGrid && gridStyle !== 'none' && (
          <Background
            variant={reactFlowVariant}
            gap={gridSpacing}
            size={gridStyle === 'engineering' ? 1.5 : 1}
            color={activeStyle.gridColor}
          />
        )}

        <Controls
          showZoom={false}
          showFitView={false}
          showInteractive={false}
          className="!bg-surface-800 !border-border !shadow-lg"
        />

        <MiniMap
          nodeColor="#3b82f6"
          maskColor="rgba(10, 14, 23, 0.8)"
          className="!bg-surface-850 !border-border"
        />

        <Panel position="top-left" className="flex gap-1">
          <ToolbarButton icon={Undo2} onClick={undo} title="Undo (Ctrl+Z)" />
          <ToolbarButton icon={Redo2} onClick={redo} title="Redo (Ctrl+Y)" />
          <div className="mx-1 w-px bg-border" />
          <ToolbarButton icon={ZoomIn} onClick={() => zoomIn()} title="Zoom In" />
          <ToolbarButton icon={ZoomOut} onClick={() => zoomOut()} title="Zoom Out" />
          <ToolbarButton icon={Maximize} onClick={() => fitView()} title="Fit View" />
          <div className="mx-1 w-px bg-border" />
          <ToolbarButton
            icon={Grid3X3}
            onClick={() => useSimulatorStore.setState({ showGrid: !showGrid })}
            title="Toggle Grid"
            active={showGrid}
          />
          <ToolbarButton
            icon={Magnet}
            onClick={() =>
              useSimulatorStore.setState({ snapToGrid: !snapToGrid })
            }
            title="Snap to Grid"
            active={snapToGrid}
          />
          <ToolbarButton
            icon={Cable}
            onClick={() => setWireToolActive(!wireToolActive)}
            title="Wiring Tool (W)"
            active={wireToolActive}
          />
          <ToolbarButton
            icon={Camera}
            onClick={() => exportDiagramAsImage('png')}
            title="Snapshot Diagram (PNG Image)"
          />
          {(selectedNodeIds.length > 0 || selectedEdgeIds.length > 0) && (
            <>
              <div className="mx-1 w-px bg-border" />
              {selectedNodeIds.length > 0 && (
                <>
                  <ToolbarButton icon={Copy} onClick={handleDuplicate} title="Duplicate (Ctrl+D)" />
                  <ToolbarButton icon={RotateCw} onClick={handleRotate} title="Rotate 90°" />
                </>
              )}
              <ToolbarButton icon={Trash2} onClick={handleDelete} title="Delete" danger />
            </>
          )}
        </Panel>
      </ReactFlow>

      <BottomPanelToggle />
    </div>
  )
}

function ToolbarButton({
  icon: Icon,
  onClick,
  title,
  active = false,
  danger = false,
}: {
  icon: typeof Undo2
  onClick: () => void
  title: string
  active?: boolean
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`flex h-7 w-7 items-center justify-center rounded-md border transition-colors ${
        danger
          ? 'border-transparent text-danger-500 hover:bg-danger-500/20'
          : active
            ? 'border-accent-500/50 bg-accent-500/20 text-accent-400 font-bold'
            : 'border-border bg-surface-800 text-text-secondary hover:bg-surface-750 hover:text-text-primary'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  )
}

export default function SimulationWorkspace() {
  useSimulationRunner()
  return (
    <div className="relative h-full">
      <WorkspaceCanvas />
      <MultimeterOverlay />
    </div>
  )
}
