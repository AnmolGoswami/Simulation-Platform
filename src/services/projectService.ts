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

/**
 * Recursively search and serialize any nested arrays inside an object into a JSON string
 * representation because Firestore does not support nested arrays.
 */
function serializeNestedArrays(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj
  }

  if (Array.isArray(obj)) {
    const hasNested = obj.some((item) => Array.isArray(item))
    if (hasNested) {
      return {
        _firebase_nested_array_: JSON.stringify(obj.map(serializeNestedArrays)),
      }
    }
    return obj.map(serializeNestedArrays)
  }

  const result: any = {}
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      let cleanKey = key
      if (cleanKey.startsWith('__') && cleanKey.endsWith('__')) {
        cleanKey = `_${cleanKey.slice(2, -2)}_`
      }
      result[cleanKey] = serializeNestedArrays(obj[key])
    }
  }
  return result
}

/**
 * Recursively find and reconstruct serialized nested arrays in objects retrieved from Firestore.
 */
function deserializeNestedArrays(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj
  }

  const nestedVal = obj._firebase_nested_array_ !== undefined ? obj._firebase_nested_array_ : obj.__firebase_nested_array__
  if (nestedVal !== undefined) {
    try {
      const parsed = JSON.parse(nestedVal)
      return parsed.map(deserializeNestedArrays)
    } catch (e) {
      console.error('Failed to deserialize nested array:', e)
      return []
    }
  }

  if (Array.isArray(obj)) {
    return obj.map(deserializeNestedArrays)
  }

  const result: any = {}
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      result[key] = deserializeNestedArrays(obj[key])
    }
  }
  return result
}

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

    // Serialize any nested arrays so Firestore doesn't throw a "Nested arrays are not supported" error
    const serializedNodes = serializeNestedArrays(cleanNodes)
    const serializedEdges = serializeNestedArrays(cleanEdges)

    const projectFields = {
      name,
      userId,
      nodes: serializedNodes,
      edges: serializedEdges,
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
      // Deserialize nested arrays
      const deserializedNodes = deserializeNestedArrays(data.nodes || [])
      const deserializedEdges = deserializeNestedArrays(data.edges || [])

      projects.push({
        id: docSnap.id,
        name: data.name || 'Untitled Project',
        userId: data.userId || userId,
        nodes: deserializedNodes,
        edges: deserializedEdges,
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
      nodes: deserializeNestedArrays(data.nodes || []),
      edges: deserializeNestedArrays(data.edges || []),
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
