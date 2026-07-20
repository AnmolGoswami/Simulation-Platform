import type { WorkspaceNode, WorkspaceEdge } from '../../../types'
import { getComponentDefinition } from '../../componentDefinitions'

export interface Netlist {
  // Equipotential nets (for validation/multimeter)
  nets: string[][]
  pinToNet: Record<string, number>
  
  // Solver junctions (for matrix solver, grouping ideal zero-resistance copper contacts)
  junctions: string[][]
  pinToJunction: Record<string, number>
  
  // Inputs/States
  nodes: WorkspaceNode[]
  edges: WorkspaceEdge[]
}

class UnionFind {
  parent: Record<string, string> = {}

  find(id: string): string {
    if (!this.parent[id]) {
      this.parent[id] = id
    }
    if (this.parent[id] === id) {
      return id
    }
    this.parent[id] = this.find(this.parent[id]) // path compression
    return this.parent[id]
  }

  union(id1: string, id2: string) {
    const root1 = this.find(id1)
    const root2 = this.find(id2)
    if (root1 !== root2) {
      this.parent[root1] = root2
    }
  }

  getGroups(): string[][] {
    const groups: Record<string, string[]> = {}
    for (const key of Object.keys(this.parent)) {
      const root = this.find(key)
      if (!groups[root]) {
        groups[root] = []
      }
      groups[root].push(key)
    }
    return Object.values(groups)
  }
}

/**
 * Builds the connectivity netlist for the workspace components and edges.
 * Groups pins into solver junctions and validation nets.
 */
