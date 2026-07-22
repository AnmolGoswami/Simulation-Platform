import { useState, useEffect, useRef } from 'react'
import { Plane, Zap, Save, FolderOpen, LogOut, LogIn, Loader2, Check, AlertCircle, Download, Image as ImageIcon, FileCode, Upload, ChevronDown, Sparkles } from 'lucide-react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { auth } from '@/services/firebase'
import { projectService } from '@/services/projectService'
import { useSimulatorStore } from '@/store/useSimulatorStore'
import { SimulationControls } from './SimulationControls'
import { AuthModal } from '@/components/auth/AuthModal'
import { RecentProjectsModal } from '@/components/project/RecentProjectsModal'
import { exportDiagramAsImage, exportProjectAsJSON, importProjectFromJSON } from '@/utils/diagramExporter'

const STATUS_COLORS: Record<string, string> = {
  idle: 'bg-surface-600 text-text-secondary',
  running: 'bg-success-500/20 text-success-500',
  paused: 'bg-warning-500/20 text-warning-500',
  error: 'bg-danger-500/20 text-danger-500',
}

interface BOMItem {
  name: string
  spec: string
  quantity: number
  description: string
}

const getComponentBOMInfo = (type: string, properties: any): { name: string; spec: string; description: string } => {
  switch (type) {
    case 'arduino-uno':
      return {
        name: 'Arduino Uno R3',
        spec: 'ATmega328P Microcontroller',
        description: 'Standard 5V microcontroller board for prototyping.',
      }
    case 'esp32-devkit':
      return {
        name: 'ESP32 DevKit V1',
        spec: 'ESP-WROOM-32 Wi-Fi + Bluetooth',
        description: 'Dual-core 3.3V development board with integrated wireless connectivity.',
      }
    case 'breadboard':
      return {
        name: 'Breadboard',
        spec: '400 Tie-Point Half Size',
        description: 'Solderless breadboard for circuit connections.',
      }
    case 'power-supply':
      return {
        name: '5V DC Power Supply',
        spec: '5.0V / 2.0A Output',
        description: 'Bench power supply module for circuit rails.',
      }
    case 'battery-9v':
      return {
        name: '9V Alkaline Battery',
        spec: '9V DC Nominal',
        description: 'Standard transistor battery for remote applications.',
      }
    case 'battery-12v':
      return {
        name: '12V Sealed Lead Acid Battery',
        spec: '12V DC / 1.2Ah',
        description: 'High capacity battery for heavy DC loads.',
      }
    case 'super-capacitor':
      return {
        name: 'Super Capacitor',
        spec: properties.capacitance ? `${properties.capacitance} Farad` : '1.0 Farad',
        description: 'High capacity energy storage capacitor.',
      }
    case 'regulator-7805':
      return {
        name: 'LM7805 Linear Regulator',
        spec: '5V Fixed Output TO-220',
        description: 'Voltage regulator to step down higher DC inputs to stable 5V.',
      }
    case 'usb-breakout':
      return {
        name: 'USB Type-C Breakout',
        spec: 'VBUS, GND, D+, D- Pins',
        description: 'Easy breadboard access to USB power lines.',
      }
    case 'dc-jack':
      return {
        name: 'DC Barrel Jack Adapter',
        spec: '2.1mm / 5.5mm Female Connector',
        description: 'Breadboard friendly adapter for wall adapters.',
      }
    case 'battery-9v-snap':
      return {
        name: '9V Battery Snap Clip',
        spec: 'T-Type with Breadboard Pins',
        description: 'Connects standard 9V battery to a breadboard.',
      }
    case 'battery-18650':
      return {
        name: '18650 Li-Ion Battery',
        spec: '3.7V Nominal / 2200mAh',
        description: 'Rechargeable high-current cell.',
      }
    case 'battery-holder-18650':
      return {
        name: '18650 Battery Holder',
        spec: 'Single Slot with Wire Leads',
        description: 'Secure chassis mount clip for 18650 battery.',
      }
    case 'led':
      const color = properties.color || 'Red'
      return {
        name: `${color} LED`,
        spec: '5mm Diffused / 2.0V Vf',
        description: 'Standard light emitting diode for indicators.',
      }
    case 'resistor':
      const resistance = properties.resistance ? `${properties.resistance} Ω` : '220 Ω'
      return {
        name: 'Resistor',
        spec: resistance,
        description: 'Metal/Carbon film 1/4W axial resistor.',
      }
    case 'capacitor':
      const capVal = properties.capacitance ? `${properties.capacitance} uF` : '10 uF'
      return {
        name: 'Capacitor',
        spec: capVal,
        description: 'Decoupling or filtering capacitor.',
      }
    case 'push-button':
      return {
        name: 'Tactile Switch',
        spec: '6x6x5mm Momentary SPST',
        description: 'Normally-open push button switch.',
      }
    case 'potentiometer':
      const potRes = properties.resistance ? `${properties.resistance} Ω` : '10k Ω'
      return {
        name: 'Rotary Potentiometer',
        spec: potRes,
        description: 'Single-turn analog control dial.',
      }
    case 'dht22':
      return {
        name: 'DHT22 Sensor',
        spec: 'AM2302 Temp + Humidity',
        description: 'Digital temperature and relative humidity sensor.',
      }
    case 'lm35':
      return {
        name: 'LM35 Temp Sensor',
        spec: 'Analog 10mV/°C Output TO-92',
        description: 'Precision integrated-circuit temperature sensor.',
      }
    case 'buzzer':
      return {
        name: 'Piezo Buzzer',
        spec: 'Active 5V DC Sounder',
        description: 'Sound-making transducer for alarm tones.',
      }
    case 'diode':
      return {
        name: '1N4007 Rectifier Diode',
        spec: '1000V / 1A DO-41 Package',
        description: 'Prevents reverse current flow in circuits.',
      }
    case 'transistor-mosfet':
      return {
        name: 'N-Channel MOSFET (IRF540N)',
        spec: '100V / 33A TO-220 Package',
        description: 'Power switching element controlled by gate voltage.',
      }
    case 'lcd1602':
      return {
        name: 'LCD 16x2 Display (I2C)',
        spec: 'HD44780 + PCF8574 Backlight',
        description: 'Alphanumeric display using I2C bus interface.',
      }
    case 'oled-ssd1306':
      return {
        name: 'OLED 0.96" Display',
        spec: '128x64 Pixels I2C SSD1306',
        description: 'Monochrome graphic display screen.',
      }
    case 'motor-dc':
      return {
        name: 'DC Toy Motor',
        spec: '3V - 6V Dual Shaft Gearbox',
        description: 'Small electric motor for mechanical actuation.',
      }
    case 'fan-pc':
      return {
        name: '12V PC Cooling Fan',
        spec: '80mm 2-pin DC Brushless',
        description: 'Small brushless fan for cooling.',
      }
    default:
      return {
        name: type.toUpperCase(),
        spec: 'Custom Component',
        description: 'Simulation node.',
      }
  }
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

  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDownloadDiagram = async (format: 'png' | 'svg') => {
    setIsExporting(true)
    setIsExportMenuOpen(false)
    try {
      await exportDiagramAsImage(format)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error exporting diagram image.')
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportProjectJSON = () => {
    setIsExportMenuOpen(false)
    exportProjectAsJSON()
  }

  const handleImportJSONClick = () => {
    setIsExportMenuOpen(false)
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      const content = evt.target?.result as string
      if (content) {
        const success = importProjectFromJSON(content)
        if (success) {
          alert('Project imported successfully!')
        } else {
          alert('Failed to import project. Please check if the file is valid JSON.')
        }
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  // Tracks "the user tried to save while signed out" so we can resume the
  // save the moment auth actually resolves, instead of relying on a stale
  // `user` closure inside AuthModal's onSuccess (which fires before
  // onAuthStateChanged has necessarily updated state — a real race that
  // silently dropped the save in the original flow).
  const pendingSaveRef = useRef(false)

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

  const handleDownloadBOM = () => {
    if (nodes.length === 0) {
      alert('Your circuit workspace is empty. There are no components to include in the Bill of Materials!')
      return
    }

    const grouped: Record<string, BOMItem> = {}

    nodes.forEach((node) => {
      const info = getComponentBOMInfo(node.type, node.properties)
      const key = `${info.name}:${info.spec}`

      if (grouped[key]) {
        grouped[key].quantity += 1
      } else {
        grouped[key] = {
          name: info.name,
          spec: info.spec,
          quantity: 1,
          description: info.description,
        }
      }
    })

    // Generate CSV Content
    const headers = ['Component Name', 'Specification', 'Quantity', 'Description']
    const rows = Object.values(grouped).map((item) => [
      `"${item.name.replace(/"/g, '""')}"`,
      `"${item.spec.replace(/"/g, '""')}"`,
      item.quantity,
      `"${item.description.replace(/"/g, '""')}"`,
    ])

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')

    // Trigger File Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    
    const formattedDate = new Date().toISOString().split('T')[0]
    const filename = `${projectName.replace(/[^a-z0-9_-]/gi, '_') || 'Simulation'}_BOM_${formattedDate}.csv`
    
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
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

        {/* Hidden File Input for JSON Import */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".json"
          className="hidden"
        />

        {/* Click-away backdrop */}
        {isExportMenuOpen && (
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsExportMenuOpen(false)}
          />
        )}

        {/* Wire Explorer Button */}
        <button
          onClick={() => useSimulatorStore.setState((s) => ({ isWireExplorerOpen: !s.isWireExplorerOpen }))}
          className={`flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-all active:scale-95 ${
            useSimulatorStore((s) => s.isWireExplorerOpen)
              ? 'border-accent-400 bg-accent-500/20 text-accent-300 shadow-md ring-1 ring-accent-400/30'
              : 'border-border bg-surface-800 text-text-secondary hover:bg-surface-750 hover:text-text-primary'
          }`}
          title="Open Wire Explorer, Connection Checklist, and X-Ray Inspector"
        >
          <Sparkles className="h-3.5 w-3.5 text-accent-400" />
          <span>Wire Explorer</span>
        </button>

        {/* Export Dropdown */}
        <div className="relative z-50">
          <button
            onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
            disabled={isExporting}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface-800 text-text-secondary hover:bg-surface-700 hover:text-text-primary px-3 text-xs font-semibold transition-colors active:scale-95 disabled:opacity-60"
            title="Download diagram image, BOM CSV, or Project JSON"
          >
            {isExporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-accent-400" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            <span>Export / Download</span>
            <ChevronDown className={`h-3 w-3 transition-transform ${isExportMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {isExportMenuOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-56 rounded-lg border border-border bg-surface-850 p-1.5 shadow-xl flex flex-col gap-0.5">
              <button
                onClick={() => handleDownloadDiagram('png')}
                className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs font-medium text-text-secondary hover:bg-surface-750 hover:text-text-primary text-left transition-colors"
              >
                <ImageIcon className="h-4 w-4 text-accent-400 shrink-0" />
                <div className="flex flex-col">
                  <span className="font-semibold text-text-primary">Download Diagram (PNG)</span>
                  <span className="text-[10px] text-text-muted">High-res canvas image snapshot</span>
                </div>
              </button>

              <button
                onClick={() => handleDownloadDiagram('svg')}
                className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs font-medium text-text-secondary hover:bg-surface-750 hover:text-text-primary text-left transition-colors"
              >
                <ImageIcon className="h-4 w-4 text-purple-400 shrink-0" />
                <div className="flex flex-col">
                  <span className="font-semibold text-text-primary">Download Diagram (SVG)</span>
                  <span className="text-[10px] text-text-muted">Scalable vector diagram</span>
                </div>
              </button>

              <div className="my-1 h-px bg-border" />

              <button
                onClick={() => {
                  setIsExportMenuOpen(false)
                  handleDownloadBOM()
                }}
                className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs font-medium text-text-secondary hover:bg-surface-750 hover:text-text-primary text-left transition-colors"
              >
                <Download className="h-4 w-4 text-success-400 shrink-0" />
                <div className="flex flex-col">
                  <span className="font-semibold text-text-primary">Bill of Materials (BOM)</span>
                  <span className="text-[10px] text-text-muted">CSV file with quantities & specs</span>
                </div>
              </button>

              <div className="my-1 h-px bg-border" />

              <button
                onClick={handleExportProjectJSON}
                className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs font-medium text-text-secondary hover:bg-surface-750 hover:text-text-primary text-left transition-colors"
              >
                <FileCode className="h-4 w-4 text-amber-400 shrink-0" />
                <div className="flex flex-col">
                  <span className="font-semibold text-text-primary">Export Project (JSON)</span>
                  <span className="text-[10px] text-text-muted">Backup exact simulation file</span>
                </div>
              </button>

              <button
                onClick={handleImportJSONClick}
                className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs font-medium text-text-secondary hover:bg-surface-750 hover:text-text-primary text-left transition-colors"
              >
                <Upload className="h-4 w-4 text-blue-400 shrink-0" />
                <div className="flex flex-col">
                  <span className="font-semibold text-text-primary">Import Project (JSON)</span>
                  <span className="text-[10px] text-text-muted">Load saved simulation JSON</span>
                </div>
              </button>
            </div>
          )}
        </div>

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