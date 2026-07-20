import { useState, useEffect } from 'react'
import { useSimulatorStore } from '@/store/useSimulatorStore'
import { getComponentDefinition } from '@/utils/componentDefinitions'
import { Zap, Volume2, Move, X } from 'lucide-react'
import { solveCircuitNew as solveCircuit } from '@/utils/simulation/solver/newCircuitSolver'

export default function MultimeterOverlay() {
  const nodes = useSimulatorStore((s) => s.nodes)
  const edges = useSimulatorStore((s) => s.edges)
  const gpioPinStates = useSimulatorStore((s) => s.gpioPinStates)
  
  const probes = useSimulatorStore((s) => s.multimeterProbes)
  const setProbe = useSimulatorStore((s) => s.setMultimeterProbe)
  const setMultimeterMode = useSimulatorStore((s) => s.setMultimeterMode)

  const [position, setPosition] = useState({ x: 100, y: 120 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [visible, setVisible] = useState(true)

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true)
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    })
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y,
      })
    }
    const handleMouseUp = () => {
      setIsDragging(false)
    }

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragOffset])

  const activeFaults = useSimulatorStore((s) => s.activeFaults) || {}
  const solution = solveCircuit(nodes, edges, gpioPinStates, activeFaults)

  // Check if two pins are electrically connected (resistance / continuity)
  const checkConnectivity = (pinA: string | null, pinB: string | null): boolean => {
    if (!pinA || !pinB) return false
    return solution.pinToNetIdx[pinA] !== undefined && solution.pinToNetIdx[pinA] === solution.pinToNetIdx[pinB]
  }

  const vRed = probes.red ? (solution.nodeVoltages[probes.red] || 0.0) : 0.0
  const vBlack = probes.black ? (solution.nodeVoltages[probes.black] || 0.0) : 0.0

  // Gather list of all pins in the workspace
  const allPins: { key: string; label: string }[] = []
  nodes.forEach((node) => {
    const def = getComponentDefinition(node.type)
    if (!def) return
    def.pins.forEach((pin) => {
      allPins.push({
        key: `${node.id}:${pin.id}`,
        label: `${node.properties.name || def.name} - ${pin.label} (${pin.id})`,
      })
    })
  })

  // Measure calculation based on selected mode
  let displayValue = '0.00'
  let displayUnits = 'V DC'
  let hasBeep = false

  if (probes.mode === 'VDC') {
    const diff = vRed - vBlack
    displayValue = diff.toFixed(3)
    displayUnits = 'V DC'
  } else if (probes.mode === 'VAC') {
    // Mock AC value as voltage diff with small fluctuation
    const diff = Math.abs(vRed - vBlack)
    displayValue = (diff * 0.707).toFixed(2)
    displayUnits = 'V AC'
  } else if (probes.mode === 'RES') {
    const connected = checkConnectivity(probes.red, probes.black)
    if (connected) {
      // Look for a resistor along the path
      let resistanceValue = 0
      const visited = new Set<string>()
      const queue = [probes.red]
      
      while (queue.length > 0) {
        const current = queue.shift()!
        if (visited.has(current)) continue
        visited.add(current)

        const [nodeId] = current.split(':')
        const node = nodes.find(n => n.id === nodeId)
        if (node && node.type === 'resistor') {
          resistanceValue = Number(node.properties.resistance || 220)
          break
        }

        edges.forEach((edge) => {
          const pA = `${edge.sourceNodeId}:${edge.sourcePinId}`
          const pB = `${edge.targetNodeId}:${edge.targetPinId}`
          if (pA === current) queue.push(pB)
          if (pB === current) queue.push(pA)
        })
      }

      displayValue = resistanceValue > 0 ? `${resistanceValue}` : '0.1'
      displayUnits = 'Ω'
    } else {
      displayValue = 'O.L'
      displayUnits = 'MΩ'
    }
  } else if (probes.mode === 'CONT') {
    const connected = checkConnectivity(probes.red, probes.black)
    if (connected) {
      displayValue = '000.2'
      displayUnits = 'Ω'
      hasBeep = true
    } else {
      displayValue = 'O.L'
      displayUnits = 'Ω'
    }
  } else if (probes.mode === 'DIODE') {
    const connected = checkConnectivity(probes.red, probes.black)
    if (connected) {
      // Find if we crossed a diode forward
      let isSchottky = false
      let isStandard = false
      
      const visited = new Set<string>()
      const queue = [probes.red]
      
      while (queue.length > 0) {
        const current = queue.shift()!
        if (visited.has(current)) continue
        visited.add(current)

        const [nodeId] = current.split(':')
        const node = nodes.find(n => n.id === nodeId)
        if (node) {
          if (node.type === 'schottky-diode') isSchottky = true
          if (node.type === 'diode-1n4007') isStandard = true
        }

        edges.forEach((edge) => {
          const pA = `${edge.sourceNodeId}:${edge.sourcePinId}`
          const pB = `${edge.targetNodeId}:${edge.targetPinId}`
          if (pA === current) queue.push(pB)
          if (pB === current) queue.push(pA)
        })
      }

      if (isSchottky) {
        displayValue = '0.312'
        displayUnits = 'V'
      } else if (isStandard) {
        displayValue = '0.672'
        displayUnits = 'V'
      } else {
        displayValue = '0.002'
        displayUnits = 'V'
      }
    } else {
      displayValue = 'O.L'
      displayUnits = 'V'
    }
  }

  if (!visible) return null

  return (
    <div
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
      className="absolute z-50 flex w-72 flex-col rounded-xl border border-border bg-surface-900 shadow-2xl overflow-hidden select-none"
    >
      {/* Header bar */}
      <div
        onMouseDown={handleMouseDown}
        className="flex items-center justify-between bg-surface-950 px-3 py-2 cursor-move border-b border-border"
      >
        <div className="flex items-center gap-1.5 text-text-primary text-[10px] font-bold tracking-wider uppercase">
          <Zap className="h-3.5 w-3.5 text-warning-400" />
          Virtual DMM-8848
        </div>
        <div className="flex items-center gap-1.5">
          <Move className="h-3.5 w-3.5 text-text-muted" />
          <button
            onClick={() => setVisible(false)}
            className="text-text-muted hover:text-text-primary rounded p-0.5"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Segment Display */}
      <div className="p-3 bg-surface-950">
        <div className="flex flex-col rounded bg-success-950/20 border border-success-800/20 p-2.5 font-mono text-right relative overflow-hidden">
          {/* LCD Glow Effect */}
          <div className="absolute inset-0 bg-success-500/5 pointer-events-none" />
          
          <div className="flex justify-between text-[9px] text-success-600/80 mb-0.5 font-semibold">
            <span>{probes.mode} MODE</span>
            {hasBeep && <span className="flex items-center gap-0.5 text-success-500 animate-pulse"><Volume2 className="h-3 w-3" /> BEEP</span>}
          </div>
          
          <div className="text-3xl font-bold text-success-400 tracking-wider">
            {displayValue}
          </div>
          
          <div className="text-[10px] text-success-500 font-bold mt-0.5 uppercase">
            {displayUnits}
          </div>
        </div>
      </div>

      {/* Probes Selectors */}
      <div className="p-3 border-t border-border flex flex-col gap-2 bg-surface-900 text-[10px] text-text-secondary">
        <div>
          <label className="block text-red-400 font-bold mb-1">🔴 Red Probe (+)</label>
          <select
            value={probes.red || ''}
            onChange={(e) => setProbe('red', e.target.value || null)}
            className="w-full bg-surface-800 border border-border rounded px-2 py-1 text-text-primary"
          >
            <option value="">(Unconnected)</option>
            {allPins.map((p) => (
              <option key={p.key} value={p.key}>{p.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-text-muted font-bold mb-1">⚫ Black Probe (-)</label>
          <select
            value={probes.black || ''}
            onChange={(e) => setProbe('black', e.target.value || null)}
            className="w-full bg-surface-800 border border-border rounded px-2 py-1 text-text-primary"
          >
            <option value="">(Unconnected)</option>
            {allPins.map((p) => (
              <option key={p.key} value={p.key}>{p.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Mode dials */}
      <div className="grid grid-cols-5 border-t border-border bg-surface-950/60 p-2 gap-1 text-[9px] font-bold text-center">
        {(['VDC', 'VAC', 'RES', 'CONT', 'DIODE'] as const).map((mode) => {
          const active = probes.mode === mode
          return (
            <button
              key={mode}
              onClick={() => setMultimeterMode(mode)}
              className={`py-1 rounded border transition-colors ${
                active
                  ? 'bg-warning-500 border-warning-600 text-surface-950'
                  : 'bg-surface-800 border-border text-text-secondary hover:bg-surface-750 hover:text-text-primary'
              }`}
            >
              {mode}
            </button>
          )
        })}
      </div>
    </div>
  )
}
export { MultimeterOverlay }
