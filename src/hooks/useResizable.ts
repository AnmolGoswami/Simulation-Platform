import { useCallback, useEffect, useRef, useState } from 'react'

interface UseResizableOptions {
  initialSize: number
  minSize: number
  maxSize: number
  direction: 'horizontal' | 'vertical'
  invert?: boolean
  onResize?: (size: number) => void
}

export function useResizable({
  initialSize,
  minSize,
  maxSize,
  direction,
  invert = false,
  onResize,
}: UseResizableOptions) {
  const [size, setSize] = useState(initialSize)
  const [isDragging, setIsDragging] = useState(false)
  const startPos = useRef(0)
  const startSize = useRef(initialSize)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      setIsDragging(true)
      startPos.current = direction === 'horizontal' ? e.clientX : e.clientY
      startSize.current = size
    },
    [direction, size],
  )

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const currentPos = direction === 'horizontal' ? e.clientX : e.clientY
      const delta = currentPos - startPos.current
      const adjustedDelta = invert ? -delta : delta
      const newSize = Math.min(maxSize, Math.max(minSize, startSize.current + adjustedDelta))
      setSize(newSize)
      onResize?.(newSize)
    }

    const handleMouseUp = () => setIsDragging(false)

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize'
    document.body.style.userSelect = 'none'

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isDragging, direction, invert, minSize, maxSize, onResize])

  return { size, isDragging, handleMouseDown, setSize }
}
