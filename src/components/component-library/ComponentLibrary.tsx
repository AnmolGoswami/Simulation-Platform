import { useState } from 'react'
import {
  Search,
  ChevronDown,
  ChevronRight,
  Cpu,
  Zap,
  Thermometer,
  Lightbulb,
  ToggleLeft,
  CircuitBoard,
  Cable,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { PanelHeader } from '@/components/layout/ResizablePanel'
import { ComponentSVG } from '@/assets/component-svgs/ComponentSVG'
import {
  COMPONENT_CATEGORIES,
  getComponentsByCategory,
} from '@/utils/componentDefinitions'
import type { ComponentCategory, ComponentType } from '@/types'

const CATEGORY_ICONS = {
  boards: Cpu,
  power: Zap,
  sensors: Thermometer,
  outputs: Lightbulb,
  control: ToggleLeft,
  electronic: CircuitBoard,
  connection: Cable,
}

export function ComponentLibrary() {
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<ComponentCategory>>(
    new Set(['boards', 'power', 'outputs']),
  )

  const toggleCategory = (category: ComponentCategory) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
  }

  const handleDragStart = (e: React.DragEvent, type: ComponentType) => {
    e.dataTransfer.setData('application/component-type', type)
    e.dataTransfer.effectAllowed = 'copy'
  }

  const filteredCategories = COMPONENT_CATEGORIES.map((cat) => ({
    ...cat,
    components: getComponentsByCategory(cat.id).filter(
      (c) =>
        !search ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.description.toLowerCase().includes(search.toLowerCase()),
    ),
  })).filter((cat) => cat.components.length > 0)

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Component Library" icon={<CircuitBoard className="h-3.5 w-3.5" />} />

      <div className="border-b border-border p-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search components..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-border bg-surface-850 py-1.5 pl-8 pr-3 text-xs text-text-primary placeholder:text-text-muted focus:border-accent-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {filteredCategories.map((category) => {
          const Icon = CATEGORY_ICONS[category.id]
          const isExpanded = expanded.has(category.id)

          return (
            <div key={category.id} className="mb-1">
              <button
                type="button"
                onClick={() => toggleCategory(category.id)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium text-text-secondary hover:bg-surface-850"
              >
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                )}
                <Icon className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                <span className="flex-1">{category.label}</span>
                <span className="text-text-muted">{category.components.length}</span>
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-2 gap-1.5 px-1 pb-2 pt-1">
                      {category.components.map((component) => (
                        <div
                          key={component.type}
                          draggable
                          onDragStart={(e) => handleDragStart(e, component.type)}
                          className="group flex cursor-grab flex-col items-center rounded-lg border border-transparent bg-surface-850 p-2 transition-all hover:border-border hover:bg-surface-800 active:cursor-grabbing active:scale-95"
                          title={component.description}
                        >
                          <ComponentSVG
                            type={component.type}
                            width={36}
                            height={36}
                            className="mb-1.5"
                          />
                          <span className="line-clamp-2 text-center text-[10px] leading-tight text-text-secondary group-hover:text-text-primary">
                            {component.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
    </div>
  )
}
