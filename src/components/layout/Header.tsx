import { useState, useEffect, useRef } from 'react'
import { Plane, Zap, Save, FolderOpen, LogOut, LogIn, Loader2, Check, AlertCircle } from 'lucide-react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { auth } from '@/services/firebase'
import { projectService } from '@/services/projectService'
import { useSimulatorStore } from '@/store/useSimulatorStore'
import { SimulationControls } from './SimulationControls'
import { AuthModal } from '@/components/auth/AuthModal'
import { RecentProjectsModal } from '@/components/project/RecentProjectsModal'

const STATUS_COLORS: Record<string, string> = {
  idle: 'bg-surface-600 text-text-secondary',
  running: 'bg-success-500/20 text-success-500',
  paused: 'bg-warning-500/20 text-warning-500',
  error: 'bg-danger-500/20 text-danger-500',
}

export function Header() {
  const projectName = useSimulatorStore((s) => s.projectName)
  const setProjectName = useSimulatorStore((s) => s.setProjectName)
  const simulationStatus = useSimulatorStore((s) => s.simulationStatus)

  const nodes = useSimulatorStore((s) => s.nodes)
  const edges = useSimulatorStore((s) => s.edges)
  const code = useSimulatorStore((s) => s.code)
  const projectId = useSimulatorStore((s) => s.projectId)
  const setProjectId = useSimulatorStore((s) => s.setProjectId)

  const [user, setUser] = useState<User | null>(null)
  const [isAuthOpen, setIsAuthOpen] = useState(false)
  const [isProjectsOpen, setIsProjectsOpen] = useState(false)

  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')

  // Tracks "the user tried to save while signed out" so we can resume the
  // save the moment auth actually resolves, instead of relying on a stale
  // `user` closure inside AuthModal's onSuccess (which fires before
  // onAuthStateChanged has necessarily updated state — a real race that
  // silently dropped the save in the original flow).
  const pendingSaveRef = useRef(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u)
      if (u && pendingSaveRef.current) {
        pendingSaveRef.current = false
        void runSave(u)
      }
    })
    return () => unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const runSave = async (activeUser: User) => {
    setIsSaving(true)
    setSaveStatus('idle')
    try {
      const savedId = await projectService.saveProject(
        activeUser.uid,
        projectId,
        projectName || 'My Simulation Project',
        nodes,
        edges,
        code
      )
      setProjectId(savedId)
      setSaveStatus('success')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (error) {
      console.error(error)
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    } finally {
      setIsSaving(false)
    }
  }

  const handleSave = async () => {
    if (!user) {
      pendingSaveRef.current = true
      setIsAuthOpen(true)
      return
    }
    await runSave(user)
  }

  const handleOpenProjects = () => {
    if (!user) {
      setIsAuthOpen(true)
    } else {
      setIsProjectsOpen(true)
    }
  }

  const isRunning = simulationStatus === 'running'

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface-900 px-4">
      {/* Brand & Project Name */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-500/20">
          <Plane className="h-4 w-4 text-accent-400" />
        </div>
        <div className="flex flex-col min-w-0">
          <h1 className="text-xs font-bold text-text-primary leading-tight truncate">
            Aircraft Fault-Tolerant Simulator
          </h1>
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="bg-transparent border-b border-transparent hover:border-surface-600 focus:border-accent-500 text-xs text-text-muted font-medium py-0.5 px-0 outline-none w-56 transition-colors"
            placeholder="Name your simulation project..."
            aria-label="Project name"
          />
        </div>
      </div>

      {/* Center / Action Buttons */}
      <div className="flex items-center gap-2 shrink-0">
        <SimulationControls />
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium capitalize transition-colors ${STATUS_COLORS[simulationStatus] ?? STATUS_COLORS.idle}`}
        >
          <span className="relative flex h-2 w-2">
            {isRunning && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success-400 opacity-75" />
            )}
            <Zap className="relative h-3 w-3" />
          </span>
          {simulationStatus}
        </span>
      </div>

      {/* Right / Auth & Cloud Buttons */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`flex h-8 min-w-[76px] items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-all active:scale-95 ${
            saveStatus === 'success'
              ? 'bg-success-600 hover:bg-success-500 text-white'
              : saveStatus === 'error'
              ? 'bg-danger-600 hover:bg-danger-500 text-white'
              : 'bg-accent-500 hover:bg-accent-600 text-white'
          } disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100`}
          title={user ? 'Save project to Firebase Cloud' : 'Sign in to save your project'}
        >
          {isSaving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : saveStatus === 'success' ? (
            <Check className="h-3.5 w-3.5" />
          ) : saveStatus === 'error' ? (
            <AlertCircle className="h-3.5 w-3.5" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          {isSaving ? 'Saving…' : saveStatus === 'success' ? 'Saved!' : saveStatus === 'error' ? 'Retry' : 'Save'}
        </button>

        {/* Projects button */}
        <button
          onClick={handleOpenProjects}
          className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface-800 text-text-secondary hover:bg-surface-700 hover:text-text-primary px-3 text-xs font-semibold transition-colors active:scale-95"
          title="Browse my saved projects"
        >
          <FolderOpen className="h-3.5 w-3.5" />
          My Projects
        </button>

        {/* Divider */}
        <div className="h-5 w-px bg-border" />

        {/* User Auth Info */}
        {user ? (
          <div className="flex items-center gap-2">
            <span
              className="hidden max-w-[120px] truncate text-xs text-text-muted md:inline"
              title={user.email || ''}
            >
              {user.email}
            </span>
            <button
              onClick={() => signOut(auth)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface-800 text-text-muted hover:bg-danger-500/20 hover:text-danger-400 transition-colors active:scale-95"
              title="Sign Out"
              aria-label="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsAuthOpen(true)}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface-800 text-text-secondary hover:bg-surface-700 hover:text-text-primary px-3 text-xs font-semibold transition-colors active:scale-95"
          >
            <LogIn className="h-3.5 w-3.5" />
            Sign In
          </button>
        )}
      </div>

      {/* Modals */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={() => {
          // The actual save resume is handled by onAuthStateChanged above,
          // which fires reliably once Firebase confirms the session — this
          // just closes the modal so the UI doesn't wait on it.
          setIsAuthOpen(false)
        }}
      />

      {user && (
        <RecentProjectsModal
          isOpen={isProjectsOpen}
          onClose={() => setIsProjectsOpen(false)}
          userId={user.uid}
        />
      )}
    </header>
  )
}