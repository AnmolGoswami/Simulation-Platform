import { db } from './firebase'
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore'
import type { WorkspaceNode, WorkspaceEdge } from '@/types'

export interface ProjectData {
  id: string
  name: string
  userId: string
  nodes: WorkspaceNode[]
  edges: WorkspaceEdge[]
  code: string
  updatedAt: string
  createdAt: string
}

const PROJECTS_COLLECTION = 'projects'

export const projectService = {
  /**
   * Save a project to Firestore. If projectId is provided, it updates. Otherwise it creates new.
   * Returns the projectId.
   */
  async saveProject(
    userId: string,
    projectId: string | null,
    name: string,
    nodes: WorkspaceNode[],
    edges: WorkspaceEdge[],
    code: string
  ): Promise<string> {
    const now = new Date().toISOString()
    const cleanNodes = JSON.parse(JSON.stringify(nodes)) // strip undefined / functions
    const cleanEdges = JSON.parse(JSON.stringify(edges))

    const projectFields = {
      name,
      userId,
      nodes: cleanNodes,
      edges: cleanEdges,
      code,
      updatedAt: now,
    }

    if (projectId) {
      const docRef = doc(db, PROJECTS_COLLECTION, projectId)
      try {
        await updateDoc(docRef, projectFields)
        return projectId
      } catch (error) {
        console.warn(`Failed to update project ${projectId}, falling back to creating a new project document:`, error)
        const docRefNew = await addDoc(collection(db, PROJECTS_COLLECTION), {
          ...projectFields,
          createdAt: now,
        })
        return docRefNew.id
      }
    } else {
      const docRef = await addDoc(collection(db, PROJECTS_COLLECTION), {
        ...projectFields,
        createdAt: now,
      })
      return docRef.id
    }
  },

  /**
   * Fetch all projects created by a user.
   */
  async getUserProjects(userId: string): Promise<ProjectData[]> {
    const q = query(
      collection(db, PROJECTS_COLLECTION),
      where('userId', '==', userId)
    )

    const querySnapshot = await getDocs(q)
    const projects: ProjectData[] = []
    
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data()
      projects.push({
        id: docSnap.id,
        name: data.name || 'Untitled Project',
        userId: data.userId || userId,
        nodes: data.nodes || [],
        edges: data.edges || [],
        code: data.code || '',
        updatedAt: data.updatedAt || new Date().toISOString(),
        createdAt: data.createdAt || new Date().toISOString(),
      })
    })

    // Sort in memory to avoid index requirements in Firestore
    projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

    return projects
  },

  /**
   * Fetch a specific project by id.
   */
  async getProject(projectId: string): Promise<ProjectData> {
    const docRef = doc(db, PROJECTS_COLLECTION, projectId)
    const docSnap = await getDoc(docRef)
    
    if (!docSnap.exists()) {
      throw new Error('Project not found')
    }

    const data = docSnap.data()
    return {
      id: docSnap.id,
      name: data.name || 'Untitled Project',
      userId: data.userId || '',
      nodes: data.nodes || [],
      edges: data.edges || [],
      code: data.code || '',
      updatedAt: data.updatedAt || new Date().toISOString(),
      createdAt: data.createdAt || new Date().toISOString(),
    }
  },

  /**
   * Delete a project.
   */
  async deleteProject(projectId: string): Promise<void> {
    const docRef = doc(db, PROJECTS_COLLECTION, projectId)
    await deleteDoc(docRef)
  },
}