export function buildNetlist(
  nodes: WorkspaceNode[],
  edges: WorkspaceEdge[],
  activeFaults: Record<string, boolean> = {}
): Netlist {
  const junctionUF = new UnionFind()
  const netUF = new UnionFind()

  // 1. Initialize all pins from all component nodes in both UnionFind structures
  nodes.forEach((node) => {
    const def = getComponentDefinition(node.type)
    if (def) {
      def.pins.forEach((pin) => {
        const pinKey = `${node.id}:${pin.id}`
        junctionUF.find(pinKey)
        netUF.find(pinKey)
      });
    }
  })

  // Also initialize edge pins if they aren't already represented
  edges.forEach((edge) => {
    const p1 = `${edge.sourceNodeId}:${edge.sourcePinId}`
    const p2 = `${edge.targetNodeId}:${edge.targetPinId}`
    junctionUF.find(p1)
    junctionUF.find(p2)
    netUF.find(p1)
    netUF.find(p2)
  })

  // 2. Add Breadboard, Terminal Strip, and other ideal internal contacts (Junctions and Nets)
  nodes.forEach((node) => {
    // A. Breadboard internal rows & rails
    if (node.type === 'breadboard') {
      const split = node.properties.splitPowerRails as boolean || false
      const ROWS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']

      const linkPins = (pk1: string, pk2: string) => {
        junctionUF.union(pk1, pk2)
        netUF.union(pk1, pk2)
      }

      // Column rows: a-e and f-j are internally connected
      for (let col = 1; col <= 30; col++) {
        for (let i = 0; i < 4; i++) {
          linkPins(`${node.id}:hole-${ROWS[i]}-${col}`, `${node.id}:hole-${ROWS[i+1]}-${col}`)
        }
        for (let i = 5; i < 9; i++) {
          linkPins(`${node.id}:hole-${ROWS[i]}-${col}`, `${node.id}:hole-${ROWS[i+1]}-${col}`)
        }
      }

      // Horizontal power rails
      const linkRailSegment = (prefix: string, start: number, end: number) => {
        for (let col = start; col < end; col++) {
          linkPins(`${node.id}:${prefix}-${col}`, `${node.id}:${prefix}-${col+1}`)
        }
      }

      if (split) {
        linkRailSegment('rail-top-pos', 1, 15)
        linkRailSegment('rail-top-pos', 16, 30)
        linkRailSegment('rail-top-neg', 1, 15)
        linkRailSegment('rail-top-neg', 16, 30)
        linkRailSegment('rail-bottom-neg', 1, 15)
        linkRailSegment('rail-bottom-neg', 16, 30)
        linkRailSegment('rail-bottom-pos', 1, 15)
        linkRailSegment('rail-bottom-pos', 16, 30)
      } else {
        linkRailSegment('rail-top-pos', 1, 30)
        linkRailSegment('rail-top-neg', 1, 30)
        linkRailSegment('rail-bottom-neg', 1, 30)
        linkRailSegment('rail-bottom-pos', 1, 30)
      }
    }

    // B. Terminal strips
    if (node.type === 'terminal-strip-4') {
      const linkPins = (p1: string, p2: string) => {
        junctionUF.union(p1, p2)
        netUF.union(p1, p2)
      }
      linkPins(`${node.id}:p1`, `${node.id}:p2`)
      linkPins(`${node.id}:p2`, `${node.id}:p3`)
      linkPins(`${node.id}:p3`, `${node.id}:p4`)
    }
    if (node.type === 'terminal-strip-8') {
      const linkPins = (p1: string, p2: string) => {
        junctionUF.union(p1, p2)
        netUF.union(p1, p2)
      }
      for (let i = 1; i <= 7; i++) {
        linkPins(`${node.id}:p${i}`, `${node.id}:p${i+1}`)
      }
    }
  })

  // 3. Connect Wires, Switches, and Fuses as Nets (For electrical rules/multimeter)
  // Wires
  edges.forEach((edge) => {
    if (activeFaults[`wire-break-${edge.id}`]) return
    const p1 = `${edge.sourceNodeId}:${edge.sourcePinId}`
    const p2 = `${edge.targetNodeId}:${edge.targetPinId}`
    netUF.union(p1, p2)
  })

  // Closed SPST / SPDT / DPDT Switches & DIP Switches
  nodes.forEach((node) => {
    if (node.type.startsWith('toggle-switch') || node.type.startsWith('slide-switch')) {
      const swState = node.properties.state
      const isSPST = node.type.endsWith('-spst')
      const isSPDT = node.type.endsWith('-spdt') || node.type === 'toggle-switch'
      const isDPDT = node.type.endsWith('-dpdt')

      if (isSPST && (swState === true || swState === 'true')) {
        netUF.union(`${node.id}:a`, `${node.id}:b`)
      } else if (isSPDT) {
        if (swState === 'nc') {
          netUF.union(`${node.id}:com`, `${node.id}:nc`)
        } else {
          netUF.union(`${node.id}:com`, `${node.id}:no`)
        }
      } else if (isDPDT) {
        if (swState === 'nc') {
          netUF.union(`${node.id}:com1`, `${node.id}:nc1`)
          netUF.union(`${node.id}:com2`, `${node.id}:nc2`)
        } else {
          netUF.union(`${node.id}:com1`, `${node.id}:no1`)
          netUF.union(`${node.id}:com2`, `${node.id}:no2`)
        }
      }
    }

    if (node.type.startsWith('dip-switch-')) {
      const dipState = (node.properties.state as Record<string, boolean>) || {}
      const positions = node.type.endsWith('-2') ? 2 : node.type.endsWith('-4') ? 4 : 8
      for (let i = 1; i <= positions; i++) {
        if (dipState[`s${i}`]) {
          netUF.union(`${node.id}:a${i}`, `${node.id}:b${i}`)
        }
      }
    }

    // Fuses (Closed if not blown)
    if (node.type === 'fuse') {
      const isBlown = activeFaults['fuse-blown'] || node.properties.blown as boolean || false
      if (!isBlown) {
        netUF.union(`${node.id}:a`, `${node.id}:b`)
      }
    }

    // Relays (COM connects to NO or NC depending on state)
    if (node.type === 'relay') {
      const state = node.properties.state
      const isStuck = activeFaults['relay-stuck']
      const actualState = (state === 'no' && !isStuck) ? 'no' : 'nc'
      if (actualState === 'no') {
        netUF.union(`${node.id}:com`, `${node.id}:no`)
      } else {
        netUF.union(`${node.id}:com`, `${node.id}:nc`)
      }
    }
  })

  // 4. Gather groups and generate mapping tables
  const junctions = junctionUF.getGroups()
  const pinToJunction: Record<string, number> = {}
  junctions.forEach((jGroup, idx) => {
    jGroup.forEach((pin) => {
      pinToJunction[pin] = idx
    })
  })

  const nets = netUF.getGroups()
  const pinToNet: Record<string, number> = {}
  nets.forEach((nGroup, idx) => {
    nGroup.forEach((pin) => {
      pinToNet[pin] = idx
    })
  })

  return {
    nets,
    pinToNet,
    junctions,
    pinToJunction,
    nodes,
    edges,
  }
}
