import type { WorkspaceNode, WorkspaceEdge } from './workspace'

export interface ProjectData {
  id: string
  name: string
  version: string
  createdAt: string
  updatedAt: string
  nodes: WorkspaceNode[]
  edges: WorkspaceEdge[]
  code: string
  viewport: { x: number; y: number; zoom: number }
}

export interface ShareableProject extends ProjectData {
  exportedAt: string
  exportedBy?: string
}
