import { useSimulatorStore } from '@/store/useSimulatorStore'
import { Flame, ShieldAlert, PowerOff, CheckCircle, RefreshCw, ToggleLeft, ToggleRight } from 'lucide-react'

export function FaultInjectionPanel() {
  const edges = useSimulatorStore((s) => s.edges)
  const activeFaults = useSimulatorStore((s) => s.activeFaults)
  const toggleFault = useSimulatorStore((s) => s.toggleFault)
  const nodes = useSimulatorStore((s) => s.nodes)
  const updateNodeProperties = useSimulatorStore((s) => s.updateNodeProperties)
  const resetDebuggingState = useSimulatorStore((s) => s.resetDebuggingState)
  const addTimelineEvent = useSimulatorStore((s) => s.addTimelineEvent)

  // Capstone Scenario 1: Main Generator Failure
  const triggerGeneratorFailure = () => {
    // Inject battery failure and generator faults
    if (!activeFaults['generator-fault']) toggleFault('generator-fault')
    if (!activeFaults['battery-failure']) toggleFault('battery-failure')
    addTimelineEvent('scenario', '🚨 Scenario Triggered: Main Generator Loss! Secondary battery taking over.')
  }

  // Capstone Scenario 2: High Temp / Fire Engine Warning
  const triggerTempSpike = () => {
    // Find dht22, ds18b20, or lm35 nodes in workspace and set temperature high
    const sensorNode = nodes.find(n => n.type === 'dht22' || n.type === 'ds18b20' || n.type === 'lm35')
    if (sensorNode) {
      updateNodeProperties(sensorNode.id, { temperature: 115 }) // Fire threshold
      addTimelineEvent('scenario', `🔥 Scenario Triggered: Temperature Spike (115°C) on ${sensorNode.properties.name || sensorNode.type.toUpperCase()}!`)
    }
  }

  // Capstone Scenario 3: Sensor Disagreement / Redundancy Switchover
  const triggerSensorDisagreement = () => {
    // Fail the primary sensor to force backup read switchover
    if (!activeFaults['dht22-failure']) toggleFault('dht22-failure')
    addTimelineEvent('scenario', '⚠️ Scenario Triggered: DHT22 Failure! System switching to secondary DS18B20.')
  }

  // Auto recovery
  const triggerRecovery = () => {
    resetDebuggingState()
    // Reset any temperature spikes
    nodes.forEach(n => {
      if (n.type === 'dht22' || n.type === 'ds18b20' || n.type === 'lm35') {
        updateNodeProperties(n.id, { temperature: 25 })
      }
    })
    addTimelineEvent('scenario', '✅ Scenario Cleared: Aircraft systems nominal. Recovery successful.')
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full p-3 bg-surface-900 text-xs overflow-y-auto">
      
      {/* Column 1: Scenarios & Automation */}
      <div className="border border-border rounded-lg bg-surface-950/40 p-2.5 flex flex-col gap-2">
        <h3 className="flex items-center gap-1.5 font-bold text-text-primary border-b border-border pb-1.5 mb-1 uppercase tracking-wider text-[10px]">
          <Flame className="h-3.5 w-3.5 text-red-500 animate-pulse" />
          Aircraft Capstone Scenarios
        </h3>
        
        <button
          onClick={triggerGeneratorFailure}
          className="flex items-center gap-2 p-2 rounded border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 text-left font-semibold text-[10px]"
        >
          <PowerOff className="h-4 w-4 shrink-0" />
          <div>
            <div className="font-bold">Loss of Generator Feed</div>
            <div className="text-[8px] opacity-80 mt-0.5">Cuts main DC generator, testing backup relay switcher.</div>
          </div>
        </button>

        <button
          onClick={triggerTempSpike}
          className="flex items-center gap-2 p-2 rounded border border-orange-500/20 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 text-left font-semibold text-[10px]"
        >
          <Flame className="h-4 w-4 shrink-0" />
          <div>
            <div className="font-bold">Engine Zone Overheat</div>
            <div className="text-[8px] opacity-80 mt-0.5">Spikes sensor readings to 115°C, triggering fire loops.</div>
          </div>
        </button>

        <button
          onClick={triggerSensorDisagreement}
          className="flex items-center gap-2 p-2 rounded border border-warning-500/20 bg-warning-500/10 text-warning-400 hover:bg-warning-500/20 text-left font-semibold text-[10px]"
        >
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <div>
            <div className="font-bold">Primary Sensor Failure</div>
            <div className="text-[8px] opacity-80 mt-0.5">Breaks DHT22 communication link. Checks backup switch.</div>
          </div>
        </button>

        <button
          onClick={triggerRecovery}
          className="flex items-center gap-2 p-2 rounded border border-success-500/20 bg-success-500/10 text-success-400 hover:bg-success-500/20 text-left font-semibold text-[10px] mt-auto"
        >
          <CheckCircle className="h-4 w-4 shrink-0" />
          <div>
            <div className="font-bold">Full Auto-Recovery</div>
            <div className="text-[8px] opacity-80 mt-0.5">Resolves all faults and restores clean flight operations.</div>
          </div>
        </button>
      </div>

      {/* Column 2: Component & Actuator Faults */}
      <div className="border border-border rounded-lg bg-surface-950/40 p-2.5 flex flex-col gap-2">
        <h3 className="flex items-center gap-1.5 font-bold text-text-primary border-b border-border pb-1.5 mb-1 uppercase tracking-wider text-[10px]">
          <ShieldAlert className="h-3.5 w-3.5 text-accent-500" />
          Component & Actuator Faults
        </h3>
        
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
          {/* Fan stall */}
          <div className="flex justify-between items-center bg-surface-850 px-2 py-1 rounded border border-border">
            <div>
              <div className="font-bold text-text-primary text-[9px]">PC Fan Mechanical Stall</div>
              <div className="text-[8px] text-text-muted">Jams fan blades to 0 RPM</div>
            </div>
            <button onClick={() => toggleFault('fan-stall')}>
              {activeFaults['fan-stall'] ? (
                <ToggleRight className="h-5 w-5 text-red-500" />
              ) : (
                <ToggleLeft className="h-5 w-5 text-text-muted" />
              )}
            </button>
          </div>

          {/* Motor jam */}
          <div className="flex justify-between items-center bg-surface-850 px-2 py-1 rounded border border-border">
            <div>
              <div className="font-bold text-text-primary text-[9px]">DC Motor Rotor Jam</div>
              <div className="text-[8px] text-text-muted">Causes high electrical current draws</div>
            </div>
            <button onClick={() => toggleFault('motor-jam')}>
              {activeFaults['motor-jam'] ? (
                <ToggleRight className="h-5 w-5 text-red-500" />
              ) : (
                <ToggleLeft className="h-5 w-5 text-text-muted" />
              )}
            </button>
          </div>

          {/* LED Broken */}
          <div className="flex justify-between items-center bg-surface-850 px-2 py-1 rounded border border-border">
            <div>
              <div className="font-bold text-text-primary text-[9px]">LED Connection Open</div>
              <div className="text-[8px] text-text-muted">Prevents warning LED from lighting</div>
            </div>
            <button onClick={() => toggleFault('led-failure')}>
              {activeFaults['led-failure'] ? (
                <ToggleRight className="h-5 w-5 text-red-500" />
              ) : (
                <ToggleLeft className="h-5 w-5 text-text-muted" />
              )}
            </button>
          </div>

          {/* Fuse Blown */}
          <div className="flex justify-between items-center bg-surface-850 px-2 py-1 rounded border border-border">
            <div>
              <div className="font-bold text-text-primary text-[9px]">Fuse Metal Meltdown</div>
              <div className="text-[8px] text-text-muted">Breaks path through virtual fuse</div>
            </div>
            <button onClick={() => toggleFault('fuse-blown')}>
              {activeFaults['fuse-blown'] ? (
                <ToggleRight className="h-5 w-5 text-red-500" />
              ) : (
                <ToggleLeft className="h-5 w-5 text-text-muted" />
              )}
            </button>
          </div>

          {/* Relay stuck */}
          <div className="flex justify-between items-center bg-surface-850 px-2 py-1 rounded border border-border">
            <div>
              <div className="font-bold text-text-primary text-[9px]">Relay Contacts Stuck</div>
              <div className="text-[8px] text-text-muted">Forces contact to remain NC</div>
            </div>
            <button onClick={() => toggleFault('relay-stuck')}>
              {activeFaults['relay-stuck'] ? (
                <ToggleRight className="h-5 w-5 text-red-500" />
              ) : (
                <ToggleLeft className="h-5 w-5 text-text-muted" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Column 3: Sensor Anomaly & Wires Cuts */}
      <div className="border border-border rounded-lg bg-surface-950/40 p-2.5 flex flex-col gap-2">
        <h3 className="flex items-center gap-1.5 font-bold text-text-primary border-b border-border pb-1.5 mb-1 uppercase tracking-wider text-[10px]">
          <RefreshCw className="h-3.5 w-3.5 text-success-500" />
          Sensor & Wiring Breakages
        </h3>
        
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
          {/* DHT22 Failure */}
          <div className="flex justify-between items-center bg-surface-850 px-2 py-1 rounded border border-border">
            <div>
              <div className="font-bold text-text-primary text-[9px]">DHT22 Sensor Outage</div>
              <div className="text-[8px] text-text-muted">DHT returns error values</div>
            </div>
            <button onClick={() => toggleFault('dht22-failure')}>
              {activeFaults['dht22-failure'] ? (
                <ToggleRight className="h-5 w-5 text-red-500" />
              ) : (
                <ToggleLeft className="h-5 w-5 text-text-muted" />
              )}
            </button>
          </div>

          {/* LM35 Noise */}
          <div className="flex justify-between items-center bg-surface-850 px-2 py-1 rounded border border-border">
            <div>
              <div className="font-bold text-text-primary text-[9px]">LM35 Calibration Noise</div>
              <div className="text-[8px] text-text-muted">Adds random fluctuation to reading</div>
            </div>
            <button onClick={() => toggleFault('lm35-noise')}>
              {activeFaults['lm35-noise'] ? (
                <ToggleRight className="h-5 w-5 text-red-500" />
              ) : (
                <ToggleLeft className="h-5 w-5 text-text-muted" />
              )}
            </button>
          </div>

          {/* Wire Edge Breaker */}
          {edges.length === 0 ? (
            <div className="text-[8px] text-text-muted text-center py-4">No wire connections found to break.</div>
          ) : (
            <div className="border-t border-border pt-1.5">
              <div className="font-bold text-text-muted text-[8px] uppercase mb-1.5">Break Wire Connections:</div>
              <div className="max-h-[80px] overflow-y-auto space-y-1">
                {edges.map((edge) => {
                  const faultId = `wire-break-${edge.id}`
                  const label = `${edge.sourcePinId.toUpperCase()} ➔ ${edge.targetPinId.toUpperCase()}`
                  return (
                    <div key={edge.id} className="flex justify-between items-center bg-surface-800 px-1.5 py-0.5 rounded text-[8px]">
                      <span className="truncate max-w-[120px] font-mono text-text-secondary">{label}</span>
                      <button
                        onClick={() => toggleFault(faultId)}
                        className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                          activeFaults[faultId]
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : 'bg-surface-700 hover:bg-surface-650 text-text-secondary'
                        }`}
                      >
                        {activeFaults[faultId] ? 'CUT' : 'CONNECT'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
export default FaultInjectionPanel
