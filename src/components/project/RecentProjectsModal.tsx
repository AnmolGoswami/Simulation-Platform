import { useState, useEffect, useCallback } from 'react'
import { X, Trash2, FolderOpen, Loader2, Calendar, AlertCircle } from 'lucide-react'
import { projectService, type ProjectData } from '@/services/projectService'
import { useSimulatorStore } from '@/store/useSimulatorStore'

interface RecentProjectsModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string
}

export function RecentProjectsModal({ isOpen, onClose, userId }: RecentProjectsModalProps) {
  const [projects, setProjects] = useState<ProjectData[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  
  const loadProjectData = useSimulatorStore((s) => s.loadProjectData)

  const loadProjects = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await projectService.getUserProjects(userId)
      setProjects(data)
    } catch (err: unknown) {
      console.error(err)
      setError('Failed to load projects. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    if (isOpen && userId) {
      const timer = setTimeout(() => {
        loadProjects()
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [isOpen, userId, loadProjects])

  const handleLoad = async (project: ProjectData) => {
    try {
      loadProjectData(project)
      onClose()
    } catch {
      setError('Failed to load project details.')
    }
  }

  const handleDelete = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setDeletingId(projectId)
    setError('')
    try {
      await projectService.deleteProject(projectId)
      setProjects((prev) => prev.filter((p) => p.id !== projectId))
    } catch {
      setError('Failed to delete project.')
    } finally {
      setDeletingId(null)
    }
  }

  if (!isOpen) return null


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-xl border border-surface-700 bg-surface-900 p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[80vh]">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-text-muted hover:text-text-primary transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <h2 className="mb-1 text-lg font-bold text-text-primary flex items-center gap-2">
          <FolderOpen className="h-5 w-5 text-accent-400" />
          My Saved Simulations
        </h2>
        <p className="mb-4 text-xs text-text-muted">
          Select a project to load it into the simulator workspace.
        </p>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-danger-500/30 bg-danger-500/10 p-3 text-xs text-danger-400">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2 min-h-[200px]">
          {loading ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-text-muted">
              <Loader2 className="h-6 w-6 animate-spin text-accent-500" />
              <span className="text-xs">Fetching projects...</span>
            </div>
          ) : projects.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center py-8 text-center text-text-muted">
              <FolderOpen className="h-8 w-8 mb-2 opacity-40 text-text-muted" />
              <p className="text-xs font-semibold">No projects found</p>
              <p className="text-[11px] max-w-[240px] mt-1 opacity-70">
                Design a circuit in the workspace, name it in the header, and click Save!
              </p>
            </div>
          ) : (
            projects.map((project) => (
              <div
                key={project.id}
                onClick={() => handleLoad(project)}
                className="group flex items-center justify-between rounded-lg border border-border bg-surface-950 p-3 hover:border-accent-500 hover:bg-surface-850 cursor-pointer transition-all duration-150"
              >
                <div className="flex-1 min-w-0 pr-4">
                  <h3 className="text-xs font-semibold text-text-primary truncate group-hover:text-accent-400 transition-colors">
                    {project.name}
                  </h3>
                  <div className="mt-1 flex items-center gap-3 text-[10px] text-text-muted">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(project.updatedAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span>
                      {project.nodes?.length || 0} nodes • {project.edges?.length || 0} wires
                    </span>
                  </div>
                </div>

                <button
                  disabled={deletingId === project.id}
                  onClick={(e) => handleDelete(project.id, e)}
                  className="flex h-7 w-7 items-center justify-center rounded-md bg-surface-800 text-text-muted hover:bg-danger-500/20 hover:text-danger-400 disabled:opacity-40 transition-colors shrink-0"
                  title="Delete project"
                >
                  {deletingId === project.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            ))
          )}
        </div>

        <div className="mt-4 flex justify-end border-t border-surface-800 pt-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-border hover:bg-surface-800 text-text-secondary px-4 py-2 text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
