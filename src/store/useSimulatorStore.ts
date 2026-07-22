import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type {
  WorkspaceNode,
  WorkspaceEdge,
  PanelSizes,
  SimulationStatus,
  LogEntry,
  EditorTheme,
  BottomPanelTab,
  ComponentType,
  ComponentProperties,
  CircuitValidationResults,
} from '@/types'
import { getComponentDefinition } from '@/utils/componentDefinitions'
import { runElectricalValidation } from '@/utils/electricalRules'
import {
  ESP32_LED_BLINK_NODES,
  ESP32_LED_BLINK_EDGES,
  ESP32_LED_BLINK_CODE,
  FAULT_TOLERANT_NODES,
  FAULT_TOLERANT_EDGES,
  FAULT_TOLERANT_AIRCRAFT_CODE,
} from '@/utils/autoWiring'
import { cleanupGlobalSimulationTimers } from '@/utils/simulation/runtime'

interface HistoryState {
  nodes: WorkspaceNode[]
  edges: WorkspaceEdge[]
}

interface SimulatorState {
  // Project
  projectName: string
  projectId: string | null

  // Workspace
  nodes: WorkspaceNode[]
  edges: WorkspaceEdge[]
  selectedNodeIds: string[]
  selectedEdgeIds: string[]
  highlightedEdgeId: string | null
  completedWireIds: string[]
  isWireExplorerOpen: boolean
  snapToGrid: boolean
  gridSize: number
  showGrid: boolean
  wireToolActive: boolean

  // History
  history: HistoryState[]
  historyIndex: number

  // Panels
  panelSizes: PanelSizes
  bottomPanelTab: BottomPanelTab
  bottomPanelOpen: boolean

  // Editor
  code: string
  editorTheme: EditorTheme

  // Simulation
  simulationStatus: SimulationStatus
  logs: LogEntry[]
  simulationSpeed: 0.25 | 0.5 | 1 | 2 | 5 | 10 | 'unlimited'
  gpioPinStates: Record<string, Record<string, 'INPUT' | 'OUTPUT' | 'INPUT_PULLUP' | 'HIGH' | 'LOW' | number>>
  simulationDiagnostics: {
    loopCount: number
    executionTime: number
    loopFps: number
    powerDraw: number
  }

  // Debugging & Instruments
  activeFaults: Record<string, boolean>
  multimeterProbes: { black: string | null; red: string | null; mode: 'VDC' | 'VAC' | 'RES' | 'CONT' | 'DIODE' }
  probedPins: string[]
  waveformBuffers: Record<string, { time: number; val: number }[]>
  timelineEvents: { id: string; timestamp: number; type: string; msg: string }[]

  // Visual Customizations
  workspaceBackground: 'dark-blue' | 'light-grid' | 'engineering' | 'graph' | 'pcb-green' | 'grey-cad' | 'white'
  gridStyle: 'dots' | 'squares' | 'engineering' | 'pcb' | 'none'
  gridOpacity: number
  gridSpacing: number
  workbenchTheme: 'dark' | 'light' | 'wokwi' | 'tinkercad' | 'proteus' | 'pcb' | 'engineering-blue'

  // Circuit Validation Results
  validation: CircuitValidationResults

  // Actions - Workspace Nodes
  addNode: (type: ComponentType, position: { x: number; y: number }) => void
  updateNode: (id: string, updates: Partial<WorkspaceNode>) => void
  updateNodeProperties: (id: string, properties: Partial<ComponentProperties>) => void
  removeNode: (id: string) => void
  duplicateNode: (id: string) => void
  rotateNode: (id: string, degrees?: number) => void
  setNodes: (nodes: WorkspaceNode[]) => void
  setSelectedNodes: (ids: string[]) => void
  clearSelection: () => void

  // Actions - Workspace Edges (Wiring)
  addEdge: (edge: Omit<WorkspaceEdge, 'id'> & { id?: string }) => void
  removeEdge: (id: string) => void
  updateEdge: (id: string, updates: Partial<WorkspaceEdge>) => void
  setEdges: (edges: WorkspaceEdge[]) => void
  setSelectedEdges: (ids: string[]) => void

