import { useCallback } from 'react'
import { useSimulatorStore } from '@/store/useSimulatorStore'

export function useKeyboardShortcuts() {
  const undo = useSimulatorStore((s) => s.undo)
  const redo = useSimulatorStore((s) => s.redo)
  const removeNode = useSimulatorStore((s) => s.removeNode)
  const removeEdge = useSimulatorStore((s) => s.removeEdge)
  const duplicateNode = useSimulatorStore((s) => s.duplicateNode)
  const rotateNode = useSimulatorStore((s) => s.rotateNode)
  const selectedNodeIds = useSimulatorStore((s) => s.selectedNodeIds)
  const selectedEdgeIds = useSimulatorStore((s) => s.selectedEdgeIds)
  const clearSelection = useSimulatorStore((s) => s.clearSelection)
  const wireToolActive = useSimulatorStore((s) => s.wireToolActive)
  const setWireToolActive = useSimulatorStore((s) => s.setWireToolActive)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey
      const target = e.target as HTMLElement
      const isInputField =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable

      if (isInputField) return

      if (isMeta && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if (isMeta && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        redo()
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeIds.length > 0 || selectedEdgeIds.length > 0) {
          e.preventDefault()
          selectedNodeIds.forEach((id) => removeNode(id))
          selectedEdgeIds.forEach((id) => removeEdge(id))
        }
      } else if (isMeta && e.key === 'd' && selectedNodeIds.length > 0) {
        e.preventDefault()
        selectedNodeIds.forEach((id) => duplicateNode(id))
      } else if (e.key === 'Escape') {
        e.preventDefault()
        clearSelection()
        setWireToolActive(false)
      } else if (e.key === 'r' || e.key === 'R') {
        if (selectedNodeIds.length > 0) {
          e.preventDefault()
          selectedNodeIds.forEach((id) => rotateNode(id))
        }
      } else if (e.key === 'w' || e.key === 'W') {
        e.preventDefault()
        setWireToolActive(!wireToolActive)
      }
    },
    [
      undo,
      redo,
      removeNode,
      removeEdge,
      duplicateNode,
      rotateNode,
      selectedNodeIds,
      selectedEdgeIds,
      clearSelection,
      wireToolActive,
      setWireToolActive,
    ],
  )

  return { handleKeyDown }
}
