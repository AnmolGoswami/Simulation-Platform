import { toPng, toSvg } from 'html-to-image'
import { getNodesBounds, getViewportForBounds } from '@xyflow/react'
import { useSimulatorStore } from '@/store/useSimulatorStore'

/**
 * Exports the live React Flow diagram/canvas as a PNG or SVG image file.
 * Uses official React Flow viewport centering calculation so all nodes and wires
 * are perfectly captured regardless of current user zoom or scroll coordinates.
 */
export async function exportDiagramAsImage(
  format: 'png' | 'svg',
  customFilename?: string
): Promise<void> {
  const store = useSimulatorStore.getState()
  const nodes = store.nodes
  const projectName = customFilename || store.projectName || 'Aircraft_Simulation'
  const safeName = projectName.replace(/[^a-z0-9_-]/gi, '_')
  const filename = `${safeName}_Diagram_${new Date().toISOString().split('T')[0]}.${format}`

  const viewportDomNode = document.querySelector('.react-flow__viewport') as HTMLElement
  if (!viewportDomNode) {
    throw new Error('Could not locate simulation viewport element for image export.')
  }

  // Calculate full diagram bounding box and required dimensions
  const bounds = getNodesBounds(nodes)
  const imageWidth = Math.max(1200, Math.ceil(bounds.width + 200))
  const imageHeight = Math.max(800, Math.ceil(bounds.height + 200))

  // Calculate transformation matrix that centers all components neatly
  const viewport = getViewportForBounds(
    bounds,
    imageWidth,
    imageHeight,
    0.1,
    2.0,
    0.1 // 10% padding
  )

  const exportOptions = {
    backgroundColor: '#0a0e17',
    width: imageWidth,
    height: imageHeight,
    quality: 0.98,
    style: {
      width: `${imageWidth}px`,
      height: `${imageHeight}px`,
      transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
    },
  }

  try {
    let dataUrl: string
    if (format === 'png') {
      dataUrl = await toPng(viewportDomNode, exportOptions)
    } else {
      dataUrl = await toSvg(viewportDomNode, exportOptions)
    }

    const link = document.createElement('a')
    link.setAttribute('download', filename)
    link.setAttribute('href', dataUrl)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } catch (error) {
    console.error(`Failed to export diagram as ${format.toUpperCase()}:`, error)
    // Fallback without strict transform if custom icons/SVGs resisted transform cloning
    try {
      let fallbackUrl: string
      if (format === 'png') {
        fallbackUrl = await toPng(viewportDomNode, { backgroundColor: '#0a0e17', quality: 0.95 })
      } else {
        fallbackUrl = await toSvg(viewportDomNode, { backgroundColor: '#0a0e17' })
      }
      const link = document.createElement('a')
      link.setAttribute('download', filename)
      link.setAttribute('href', fallbackUrl)
      link.click()
    } catch (fallbackError) {
      throw new Error(`Failed to generate ${format.toUpperCase()} diagram image.`)
    }
  }
}

/**
 * Exports the complete project configuration (nodes, wiring edges, and code) to a JSON file.
 */
export function exportProjectAsJSON(): void {
  const store = useSimulatorStore.getState()
  const projectName = store.projectName || 'Aircraft_Simulation'
  const safeName = projectName.replace(/[^a-z0-9_-]/gi, '_')
  const filename = `${safeName}_Project_${new Date().toISOString().split('T')[0]}.json`

  const projectData = {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    projectName: store.projectName,
    projectId: store.projectId,
    nodes: store.nodes,
    edges: store.edges,
    code: store.code,
    probedPins: store.probedPins,
  }

  const jsonString = JSON.stringify(projectData, null, 2)
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/**
 * Imports and restores a simulation project configuration from a JSON file string.
 */
export function importProjectFromJSON(jsonString: string): boolean {
  try {
    const data = JSON.parse(jsonString)
    if (!data.nodes || !data.edges) {
      throw new Error('Invalid project JSON structure: missing nodes or edges.')
    }
    useSimulatorStore.setState({
      nodes: data.nodes,
      edges: data.edges,
      code: data.code || '',
      projectName: data.projectName || 'Imported Simulation Project',
      probedPins: data.probedPins || [],
    })
    return true
  } catch (error) {
    console.error('Failed to import project JSON:', error)
    return false
  }
}
