import type { ComponentType } from '@/types'

interface ComponentSVGProps {
  type: ComponentType
  width?: number
  height?: number
  className?: string
  color?: string
  selected?: boolean
  state?: any
  properties?: any
}

export function ComponentSVG({
  type,
  width,
  height,
  className = '',
  color,
  selected = false,
  state,
  properties,
}: ComponentSVGProps) {
  const stroke = selected ? '#60a5fa' : '#3f4756'
  const strokeWidth = selected ? 2 : 1

  const renderSVG = () => {
    switch (type) {
      case 'esp32-devkit':
        {
          const isL2Glowing = properties?.pinStates?.['2'] === 'HIGH' || properties?.pinStates?.['2'] === 1
          return (
            <g>
              <defs>
                <linearGradient id="esp32-pcb" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#232329" />
                  <stop offset="55%" stopColor="#17171b" />
                  <stop offset="100%" stopColor="#0d0d10" />
                </linearGradient>
                <linearGradient id="esp32-module" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#e8eaed" />
                  <stop offset="100%" stopColor="#c3c8d1" />
                </linearGradient>
                <radialGradient id="esp32-io2-glow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#7dd3fc" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#7dd3fc" stopOpacity="0" />
                </radialGradient>
                <filter id="esp32-shadow" x="-30%" y="-30%" width="160%" height="160%">
                  <feDropShadow dx="0" dy="1.5" stdDeviation="1.8" floodColor="#000" floodOpacity="0.45" />
                </filter>
              </defs>

              {/* Black PCB Board */}
              <rect x="2" y="2" width="116" height="196" rx="6" fill="url(#esp32-pcb)" stroke={stroke} strokeWidth={strokeWidth} filter="url(#esp32-shadow)" />

              {/* Copper corner mounting pads */}
              {[
                { cx: 8, cy: 8 }, { cx: 112, cy: 8 },
                { cx: 8, cy: 188 }, { cx: 112, cy: 188 }
              ].map((p, i) => (
                <g key={i}>
                  <circle cx={p.cx} cy={p.cy} r="4" fill="#c17a1f" />
                  <circle cx={p.cx} cy={p.cy} r="2" fill="#15151a" />
                </g>
              ))}

              {/* Silk-screen outlines */}
              <rect x="10" y="10" width="100" height="176" fill="none" stroke="#e2e8f0" strokeWidth="0.5" strokeDasharray="1,2" opacity="0.22" />

              {/* ESP32 WROOM Metal Module */}
              <rect x="23" y="20" width="70" height="60" rx="2" fill="url(#esp32-module)" stroke="#9aa0ab" strokeWidth="1" />
              <rect x="28" y="25" width="60" height="40" fill="#eef0f3" rx="1" />
              <text x="58" y="40" textAnchor="middle" fill="#4b5563" fontSize="6" fontWeight="600" fontFamily="ui-sans-serif, system-ui">ESP32-WROOM-32E</text>
              <text x="58" y="48" textAnchor="middle" fill="#6b7280" fontSize="5" fontFamily="ui-monospace, monospace">FCC ID: 2AC7Z-ESP32</text>

              {/* Copper Meandering Antenna */}
              <path d="M 28 20 L 28 12 L 34 12 L 34 18 L 40 18 L 40 12 L 46 12 L 46 18 L 52 18 L 52 12 L 58 12 L 58 18 L 64 18 L 64 12 L 70 12 L 70 18 L 76 18 L 76 12 L 82 12 L 82 18 L 88 18 L 88 10 L 92 10" fill="none" stroke="#c17a1f" strokeWidth="2.3" strokeLinecap="round" />

              {/* Micro USB Port */}
              <rect x="43" y="172" width="30" height="25" rx="2" fill="#a8adb6" stroke="#6b7280" />
              <rect x="47" y="182" width="22" height="15" fill="#2b303a" />

              {/* Boot & EN buttons */}
              <rect x="18" y="155" width="12" height="12" rx="1" fill="#2f3542" />
              <circle cx="24" cy="161" r="3.5" fill="#181c24" />
              <text x="24" y="174" textAnchor="middle" fill="#9ca3af" fontSize="5" fontFamily="ui-monospace, monospace">EN</text>

              <rect x="86" y="155" width="12" height="12" rx="1" fill="#2f3542" />
              <circle cx="92" cy="161" r="3.5" fill="#181c24" />
              <text x="92" y="174" textAnchor="middle" fill="#9ca3af" fontSize="5" fontFamily="ui-monospace, monospace">BOOT</text>

              {/* Status LEDs */}
              <circle cx="45" cy="148" r="2.5" fill="#ef4444" opacity="0.35" />
              <circle cx="45" cy="148" r="1.5" fill="#f87171" />
              <text x="45" y="156" textAnchor="middle" fill="#6b7280" fontSize="4">PWR</text>

              <circle cx="71" cy="148" r="2.5" fill={isL2Glowing ? '#38bdf8' : '#1e3a5f'} />
              {isL2Glowing && <circle cx="71" cy="148" r="7" fill="url(#esp32-io2-glow)" className="animate-pulse" />}
              <text x="71" y="156" textAnchor="middle" fill="#6b7280" fontSize="4">IO2</text>

              {/* Header pins */}
              {Array.from({ length: 15 }).map((_, i) => {
                const y = 88 + i * 8.5
                return (
                  <g key={i}>
                    <rect x="8" y={y - 3} width="10" height="6.5" rx="0.5" fill="#181c24" />
                    <rect x="98" y={y - 3} width="10" height="6.5" rx="0.5" fill="#181c24" />
                    <circle cx="13" cy={y} r="1.5" fill="#d6dbe3" stroke="#8b91a0" strokeWidth="0.5" />
                    <circle cx="103" cy={y} r="1.5" fill="#d6dbe3" stroke="#8b91a0" strokeWidth="0.5" />
                  </g>
                )
              })}

              {/* Core CP2102 chip */}
              <rect x="46" y="105" width="24" height="24" rx="1" fill="#1a1e27" stroke="#333844" />
              <text x="58" y="119" textAnchor="middle" fill="#9ca3af" fontSize="5" fontFamily="ui-monospace, monospace">SILABS</text>
            </g>
          )
        }

      case 'arduino-uno':
        {
          const isPwrGlowing = properties?.simulationStatus === 'running'
          return (
            <g>
              <defs>
                <linearGradient id="uno-pcb" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#00707f" />
                  <stop offset="60%" stopColor="#005865" />
                  <stop offset="100%" stopColor="#00434d" />
                </linearGradient>
                <radialGradient id="uno-pwr-glow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#4ade80" stopOpacity="0.85" />
                  <stop offset="100%" stopColor="#4ade80" stopOpacity="0" />
                </radialGradient>
                <filter id="uno-shadow" x="-30%" y="-30%" width="160%" height="160%">
                  <feDropShadow dx="0" dy="1.5" stdDeviation="1.8" floodColor="#000" floodOpacity="0.4" />
                </filter>
              </defs>

              {/* Turquoise Blue PCB */}
              <rect x="2" y="2" width="136" height="176" rx="10" fill="url(#uno-pcb)" stroke={stroke} strokeWidth={strokeWidth} filter="url(#uno-shadow)" />

              {/* mounting holes */}
              {[
                { cx: 16, cy: 40 }, { cx: 120, cy: 15 },
                { cx: 124, cy: 110 }, { cx: 16, cy: 160 }
              ].map((p, i) => (
                <g key={i}>
                  <circle cx={p.cx} cy={p.cy} r="6" fill="#d3dae2" stroke="#8f98a3" />
                  <circle cx={p.cx} cy={p.cy} r="3" fill="#15151a" />
                </g>
              ))}

              <rect x="8" y="8" width="120" height="160" fill="none" stroke="#00c2cc" strokeWidth="1.1" rx="6" opacity="0.3" />

              {/* USB Type-B */}
              <rect x="6" y="-6" width="32" height="42" rx="2" fill="#e7ebf0" stroke="#8f98a3" strokeWidth="1" />
              <rect x="12" y="-6" width="20" height="15" fill="#9aa1ab" />

              {/* DC Power Jack */}
              <rect x="94" y="-8" width="28" height="48" rx="3" fill="#151519" stroke="#2b303a" />
              <circle cx="108" cy="16" r="5" fill="#2b303a" />

              {/* ATmega328P */}
              <rect x="42" y="58" width="86" height="28" fill="#1a2130" rx="2" stroke="#2b303a" />
              <rect x="45" y="61" width="80" height="22" fill="#0d1017" rx="1" />
              <path d="M 45 68 Q 48 72 45 76" fill="none" stroke="#4b5563" strokeWidth="1.5" />
              <text x="85" y="75" textAnchor="middle" fill="#9ca3af" fontSize="7" fontWeight="600" fontFamily="ui-monospace, monospace">ATMEGA328P-PU</text>

              {/* Crystal */}
              <rect x="85" y="32" width="20" height="10" rx="4" fill="#d3dae2" stroke="#8f98a3" />
              <text x="95" y="39" textAnchor="middle" fill="#6b7280" fontSize="5" fontFamily="ui-monospace, monospace">16.000</text>

              {/* Reset button */}
              <rect x="12" y="146" width="14" height="14" rx="2" fill="#d3dae2" stroke="#8f98a3" />
              <circle cx="19" cy="153" r="4.5" fill="#ef4444" stroke="#a3222b" strokeWidth="0.5" />
              <text x="19" y="168" textAnchor="middle" fill="#00c2cc" fontSize="5" fontWeight="600">RESET</text>

              {/* Header sockets */}
              <rect x="4" y="20" width="9" height="112" rx="1" fill="#181c24" />
              <rect x="123" y="20" width="9" height="112" rx="1" fill="#181c24" />
              {Array.from({ length: 14 }).map((_, i) => {
                const y = 24 + i * 8
                return (
                  <g key={i}>
                    <rect x="6.5" y={y - 2} width="4" height="4" fill="#d6dbe3" rx="0.5" />
                    <rect x="125.5" y={y - 2} width="4" height="4" fill="#d6dbe3" rx="0.5" />
                  </g>
                )
              })}

              {/* Power LED */}
              <circle cx="48" cy="38" r="2" fill={isPwrGlowing ? '#22c55e' : '#0a3a26'} />
              {isPwrGlowing && <circle cx="48" cy="38" r="6" fill="url(#uno-pwr-glow)" className="animate-pulse" />}
              <text x="48" y="46" textAnchor="middle" fill="#00c2cc" fontSize="5">ON</text>

              <circle cx="68" cy="38" r="1.5" fill="#eab308" opacity="0.3" />
              <circle cx="78" cy="38" r="1.5" fill="#eab308" opacity="0.3" />
              <text x="68" y="46" textAnchor="middle" fill="#00c2cc" fontSize="4">TX</text>
              <text x="78" y="46" textAnchor="middle" fill="#00c2cc" fontSize="4">RX</text>

              <text x="75" y="148" textAnchor="middle" fill="#00c2cc" fontSize="11" fontWeight="800" fontFamily="ui-sans-serif, system-ui">UNO R3</text>
            </g>
          )
        }

      case 'power-supply-5v':
        return (
          <g>
            <defs>
              <linearGradient id="psu5-body" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#425065" />
                <stop offset="100%" stopColor="#2b3648" />
              </linearGradient>
            </defs>
            <rect x="2" y="2" width="76" height="56" rx="4" fill="url(#psu5-body)" stroke={stroke} strokeWidth={strokeWidth} />
            <rect x="15" y="15" width="46" height="26" rx="2" fill="#0a0e17" />
            <text x="38" y="32" textAnchor="middle" fill="#4ade80" fontSize="12" fontWeight="700" fontFamily="ui-monospace, monospace">5.00V</text>
            <circle cx="38" cy="46" r="3" fill="#4ade80" className="animate-pulse" />
          </g>
        )

      case 'battery-9v':
        return (
          <g>
            <defs>
              <linearGradient id="batt9-cap" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#293241" />
                <stop offset="100%" stopColor="#181d29" />
              </linearGradient>
              <linearGradient id="batt9-body" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f6ab2f" />
                <stop offset="100%" stopColor="#e08b0d" />
              </linearGradient>
            </defs>
            <rect x="2" y="2" width="56" height="96" rx="6" fill="url(#batt9-cap)" stroke={stroke} strokeWidth={strokeWidth} />
            <circle cx="15" cy="12" r="6" fill="#d3dae2" stroke="#525a68" />
            <circle cx="41" cy="12" r="7" fill="#d3dae2" stroke="#525a68" strokeDasharray="2,2" />
            <text x="15" y="15" textAnchor="middle" fill="#ef4444" fontSize="8" fontWeight="700">+</text>
            <text x="41" y="15" textAnchor="middle" fill="#3b82f6" fontSize="8" fontWeight="700">-</text>
            <rect x="2" y="30" width="56" height="40" fill="url(#batt9-body)" />
            <text x="30" y="55" textAnchor="middle" fill="#1e293b" fontSize="14" fontWeight="800">9V</text>
            <text x="30" y="85" textAnchor="middle" fill="#5b6472" fontSize="8">ALKALINE</text>
          </g>
        )

      case 'battery-12v':
        return (
          <g>
            <defs>
              <linearGradient id="batt12-body" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#171d2b" />
                <stop offset="100%" stopColor="#0a0e17" />
              </linearGradient>
            </defs>
            <rect x="2" y="2" width="76" height="56" rx="4" fill="url(#batt12-body)" stroke={stroke} strokeWidth={strokeWidth} />
            <rect x="10" y="10" width="15" height="10" fill="#ef4444" rx="1" />
            <rect x="51" y="10" width="15" height="10" fill="#3b82f6" rx="1" />
            <text x="175" y="15" fill="#fff" fontSize="6">+</text>
            <text x="38" y="36" textAnchor="middle" fill="#d6dbe3" fontSize="14" fontWeight="700">12V</text>
            <text x="38" y="48" textAnchor="middle" fill="#5b6472" fontSize="6">LEAD-ACID</text>
          </g>
        )

      case 'ground':
        return (
          <g>
            <line x1="20" y1="5" x2="20" y2="20" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" />
            <line x1="5" y1="20" x2="35" y2="20" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" />
            <line x1="10" y1="28" x2="30" y2="28" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" />
            <line x1="15" y1="36" x2="25" y2="36" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" />
          </g>
        )

      case 'lm7805':
        return (
          <g>
            <defs>
              <linearGradient id="lm7805-tab" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#5a6579" />
                <stop offset="100%" stopColor="#3b4354" />
              </linearGradient>
            </defs>
            <rect x="15" y="2" width="30" height="20" rx="1" fill="url(#lm7805-tab)" stroke="#293241" />
            <circle cx="30" cy="10" r="4" fill="#0a0e17" />
            <rect x="5" y="20" width="50" height="40" rx="2" fill="#181c24" stroke={stroke} strokeWidth={strokeWidth} />
            <text x="30" y="42" textAnchor="middle" fill="#d6dbe3" fontSize="10" fontWeight="700" fontFamily="ui-monospace, monospace">LM7805</text>
            <line x1="15" y1="60" x2="15" y2="78" stroke="#a3a9b5" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="30" y1="60" x2="30" y2="78" stroke="#a3a9b5" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="45" y1="60" x2="45" y2="78" stroke="#a3a9b5" strokeWidth="2.5" strokeLinecap="round" />
          </g>
        )

      case 'usb-breakout':
        return (
          <g>
            <defs>
              <linearGradient id="usbb-body" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0e9668" />
                <stop offset="100%" stopColor="#04654a" />
              </linearGradient>
            </defs>
            <rect x="2" y="2" width="56" height="36" rx="4" fill="url(#usbb-body)" stroke={stroke} strokeWidth={strokeWidth} />
            <rect x="10" y="8" width="20" height="20" rx="1" fill="#a3a9b5" stroke="#525a68" />
            <rect x="42" y="5" width="10" height="26" fill="#054a37" rx="1" />
            <text x="47" y="14" textAnchor="middle" fill="#a7f3d0" fontSize="5" fontWeight="700">V</text>
            <text x="47" y="21" textAnchor="middle" fill="#a7f3d0" fontSize="5" fontWeight="700">D-</text>
            <text x="47" y="27" textAnchor="middle" fill="#a7f3d0" fontSize="5" fontWeight="700">D+</text>
            <text x="47" y="33" textAnchor="middle" fill="#a7f3d0" fontSize="5" fontWeight="700">G</text>
          </g>
        )

      case 'dc-jack':
        return (
          <g>
            <rect x="2" y="2" width="56" height="36" rx="4" fill="#181c24" stroke={stroke} strokeWidth={strokeWidth} />
            <rect x="10" y="8" width="30" height="20" rx="1" fill="#0a0e17" stroke="#525a68" />
            <circle cx="20" cy="18" r="4" fill="#525a68" />
            <text x="48" y="18" fill="#ef4444" fontSize="8" fontWeight="700">+</text>
            <text x="48" y="32" fill="#3b82f6" fontSize="8" fontWeight="700">-</text>
          </g>
        )

      case 'battery-snap-9v':
        return (
          <g>
            <rect x="2" y="2" width="56" height="36" rx="6" fill="#181c24" stroke={stroke} strokeWidth={strokeWidth} />
            <circle cx="20" cy="18" r="6" fill="#7d8494" />
            <circle cx="36" cy="18" r="5" fill="#7d8494" stroke="#e4e4e7" strokeDasharray="1,1" />
            <line x1="45" y1="15" x2="55" y2="15" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
            <line x1="45" y1="25" x2="55" y2="25" stroke="#0a0e17" strokeWidth="2" strokeLinecap="round" />
          </g>
        )

      case 'battery-18650':
        return (
          <g>
            <defs>
              <linearGradient id="b18650-body" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1a9151" />
                <stop offset="100%" stopColor="#136339" />
              </linearGradient>
            </defs>
            <rect x="2" y="2" width="76" height="26" rx="13" fill="url(#b18650-body)" stroke={stroke} strokeWidth={strokeWidth} />
            <rect x="74" y="6" width="4" height="14" rx="2" fill="#fbbf24" />
            <text x="38" y="17" textAnchor="middle" fill="#bbf7d0" fontSize="10" fontWeight="700" fontFamily="ui-monospace, monospace">18650 3.7V</text>
          </g>
        )

      case 'holder-18650':
        return (
          <g>
            <rect x="2" y="2" width="76" height="36" rx="4" fill="#080b12" stroke={stroke} strokeWidth={strokeWidth} />
            <path d="M6,10 C6,26 12,26 12,10 M12,10 C12,26 18,26 18,10" fill="none" stroke="#a3a9b5" strokeWidth="2" />
            <rect x="68" y="10" width="4" height="16" rx="1" fill="#f59e0b" />
            <text x="40" y="22" textAnchor="middle" fill="#525a68" fontSize="8" fontWeight="700">18650 HOLDER</text>
          </g>
        )

      case 'ups-module-5v':
        return (
          <g>
            <defs>
              <linearGradient id="ups5-body" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#1e4bab" />
                <stop offset="100%" stopColor="#152f6e" />
              </linearGradient>
            </defs>
            <rect x="2" y="2" width="76" height="46" rx="4" fill="url(#ups5-body)" stroke={stroke} strokeWidth={strokeWidth} />
            <rect x="25" y="10" width="16" height="16" rx="2" fill="#0d1017" />
            <circle cx="33" cy="18" r="6" fill="#f59e0b" fillOpacity="0.2" stroke="#f59e0b" strokeWidth="1" />
            <rect x="52" y="12" width="18" height="10" rx="1" fill="#a3a9b5" />
            <text x="40" y="40" textAnchor="middle" fill="#93c5fd" fontSize="7" fontWeight="700" fontFamily="ui-monospace, monospace">5V UPS BACKUP</text>
          </g>
        )

      case 'terminal-strip-4':
        return (
          <g>
            <rect x="2" y="2" width="76" height="26" rx="2" fill="#181c24" stroke={stroke} strokeWidth={strokeWidth} />
            {Array.from({ length: 4 }).map((_, i) => (
              <g key={i}>
                <circle cx={10 + i * 20} cy={13} r="6" fill="#525a68" stroke="#a3a9b5" />
                <line x1={7 + i * 20} y1={13} x2={13 + i * 20} y2={13} stroke="#181c24" strokeWidth="2" />
              </g>
            ))}
          </g>
        )

      case 'terminal-strip-8':
        return (
          <g>
            <rect x="2" y="2" width="156" height="26" rx="2" fill="#181c24" stroke={stroke} strokeWidth={strokeWidth} />
            {Array.from({ length: 8 }).map((_, i) => (
              <g key={i}>
                <circle cx={10 + i * 20} cy={13} r="6" fill="#525a68" stroke="#a3a9b5" />
                <line x1={7 + i * 20} y1={13} x2={13 + i * 20} y2={13} stroke="#181c24" strokeWidth="2" />
              </g>
            ))}
          </g>
        )

      case 'toggle-switch-spst':
      case 'slide-switch-spst':
        {
          const isActive = state === true || state === 'true'
          const knobX = isActive ? 34 : 16
          return (
            <g>
              <rect x="2" y="2" width="46" height="26" rx="13" fill="#2b303a" stroke={stroke} strokeWidth={strokeWidth} />
              <rect x="8" y="10" width="30" height="10" rx="5" fill="#14161c" />
              <circle cx={knobX} cy={15} r="7" fill={isActive ? '#10b981' : '#8b91a0'} stroke="#ffffff" strokeWidth={1} />
            </g>
          )
        }

      case 'toggle-switch-spdt':
      case 'slide-switch-spdt':
        {
          const isNC = state === 'nc'
          const knobX = isNC ? 34 : 16
          return (
            <g>
              <rect x="2" y="2" width="46" height="26" rx="13" fill="#2b303a" stroke={stroke} strokeWidth={strokeWidth} />
              <rect x="8" y="10" width="30" height="10" rx="5" fill="#14161c" />
              <circle cx={knobX} cy={15} r="7" fill="#3b82f6" stroke="#ffffff" strokeWidth={1} />
            </g>
          )
        }

      case 'toggle-switch-dpdt':
      case 'slide-switch-dpdt':
        {
          const isNC = state === 'nc'
          const knobX = isNC ? 42 : 18
          return (
            <g>
              <rect x="2" y="2" width="56" height="36" rx="6" fill="#2b303a" stroke={stroke} strokeWidth={strokeWidth} />
              <rect x="10" y="13" width="36" height="10" rx="5" fill="#14161c" />
              <rect x={knobX - 6} y={8} width="12" height="20" rx="2" fill="#a855f7" stroke="#ffffff" strokeWidth={1} />
            </g>
          )
        }

      case 'dip-switch-2':
        {
          const dipState = (state as Record<string, boolean>) || {}
          return (
            <g>
              <rect x="2" y="2" width="36" height="46" rx="4" fill="#1a4bc4" stroke={stroke} strokeWidth={strokeWidth} />
              {Array.from({ length: 2 }).map((_, i) => {
                const switchActive = dipState[`s${i+1}`]
                return (
                  <g key={i}>
                    <rect x={8 + i * 16} y={8} width="8" height="30" rx="1" fill="#132f7a" />
                    <rect x={8 + i * 16} y={switchActive ? 8 : 24} width="8" height="14" rx="1" fill="#ffffff" />
                  </g>
                )
              })}
            </g>
          )
        }

      case 'dip-switch-4':
        {
          const dipState = (state as Record<string, boolean>) || {}
          return (
            <g>
              <rect x="2" y="2" width="56" height="46" rx="4" fill="#1a4bc4" stroke={stroke} strokeWidth={strokeWidth} />
              {Array.from({ length: 4 }).map((_, i) => {
                const switchActive = dipState[`s${i+1}`]
                return (
                  <g key={i}>
                    <rect x={8 + i * 12} y={8} width="8" height="30" rx="1" fill="#132f7a" />
                    <rect x={8 + i * 12} y={switchActive ? 8 : 24} width="8" height="14" rx="1" fill="#ffffff" />
                  </g>
                )
              })}
            </g>
          )
        }

      case 'dip-switch-8':
        {
          const dipState = (state as Record<string, boolean>) || {}
          return (
            <g>
              <rect x="2" y="2" width="106" height="46" rx="4" fill="#1a4bc4" stroke={stroke} strokeWidth={strokeWidth} />
              {Array.from({ length: 8 }).map((_, i) => {
                const switchActive = dipState[`s${i+1}`]
                return (
                  <g key={i}>
                    <rect x={8 + i * 12} y={8} width="8" height="30" rx="1" fill="#132f7a" />
                    <rect x={8 + i * 12} y={switchActive ? 8 : 24} width="8" height="14" rx="1" fill="#ffffff" />
                  </g>
                )
              })}
            </g>
          )
        }

      case 'led':
        {
          const brightness = properties?.brightness ?? 0
          const baseColor = color ?? '#ef4444'
          const isLit = brightness > 0

          return (
            <g>
              <defs>
                <radialGradient id="led-bloom" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor={baseColor} stopOpacity={0.55 * brightness} />
                  <stop offset="100%" stopColor={baseColor} stopOpacity="0" />
                </radialGradient>
              </defs>

              <rect x="12" y="24" width="2" height="14" fill="#d6dbe3" />
              <rect x="16" y="24" width="2" height="14" fill="#a3a9b5" />

              <rect x="7" y="21" width="16" height="4" rx="1" fill="#181c24" />
              <circle cx="15" cy="15" r="10.5" fill="none" stroke="#293241" strokeWidth="1.5" />

              <g opacity={isLit ? 0.3 : 0.8}>
                <path d="M 13 22 L 13 14 L 14.5 14" stroke="#a3a9b5" strokeWidth="0.8" fill="none" />
                <path d="M 17 22 L 17 12 L 15.5 12" stroke="#a3a9b5" strokeWidth="1.2" fill="none" />
              </g>

              <circle
                cx="15"
                cy="15"
                r="10"
                fill={baseColor}
                fillOpacity={isLit ? 0.78 : 0.22}
                stroke={isLit ? baseColor : '#4b5563'}
                strokeWidth="0.5"
              />

              {isLit && (
                <g>
                  <circle cx="15" cy="15" r="16" fill="url(#led-bloom)" className="animate-pulse" />
                  <circle
                    cx="15"
                    cy="15"
                    r="5"
                    fill="#ffffff"
                    fillOpacity={0.9 * brightness}
                    style={{ filter: 'blur(0.5px)' }}
                  />
                </g>
              )}

              <circle cx="11.5" cy="11.5" r="2.2" fill="#ffffff" fillOpacity={isLit ? 0.9 : 0.4} />
            </g>
          )
        }

      case 'rgb-led':
        {
          const colorMix = properties?.colorMix ?? 'rgb(55, 65, 81)'
          const isGlowing = colorMix !== 'rgb(0, 0, 0)' && colorMix !== 'rgb(55, 65, 81)'
          return (
            <g>
              <circle cx="25" cy="15" r="12" fill="#2b303a" stroke={stroke} strokeWidth={strokeWidth} />
              <circle cx="25" cy="15" r="8" fill={colorMix} />
              {isGlowing && (
                <circle cx="25" cy="15" r="12" fill={colorMix} opacity={0.35} style={{ filter: 'blur(2.5px)' }} />
              )}
              {Array.from({ length: 4 }).map((_, i) => (
                <rect key={i} x={10 + i * 10} y={27} width="2.5" height="12" fill="#a3a9b5" />
              ))}
            </g>
          )
        }

      case 'bulb':
        {
          const brightness = properties?.brightness ?? 0
          return (
            <g>
              <circle cx="25" cy="22" r="16" fill="#181c24" stroke={stroke} strokeWidth={strokeWidth} />
              <circle cx="25" cy="22" r="16" fill="#fef3c7" opacity={0.18 + brightness * 0.8} />
              {brightness > 0.05 && (
                <circle cx="25" cy="22" r="20" fill="#fbbf24" opacity={brightness * 0.3} style={{ filter: 'blur(3.5px)' }} />
              )}
              <path d="M18,38 L22,48 L28,48 L32,38" fill="none" stroke="#a3a9b5" strokeWidth="1.5" />
              <line x1="20" y1="48" x2="30" y2="48" stroke="#7d8494" strokeWidth="2" />
            </g>
          )
        }

      case 'lcd1602':
        {
          const backlight = properties?.backlight !== false
          const displayBuffer = (properties?.displayBuffer as string[][]) || [
            [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '],
            [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '],
          ]
          const line1 = displayBuffer[0]?.join('') || ''
          const line2 = displayBuffer[1]?.join('') || ''

          return (
            <g>
              <defs>
                <linearGradient id="lcd-body" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1e4bab" />
                  <stop offset="100%" stopColor="#132f7a" />
                </linearGradient>
              </defs>
              <rect x="2" y="2" width="156" height="76" rx="4" fill="url(#lcd-body)" stroke={stroke} strokeWidth={strokeWidth} />
              <rect
                x="12"
                y="12"
                width="132"
                height="42"
                rx="2"
                fill={backlight ? '#0f6478' : '#0a0e17'}
                stroke="#293241"
              />
              <text x="18" y="28" fill={backlight ? '#22d3ee' : '#1e293b'} fontSize="7" fontFamily="ui-monospace, monospace" style={{ whiteSpace: 'pre' }}>{line1}</text>
              <text x="18" y="44" fill={backlight ? '#22d3ee' : '#1e293b'} fontSize="7" fontFamily="ui-monospace, monospace" style={{ whiteSpace: 'pre' }}>{line2}</text>
            </g>
          )
        }

      case 'oled':
        {
          const displayLines = (properties?.displayLines as string[]) || []
          return (
            <g>
              <rect x="2" y="2" width="76" height="46" rx="4" fill="#0a0e17" stroke={stroke} strokeWidth={strokeWidth} />
              <rect x="8" y="8" width="60" height="26" fill="#020617" stroke="#181c24" />
              {displayLines.length === 0 ? (
                <>
                  <text x="12" y="16" fill="#38bdf8" fontSize="4.5" fontFamily="ui-monospace, monospace">OLED Screen</text>
                  <text x="12" y="24" fill="#525a68" fontSize="4" fontFamily="ui-monospace, monospace">Awaiting data...</text>
                </>
              ) : (
                displayLines.slice(0, 4).map((line, idx) => (
                  <text
                    key={idx}
                    x="11"
                    y={14 + idx * 5.5}
                    fill="#38bdf8"
                    fontSize="4"
                    fontFamily="ui-monospace, monospace"
                    style={{ whiteSpace: 'pre' }}
                  >
                    {line}
                  </text>
                ))
              )}
            </g>
          )
        }

      case 'buzzer':
        {
          const isActive = properties?.isActive === true
          return (
            <g>
              <defs>
                <radialGradient id="buzzer-glow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
                </radialGradient>
              </defs>
              {isActive && (
                <g>
                  {/* Glowing background */}
                  <circle cx="20" cy="20" r="28" fill="url(#buzzer-glow)" className="animate-pulse" />
                  
                  {/* Sound waves/pulses */}
                  <circle cx="20" cy="20" r="22" fill="none" stroke="#fbbf24" strokeWidth="0.8" opacity="0.3" strokeDasharray="3,3" className="animate-spin" style={{ animationDuration: '6s' }} />
                  <circle cx="20" cy="20" r="25" fill="none" stroke="#fbbf24" strokeWidth="0.6" opacity="0.2" strokeDasharray="2,4" className="animate-spin" style={{ animationDuration: '10s', animationDirection: 'reverse' }} />
                  
                  {/* Sound wave arcs */}
                  <path d="M 4 20 A 16 16 0 0 1 8 10" fill="none" stroke="#fbbf24" strokeWidth="1.2" strokeLinecap="round" className="animate-bounce" />
                  <path d="M 36 20 A 16 16 0 0 0 32 10" fill="none" stroke="#fbbf24" strokeWidth="1.2" strokeLinecap="round" className="animate-bounce" />
                </g>
              )}
              <circle cx="20" cy="20" r="16" fill="#181c24" stroke={isActive ? '#fbbf24' : stroke} strokeWidth={isActive ? 1.5 : strokeWidth} />
              <circle cx="20" cy="20" r="8" fill="none" stroke={isActive ? '#fbbf24' : '#3f4756'} strokeWidth="1" />
              <circle cx="20" cy="20" r="3" fill={isActive ? '#fbbf24' : '#3f4756'} />
            </g>
          )
        }

      case 'pc-fan':
        {
          const speed = properties?.speed ?? 0
          const animStyle = speed > 0.1 ? {
            transformOrigin: '38px 38px',
            animation: `spin linear infinite`,
            animationDuration: `${Math.max(0.04, 3.0 - (speed / 3200) * 2.9)}s`
          } : undefined

          return (
            <g>
              <rect x="2" y="2" width="76" height="76" rx="6" fill="#080b12" stroke={stroke} strokeWidth={strokeWidth} />
              <circle cx="38" cy="38" r="28" fill="#181c24" stroke="#293241" />
              <g style={animStyle}>
                {[0, 1, 2, 3].map((i) => (
                  <ellipse
                    key={i}
                    cx="38"
                    cy="38"
                    rx="24"
                    ry="8"
                    fill="#4b5563"
                    opacity="0.75"
                    transform={`rotate(${i * 45} 38 38)`}
                  />
                ))}
              </g>
              <circle cx="38" cy="38" r="6" fill="#181c24" />
            </g>
          )
        }

      case 'dc-motor':
        {
          const speed = properties?.speed ?? 0
          const animStyle = Math.abs(speed) > 0.1 ? {
            transformOrigin: '35px 35px',
            animation: `spin linear infinite`,
            animationDuration: `${Math.max(0.05, 3.0 - (Math.abs(speed) / 5000) * 2.95)}s`,
            animationDirection: speed < 0 ? 'reverse' : ('normal' as any)
          } : undefined

          return (
            <g>
              <defs>
                <radialGradient id="motor-body" cx="35%" cy="35%" r="75%">
                  <stop offset="0%" stopColor="#6b7385" />
                  <stop offset="100%" stopColor="#3f4756" />
                </radialGradient>
              </defs>
              <circle cx="35" cy="35" r="28" fill="url(#motor-body)" stroke={stroke} strokeWidth={strokeWidth} />
              <g style={animStyle}>
                <circle cx="35" cy="35" r="8" fill="#181c24" />
                <line x1="35" y1="15" x2="35" y2="55" stroke="#293241" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="15" y1="35" x2="55" y2="35" stroke="#293241" strokeWidth="2.5" strokeLinecap="round" />
              </g>
            </g>
          )
        }

      case 'push-button':
        return (
          <g>
            <rect x="2" y="2" width="36" height="36" rx="4" fill="#2f3542" stroke={stroke} strokeWidth={strokeWidth} />
            <circle cx="18" cy="18" r="10" fill="#ef4444" stroke="#a3222b" strokeWidth="1.5" />
          </g>
        )

      case 'potentiometer':
        return (
          <g>
            <defs>
              <radialGradient id="pot-body" cx="35%" cy="35%" r="75%">
                <stop offset="0%" stopColor="#4b5563" />
                <stop offset="100%" stopColor="#293241" />
              </radialGradient>
            </defs>
            <circle cx="25" cy="25" r="20" fill="url(#pot-body)" stroke={stroke} strokeWidth={strokeWidth} />
            <circle cx="25" cy="25" r="6" fill="#181c24" />
            <line x1="25" y1="25" x2="25" y2="10" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" />
          </g>
        )

      case 'resistor':
        return (
          <g>
            <line x1="0" y1="10" x2="8" y2="10" stroke="#a3a9b5" strokeWidth="2" strokeLinecap="round" />
            <rect x="8" y="4" width="44" height="12" rx="3" fill="#d9ae7e" />
            <rect x="16" y="4" width="4" height="12" fill="#78350f" />
            <rect x="24" y="4" width="4" height="12" fill="#78350f" />
            <rect x="32" y="4" width="4" height="12" fill="#b91c1c" />
            <rect x="40" y="4" width="4" height="12" fill="#f59e0b" />
            <line x1="52" y1="10" x2="60" y2="10" stroke="#a3a9b5" strokeWidth="2" strokeLinecap="round" />
          </g>
        )

      case 'diode-1n4007':
      case 'schottky-diode':
        return (
          <g>
            <line x1="0" y1="10" x2="18" y2="10" stroke="#a3a9b5" strokeWidth="2" strokeLinecap="round" />
            <polygon points="18,4 18,16 30,10" fill="#181c24" />
            <line x1="30" y1="4" x2="30" y2="16" stroke="#d6dbe3" strokeWidth="2" />
            <line x1="30" y1="10" x2="50" y2="10" stroke="#a3a9b5" strokeWidth="2" strokeLinecap="round" />
          </g>
        )

      case 'n-mosfet':
      case 'p-mosfet':
        return (
          <g>
            <rect x="10" y="4" width="30" height="40" rx="2" fill="#181c24" stroke={stroke} strokeWidth={strokeWidth} />
            <rect x="15" y="8" width="20" height="6" fill="#4b5563" />
            <text x="25" y="30" textAnchor="middle" fill="#e2e8f0" fontSize="10" fontWeight="700" fontFamily="ui-monospace, monospace">
              {type === 'n-mosfet' ? 'N-FET' : 'P-FET'}
            </text>
          </g>
        )

      case 'relay':
        return (
          <g>
            <defs>
              <linearGradient id="relay-body" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#1e4bab" />
                <stop offset="100%" stopColor="#132f7a" />
              </linearGradient>
            </defs>
            <rect x="4" y="4" width="52" height="72" rx="4" fill="url(#relay-body)" stroke={stroke} strokeWidth={strokeWidth} />
            <rect x="10" y="10" width="40" height="24" rx="2" fill="#181c24" />
            <text x="30" y="24" textAnchor="middle" fill="#60a5fa" fontSize="8" fontWeight="700" fontFamily="ui-monospace, monospace">5V RELAY</text>
            <circle cx="30" cy="50" r="10" fill="#181c24" />
          </g>
        )

      case 'fuse':
        return (
          <g>
            <line x1="0" y1="10" x2="10" y2="10" stroke="#a3a9b5" strokeWidth="2" strokeLinecap="round" />
            <rect x="10" y="5" width="30" height="10" rx="2" fill="#fef3c7" stroke="#f59e0b" strokeWidth="1" />
            <line x1="12" y1="10" x2="38" y2="10" stroke="#b45309" strokeWidth="1" />
            <line x1="40" y1="10" x2="50" y2="10" stroke="#a3a9b5" strokeWidth="2" strokeLinecap="round" />
          </g>
        )

      case 'capacitor':
      case 'ceramic-capacitor':
        return (
          <g>
            <line x1="0" y1="10" x2="12" y2="10" stroke="#a3a9b5" strokeWidth="2" strokeLinecap="round" />
            <line x1="12" y1="4" x2="12" y2="16" stroke="#7d8494" strokeWidth="2" />
            <line x1="18" y1="4" x2="18" y2="16" stroke="#7d8494" strokeWidth="2" />
            <line x1="18" y1="10" x2="30" y2="10" stroke="#a3a9b5" strokeWidth="2" strokeLinecap="round" />
          </g>
        )

      case 'electrolytic-capacitor':
        return (
          <g>
            <defs>
              <linearGradient id="elcap-body" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#1a7fc4" />
                <stop offset="100%" stopColor="#0c5389" />
              </linearGradient>
            </defs>
            <rect x="8" y="4" width="14" height="42" rx="2" fill="url(#elcap-body)" stroke={stroke} strokeWidth={strokeWidth} />
            <line x1="8" y1="15" x2="4" y2="15" stroke="#a3a9b5" strokeWidth="2" />
            <line x1="22" y1="15" x2="26" y2="15" stroke="#a3a9b5" strokeWidth="2" />
            <text x="15" y="28" textAnchor="middle" fill="#fff" fontSize="6">+</text>
          </g>
        )

      case 'super-capacitor':
        return (
          <g>
            <rect x="6" y="6" width="18" height="38" rx="2" fill="#6d28d9" stroke={stroke} strokeWidth={strokeWidth} />
            <rect x="26" y="6" width="18" height="38" rx="2" fill="#4c1d95" stroke={stroke} strokeWidth={strokeWidth} />
          </g>
        )

      case 'terminal-block':
        return (
          <g>
            <rect x="4" y="4" width="32" height="42" rx="2" fill="#14803e" stroke={stroke} strokeWidth={strokeWidth} />
            <circle cx="12" cy="18" r="5" fill="#181c24" stroke="#d6dbe3" />
            <circle cx="28" cy="18" r="5" fill="#181c24" stroke="#d6dbe3" />
          </g>
        )

      case 'jumper-wire':
        return (
          <g>
            <line x1="0" y1="5" x2="80" y2="5" stroke={color ?? '#ef4444'} strokeWidth="3" strokeLinecap="round" />
            <circle cx="0" cy="5" r="3" fill={color ?? '#ef4444'} />
            <circle cx="80" cy="5" r="3" fill={color ?? '#ef4444'} />
          </g>
        )

      case 'ds18b20':
        return (
          <g>
            <rect x="14" y="4" width="12" height="32" rx="6" fill="#181c24" stroke={stroke} strokeWidth={strokeWidth} />
            <text x="20" y="26" textAnchor="middle" fill="#525a68" fontSize="5">DS</text>
          </g>
        )

      default:
        return (
          <rect x="4" y="4" width="52" height="52" rx="4" fill="#1a1e27" stroke={stroke} strokeWidth={strokeWidth} />
        )
    }
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {renderSVG()}
    </svg>
  )
}