  // Actions - History
  undo: () => void
  redo: () => void
  pushHistory: () => void

  // Actions - Panels
  setPanelSizes: (sizes: Partial<PanelSizes>) => void
  setBottomPanelTab: (tab: BottomPanelTab) => void
  toggleBottomPanel: () => void

  // Actions - Editor
  setCode: (code: string) => void
  setEditorTheme: (theme: EditorTheme) => void

  // Actions - Simulation
  setSimulationStatus: (status: SimulationStatus) => void
  addLog: (level: LogEntry['level'], message: string, source?: LogEntry['source']) => void
  clearLogs: () => void
  setSimulationSpeed: (speed: 0.25 | 0.5 | 1 | 2 | 5 | 10 | 'unlimited') => void
  updateGpioPinState: (nodeId: string, pinId: string, value: 'INPUT' | 'OUTPUT' | 'INPUT_PULLUP' | 'HIGH' | 'LOW' | number) => void
  setSimulationDiagnostics: (diagnostics: Partial<SimulatorState['simulationDiagnostics']>) => void
  resetSimulationState: () => void

  // Actions - Debugging & Instruments
  toggleFault: (faultId: string) => void
  setMultimeterProbe: (probe: 'black' | 'red', pinKey: string | null) => void
  setMultimeterMode: (mode: 'VDC' | 'VAC' | 'RES' | 'CONT' | 'DIODE') => void
  addTimelineEvent: (type: string, msg: string) => void
  togglePinProbe: (pinKey: string) => void
  clearTimeline: () => void
  updateWaveformBuffer: (pinKey: string, time: number, val: number) => void
  resetDebuggingState: () => void

  // Actions - Visual Customizations
  setWorkspaceBackground: (bg: SimulatorState['workspaceBackground']) => void
  setGridStyle: (style: SimulatorState['gridStyle']) => void
  setGridOpacity: (opacity: number) => void
  setGridSpacing: (spacing: number) => void
  setWorkbenchTheme: (theme: SimulatorState['workbenchTheme']) => void
  bringToFront: (nodeId: string) => void
  sendToBack: (nodeId: string) => void
  resetLayers: () => void

  // Actions - Project
  setProjectName: (name: string) => void
  setProjectId: (id: string | null) => void
  resetProject: () => void
  loadProjectData: (project: { id: string; name: string; nodes: WorkspaceNode[]; edges: WorkspaceEdge[]; code: string }) => void

  // Actions - Circuit Validation
  setValidationResults: (results: CircuitValidationResults) => void
  setWireToolActive: (active: boolean) => void
  setHighlightedEdgeId: (id: string | null) => void
  toggleWireCompleted: (edgeId: string) => void
  setWireExplorerOpen: (open: boolean) => void
}

const DEFAULT_PANEL_SIZES: PanelSizes = {
  leftWidth: 280,
  rightWidth: 420,
  bottomHeight: 200,
}

let nodeCounter = 0

function createNodeId() {
  nodeCounter += 1
  return `node-${Date.now()}-${nodeCounter}`
}

