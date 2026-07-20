import { useRef } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import {
  Play,
  Square,
  RotateCcw,
  Copy,
  Clipboard,
  Sun,
  Moon,
  Code2,
} from 'lucide-react'
import { PanelHeader } from '@/components/layout/ResizablePanel'
import { useSimulatorStore } from '@/store/useSimulatorStore'

export default function CodeEditor() {
  const code = useSimulatorStore((s) => s.code)
  const setCode = useSimulatorStore((s) => s.setCode)
  const editorTheme = useSimulatorStore((s) => s.editorTheme)
  const setEditorTheme = useSimulatorStore((s) => s.setEditorTheme)
  const simulationStatus = useSimulatorStore((s) => s.simulationStatus)
  const setSimulationStatus = useSimulatorStore((s) => s.setSimulationStatus)
  const addLog = useSimulatorStore((s) => s.addLog)
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null)

  const handleEditorMount: OnMount = (editor) => {
    editorRef.current = editor
  }

  const handleRun = () => {
    setSimulationStatus('running')
    addLog('info', 'Simulation started', 'simulation')
    addLog('info', 'Parsing Arduino/ESP32 code...', 'simulation')
  }

  const handleStop = () => {
    setSimulationStatus('idle')
    addLog('info', 'Simulation stopped', 'simulation')
  }

  const handleReset = () => {
    setSimulationStatus('idle')
    addLog('info', 'Simulation reset', 'simulation')
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    addLog('info', 'Code copied to clipboard')
  }

  const handlePaste = async () => {
    const text = await navigator.clipboard.readText()
    setCode(text)
    addLog('info', 'Code pasted from clipboard')
  }

  const toggleTheme = () => {
    setEditorTheme(editorTheme === 'vs-dark' ? 'light' : 'vs-dark')
  }

  const isRunning = simulationStatus === 'running'

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PanelHeader
        title="Code Editor"
        icon={<Code2 className="h-3.5 w-3.5" />}
        actions={
          <div className="flex items-center gap-1">
            <EditorButton
              icon={Play}
              onClick={handleRun}
              title="Run"
              variant="success"
              disabled={isRunning}
            />
            <EditorButton
              icon={Square}
              onClick={handleStop}
              title="Stop"
              variant="danger"
              disabled={!isRunning}
            />
            <EditorButton icon={RotateCcw} onClick={handleReset} title="Reset" />
            <div className="mx-1 h-4 w-px bg-border" />
            <EditorButton icon={Copy} onClick={handleCopy} title="Copy" />
            <EditorButton icon={Clipboard} onClick={handlePaste} title="Paste" />
            <EditorButton
              icon={editorTheme === 'vs-dark' ? Sun : Moon}
              onClick={toggleTheme}
              title="Toggle Theme"
            />
          </div>
        }
      />

      <div className="min-h-0 flex-1">
        <Editor
          height="100%"
          defaultLanguage="cpp"
          language="cpp"
          theme={editorTheme}
          value={code}
          onChange={(value) => setCode(value ?? '')}
          onMount={handleEditorMount}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
            padding: { top: 12 },
            renderLineHighlight: 'line',
            cursorBlinking: 'smooth',
            smoothScrolling: true,
          }}
          loading={
            <div className="flex h-full items-center justify-center bg-surface-900">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent-500 border-t-transparent" />
            </div>
          }
        />
      </div>
    </div>
  )
}

function EditorButton({
  icon: Icon,
  onClick,
  title,
  variant = 'default',
  disabled = false,
}: {
  icon: typeof Play
  onClick: () => void
  title: string
  variant?: 'default' | 'success' | 'danger'
  disabled?: boolean
}) {
  const variants = {
    default: 'text-text-muted hover:bg-surface-700 hover:text-text-secondary',
    success: 'text-success-500 hover:bg-success-500/20',
    danger: 'text-danger-500 hover:bg-danger-500/20',
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`rounded p-1 transition-colors disabled:opacity-40 ${variants[variant]}`}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  )
}
