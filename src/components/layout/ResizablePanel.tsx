import { useEffect, type ReactNode } from 'react'

interface ResizablePanelProps {
  children: ReactNode
  size: number
  minSize?: number
  direction: 'horizontal' | 'vertical'
  position: 'start' | 'end'
  onResize: (e: React.MouseEvent) => void
  isDragging?: boolean
  className?: string
}

export function ResizablePanel({
  children,
  size,
  direction,
  position,
  onResize,
  isDragging = false,
  className = '',
}: ResizablePanelProps) {
  const isHorizontal = direction === 'horizontal'
  const sizeStyle = isHorizontal ? { width: size } : { height: size }

  // While actively dragging, lock the cursor + suppress text selection globally.
  // Without this, fast mouse movement during a drag can select surrounding text
  // or let the cursor flicker back to default between mousemove events —
  // both of which make real-time resizing feel laggy/broken even when the
  // underlying resize math is correct.
  useEffect(() => {
    if (!isDragging) return
    const prevCursor = document.body.style.cursor
    const prevUserSelect = document.body.style.userSelect
    document.body.style.cursor = isHorizontal ? 'col-resize' : 'row-resize'
    document.body.style.userSelect = 'none'
    return () => {
      document.body.style.cursor = prevCursor
      document.body.style.userSelect = prevUserSelect
    }
  }, [isDragging, isHorizontal])

  return (
    <div
      className={`relative flex shrink-0 flex-col overflow-hidden ${className}`}
      style={
        isDragging
          ? sizeStyle
          : { ...sizeStyle, transition: 'width 120ms ease-out, height 120ms ease-out' }
      }
    >
      {children}

      {/* Larger invisible hit-zone so the handle is easy to grab without
          visually widening the border line */}
      <div
        role="separator"
        aria-orientation={isHorizontal ? 'vertical' : 'horizontal'}
        aria-label={`Resize panel (${isHorizontal ? 'drag left/right' : 'drag up/down'})`}
        className={`panel-resize-handle group absolute z-20 flex items-center justify-center bg-transparent ${
          isHorizontal
            ? `top-0 h-full w-2.5 cursor-col-resize ${position === 'start' ? '-right-1.5' : '-left-1.5'}`
            : `left-0 w-full h-2.5 cursor-row-resize ${position === 'start' ? '-bottom-1.5' : '-top-1.5'}`
        }`}
        onMouseDown={onResize}
      >
        {/* Visible hairline */}
        <div
          className={`bg-border transition-colors group-hover:bg-accent-500/60 ${
            isDragging ? '!bg-accent-500' : ''
          } ${isHorizontal ? 'h-full w-px' : 'w-full h-px'}`}
        />
        {/* Grip affordance shown on hover/drag */}
        <div
          className={`absolute rounded-full bg-accent-400 opacity-0 transition-opacity group-hover:opacity-100 ${
            isDragging ? '!opacity-100' : ''
          } ${isHorizontal ? 'h-8 w-1' : 'w-8 h-1'}`}
        />
      </div>
    </div>
  )
}

interface PanelHeaderProps {
  title: string
  icon?: ReactNode
  actions?: ReactNode
}

export function PanelHeader({ title, icon, actions }: PanelHeaderProps) {
  return (
    <div className="flex h-9 shrink-0 items-center justify-between border-b border-border bg-surface-850 px-3">
      <div className="flex items-center gap-2 min-w-0">
        {icon && <span className="text-text-muted shrink-0">{icon}</span>}
        <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary truncate">
          {title}
        </span>
      </div>
      {actions && <div className="flex items-center gap-1 shrink-0">{actions}</div>}
    </div>
  )
}