function createLogId() {
  return `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

/**
 * Central z-index convention for the workspace. Breadboards sit at the
 * back (1), microcontroller boards sit just above them (2), and every
 * other component (batteries, fans, LEDs, etc.) sits on top (3).
 *
 * This MUST be used any time a node is created or its layering is reset,
 * otherwise freshly-added nodes default to zIndex: undefined and can
 * render *behind* a breadboard placed at zIndex: 1 — which is what was
 * causing dropped components (e.g. battery, pc-fan) to visually vanish
 * when placed on or near the breadboard.
 */
function getDefaultZIndex(type: ComponentType | string): number {
  if (type === 'breadboard') return 1
  if (type === 'arduino-uno' || type === 'esp32-devkit') return 2
  return 3
}

const initialValidation: CircuitValidationResults = {
  errors: [],
  warnings: [],
  connectedComponents: [],
  powerSources: [],
  groundNets: [],
  voltageRails: {},
}

const initialNodes: WorkspaceNode[] = ESP32_LED_BLINK_NODES.map((n) => ({
  ...n,
  zIndex: getDefaultZIndex(n.type),
}))

const initialEdges: WorkspaceEdge[] = ESP32_LED_BLINK_EDGES.map((e, idx) => ({
  ...e,
  id: `wire-led-${idx}`,
  thickness: 2,
}))

const initialCode = ESP32_LED_BLINK_CODE

export const useSimulatorStore = create<SimulatorState>()(
  subscribeWithSelector((set, get) => ({
    projectName: 'ESP32 LED Blink Project',
    projectId: null,
    nodes: initialNodes,
    edges: initialEdges,
    selectedNodeIds: [],
    selectedEdgeIds: [],
    highlightedEdgeId: null,
    completedWireIds: [],
    isWireExplorerOpen: false,
    snapToGrid: true,
    gridSize: 20,
    showGrid: true,
    wireToolActive: false,
    history: [{ nodes: initialNodes, edges: initialEdges }],
    historyIndex: 0,
    panelSizes: DEFAULT_PANEL_SIZES,
    bottomPanelTab: 'console',
    bottomPanelOpen: true,
    code: initialCode,
    editorTheme: 'vs-dark',
    simulationStatus: 'idle',
    simulationSpeed: 1,
    gpioPinStates: {},
    simulationDiagnostics: {
      loopCount: 0,
      executionTime: 0,
      loopFps: 0,
      powerDraw: 0,
    },
    activeFaults: {},
    multimeterProbes: { black: null, red: null, mode: 'VDC' },
    probedPins: [],
    waveformBuffers: {},
    timelineEvents: [],
    workspaceBackground: 'dark-blue',
    gridStyle: 'dots',
    gridOpacity: 0.15,
    gridSpacing: 20,
    workbenchTheme: 'dark',
    logs: [
      {
        id: createLogId(),
        timestamp: Date.now(),
        level: 'info',
        message: 'Aircraft Fault-Tolerant System Simulator ready.',
        source: 'console',
      },
    ],
    validation: initialValidation,

    addNode: (type, position) => {
      const { snapToGrid, gridSize } = get()
      const def = getComponentDefinition(type)
      if (!def) return

      const snappedPosition = snapToGrid
        ? {
            x: Math.round(position.x / gridSize) * gridSize,
            y: Math.round(position.y / gridSize) * gridSize,
          }
        : position

      const newNode: WorkspaceNode = {
        id: createNodeId(),
        type,
        position: snappedPosition,
        properties: { ...def.defaultProperties },
        // FIX: previously omitted, which left new nodes with zIndex
        // undefined — causing them to render behind breadboards (zIndex 1)
        // whenever dropped on or near one, making them appear invisible.
        zIndex: getDefaultZIndex(type),
      }

      set((state) => ({
        nodes: [...state.nodes, newNode],
        selectedNodeIds: [newNode.id],
        selectedEdgeIds: [],
      }))
      get().pushHistory()
    },

    updateNode: (id, updates) => {
      set((state) => ({
        nodes: state.nodes.map((n) => (n.id === id ? { ...n, ...updates } : n)),
      }))
    },

    updateNodeProperties: (id, properties) => {
      set((state) => ({
        nodes: state.nodes.map((n) =>
          n.id === id ? { ...n, properties: { ...n.properties, ...properties } } : n,
        ),
      }))
    },

    removeNode: (id) => {
      set((state) => ({
        nodes: state.nodes.filter((n) => n.id !== id),
        edges: state.edges.filter((e) => e.sourceNodeId !== id && e.targetNodeId !== id),
        selectedNodeIds: state.selectedNodeIds.filter((nid) => nid !== id),
      }))
      get().pushHistory()
    },

    duplicateNode: (id) => {
      const node = get().nodes.find((n) => n.id === id)
      if (!node) return

      const newNode: WorkspaceNode = {
        ...node,
        id: createNodeId(),
        position: { x: node.position.x + 40, y: node.position.y + 40 },
        properties: { ...node.properties },
        zIndex: node.zIndex ?? getDefaultZIndex(node.type),
      }

      set((state) => ({
        nodes: [...state.nodes, newNode],
        selectedNodeIds: [newNode.id],
      }))
      get().pushHistory()
    },

    rotateNode: (id, degrees = 90) => {
      set((state) => ({
        nodes: state.nodes.map((n) =>
          n.id === id
            ? {
                ...n,
                properties: {
                  ...n.properties,
                  rotation: ((n.properties.rotation + degrees) % 360 + 360) % 360,
                },
              }
            : n,
        ),
      }))
      get().pushHistory()
    },

    setSelectedNodes: (ids) => set({ selectedNodeIds: ids }),
    clearSelection: () => set({ selectedNodeIds: [], selectedEdgeIds: [] }),

    // Wiring actions
    addEdge: (edge) => {
      const newEdge: WorkspaceEdge = {
        id: edge.id || `edge-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        thickness: edge.thickness || 2,
        ...edge,
      }
      set((state) => ({
        edges: [...state.edges, newEdge],
        selectedEdgeIds: [newEdge.id],
        selectedNodeIds: [],
      }))
      get().pushHistory()
    },

    removeEdge: (id) => {
      set((state) => ({
        edges: state.edges.filter((e) => e.id !== id),
        selectedEdgeIds: state.selectedEdgeIds.filter((eid) => eid !== id),
      }))
      get().pushHistory()
    },

    updateEdge: (id, updates) => {
      set((state) => ({
        edges: state.edges.map((e) => (e.id === id ? { ...e, ...updates } : e)),
      }))
    },

    setEdges: (edges) => {
      set({ edges })
    },

    setNodes: (nodes) => {
      set({ nodes })
    },

    setSelectedEdges: (ids) => set({ selectedEdgeIds: ids }),

    pushHistory: () => {
      const { nodes, edges, history, historyIndex } = get()
      const newHistory = history.slice(0, historyIndex + 1)
      newHistory.push({
        nodes: structuredClone(nodes),
        edges: structuredClone(edges),
      })
      if (newHistory.length > 50) newHistory.shift()
      set({ history: newHistory, historyIndex: newHistory.length - 1 })
    },

    undo: () => {
      const { historyIndex, history } = get()
      if (historyIndex <= 0) return
      const prev = history[historyIndex - 1]
      set({
        historyIndex: historyIndex - 1,
        nodes: structuredClone(prev.nodes),
        edges: structuredClone(prev.edges),
        selectedNodeIds: [],
        selectedEdgeIds: [],
      })
    },

    redo: () => {
      const { historyIndex, history } = get()
      if (historyIndex >= history.length - 1) return
      const next = history[historyIndex + 1]
      set({
        historyIndex: historyIndex + 1,
        nodes: structuredClone(next.nodes),
        edges: structuredClone(next.edges),
        selectedNodeIds: [],
        selectedEdgeIds: [],
      })
    },

    setPanelSizes: (sizes) =>
      set((state) => ({ panelSizes: { ...state.panelSizes, ...sizes } })),

    setBottomPanelTab: (tab) => set({ bottomPanelTab: tab }),
    toggleBottomPanel: () => set((state) => ({ bottomPanelOpen: !state.bottomPanelOpen })),

    setCode: (code) => set({ code }),
    setEditorTheme: (theme) => set({ editorTheme: theme }),

    setSimulationStatus: (status) => set({ simulationStatus: status }),

    addLog: (level, message, source = 'console') =>
      set((state) => ({
        logs: [
          ...state.logs,
          { id: createLogId(), timestamp: Date.now(), level, message, source },
        ],
      })),

    clearLogs: () => set({ logs: [] }),

    setSimulationSpeed: (simulationSpeed) => set({ simulationSpeed }),

    updateGpioPinState: (nodeId, pinId, value) => set((state) => {
      const nodePins = state.gpioPinStates[nodeId] || {}
      return {
        gpioPinStates: {
          ...state.gpioPinStates,
          [nodeId]: {
            ...nodePins,
            [pinId]: value,
          },
        },
      }
    }),

    setSimulationDiagnostics: (diagnostics) => set((state) => ({
      simulationDiagnostics: {
        ...state.simulationDiagnostics,
        ...diagnostics,
      },
    })),

    resetSimulationState: () => {
      cleanupGlobalSimulationTimers()
      set({
        gpioPinStates: {},
        simulationDiagnostics: {
          loopCount: 0,
          executionTime: 0,
          loopFps: 0,
          powerDraw: 0,
        },
      })
    },

    toggleFault: (faultId) => set((state) => {
      const active = !!state.activeFaults[faultId]
      const nextFaults = { ...state.activeFaults, [faultId]: !active }

      // Log fault injection event in the timeline
      const timestamp = state.simulationDiagnostics.executionTime
      const msg = !active ? `🔴 Fault Injected: ${faultId.replace(/-/g, ' ').toUpperCase()}` : `🟢 Fault Cleared: ${faultId.replace(/-/g, ' ').toUpperCase()}`
      const newEvent = {
        id: `event-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp,
        type: !active ? 'fault_injected' : 'fault_cleared',
        msg
      }

      return {
        activeFaults: nextFaults,
        timelineEvents: [...state.timelineEvents, newEvent]
      }
    }),

    setMultimeterProbe: (probe, pinKey) => set((state) => ({
      multimeterProbes: {
        ...state.multimeterProbes,
        [probe]: pinKey
      }
    })),

    setMultimeterMode: (mode) => set((state) => ({
      multimeterProbes: {
        ...state.multimeterProbes,
        mode
      }
    })),

    addTimelineEvent: (type, msg) => set((state) => ({
      timelineEvents: [
        ...state.timelineEvents,
        {
          id: `event-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          timestamp: state.simulationDiagnostics.executionTime,
          type,
          msg
        }
      ]
    })),

    togglePinProbe: (pinKey) => set((state) => {
      const active = state.probedPins.includes(pinKey)
      const nextProbes = active
        ? state.probedPins.filter(p => p !== pinKey)
        : [...state.probedPins, pinKey].slice(-4) // Keep max 4 channels

      return { probedPins: nextProbes }
    }),

    clearTimeline: () => set({ timelineEvents: [] }),

    updateWaveformBuffer: (pinKey, time, val) => set((state) => {
      const buffer = state.waveformBuffers[pinKey] || []
      const nextBuffer = [...buffer, { time, val }].slice(-100) // Keep rolling window of 100 points
      return {
        waveformBuffers: {
          ...state.waveformBuffers,
          [pinKey]: nextBuffer
        }
      }
    }),

    resetDebuggingState: () => set({
      activeFaults: {},
      multimeterProbes: { black: null, red: null, mode: 'VDC' },
      probedPins: [],
      waveformBuffers: {},
      timelineEvents: [],
    }),

    setWorkspaceBackground: (workspaceBackground) => set({ workspaceBackground }),
    setGridStyle: (gridStyle) => set({ gridStyle }),
    setGridOpacity: (gridOpacity) => set({ gridOpacity }),
    setGridSpacing: (gridSpacing) => set({ gridSpacing }),
    setWorkbenchTheme: (workbenchTheme) => set({ workbenchTheme }),

    bringToFront: (nodeId) => set((state) => {
      const zIndexes = state.nodes.map(n => n.zIndex ?? 0)
      const maxZ = Math.max(2, ...zIndexes)
      return {
        nodes: state.nodes.map(n => n.id === nodeId ? { ...n, zIndex: maxZ + 1 } : n)
      }
    }),

    sendToBack: (nodeId) => set((state) => {
      const zIndexes = state.nodes.map(n => n.zIndex ?? 0)
      const minZ = Math.min(2, ...zIndexes)
      // FIX: clamp minimum zIndex to 2, never go to breadboard layer (1).
      // Previously Math.max(1, ...) allowed components to land on zIndex 1
      // which is the breadboard layer, making them render behind/under the
      // breadboard and appearing invisible.
      return {
        nodes: state.nodes.map(n => n.id === nodeId ? { ...n, zIndex: Math.max(2, minZ - 1) } : n)
      }
    }),

    resetLayers: () => set((state) => ({
      nodes: state.nodes.map(n => ({ ...n, zIndex: getDefaultZIndex(n.type) }))
    })),

    setProjectName: (name) => set({ projectName: name }),
    setProjectId: (id) => set({ projectId: id }),
    loadProjectData: (project) => set({
      projectId: project.id,
      projectName: project.name,
      // FIX: normalize zIndex for all loaded nodes. Older saved projects
      // may have nodes with undefined zIndex, causing them to render behind
      // breadboards (zIndex 1) and appearing invisible.
      nodes: project.nodes.map(n => ({
        ...n,
        zIndex: n.zIndex ?? getDefaultZIndex(n.type),
      })),
      edges: project.edges,
      code: project.code,
      selectedNodeIds: [],
      selectedEdgeIds: [],
      activeFaults: {},
      multimeterProbes: { black: null, red: null, mode: 'VDC' },
      probedPins: [],
      waveformBuffers: {},
      timelineEvents: [],
      history: [{ nodes: project.nodes, edges: project.edges }],
      historyIndex: 0,
      simulationStatus: 'idle',
      gpioPinStates: {},
    }),

    resetProject: () =>
      set({
        projectName: 'ESP32 LED Blink Project',
        nodes: initialNodes,
        edges: initialEdges,
        projectId: null,
        selectedNodeIds: [],
        selectedEdgeIds: [],
        code: initialCode,
        simulationStatus: 'idle',
        simulationSpeed: 1,
        gpioPinStates: {},
        simulationDiagnostics: {
          loopCount: 0,
          executionTime: 0,
          loopFps: 0,
          powerDraw: 0,
        },
        activeFaults: {},
        multimeterProbes: { black: null, red: null, mode: 'VDC' },
        probedPins: [],
        waveformBuffers: {},
        timelineEvents: [],
        workspaceBackground: 'dark-blue',
        gridStyle: 'dots',
        gridOpacity: 0.15,
        gridSpacing: 20,
        workbenchTheme: 'dark',
        history: [{ nodes: initialNodes, edges: initialEdges }],
        historyIndex: 0,
        validation: initialValidation,
        wireToolActive: false,
        logs: [],
      }),

    setValidationResults: (validation) => set({ validation }),
    setWireToolActive: (wireToolActive) => set({ wireToolActive }),
    setHighlightedEdgeId: (highlightedEdgeId) => set({ highlightedEdgeId }),
    toggleWireCompleted: (edgeId) =>
      set((state) => ({
        completedWireIds: state.completedWireIds.includes(edgeId)
          ? state.completedWireIds.filter((id) => id !== edgeId)
          : [...state.completedWireIds, edgeId],
      })),
    setWireExplorerOpen: (isWireExplorerOpen) => set({ isWireExplorerOpen }),
  })),
)

export const useSelectedNode = () => {
  const nodes = useSimulatorStore((s) => s.nodes)
  const selectedNodeIds = useSimulatorStore((s) => s.selectedNodeIds)
  return nodes.find((n) => n.id === selectedNodeIds[0]) ?? null
}

// Subscribe to node/edge changes to run electrical validation dynamically
let lastNodes = useSimulatorStore.getState().nodes
let lastEdges = useSimulatorStore.getState().edges

useSimulatorStore.subscribe(
  (state) => state,
  (state) => {
    if (state.nodes === lastNodes && state.edges === lastEdges) {
      return
    }
    lastNodes = state.nodes
    lastEdges = state.edges
    const results = runElectricalValidation(state.nodes, state.edges)
    useSimulatorStore.setState({ validation: results })
  },
  { fireImmediately: true }
)