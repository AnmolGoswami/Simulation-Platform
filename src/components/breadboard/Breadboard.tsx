interface BreadboardProps {
  width?: number
  height?: number
  selected?: boolean
}

const ROWS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'] as const
const COLS = 30

export function BreadboardSVG({ width = 400, height = 200, selected = false }: BreadboardProps) {
  const stroke = selected ? '#60a5fa' : '#9ca3af'
  const holeSpacing = 12
  const startX = 24
  const rowStartY = 44
  const centerGap = 20

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Body */}
      <rect
        x="2"
        y="2"
        width={width - 4}
        height={height - 4}
        rx="4"
        fill="#fcfcf9"
        stroke={stroke}
        strokeWidth={selected ? 2 : 1}
      />

      {/* Top power rail - red (+) */}
      <rect x="8" y="8" width={width - 16} height="10" rx="2" fill="#dc2626" opacity="0.1" />
      <text x="12" y="16" fill="#dc2626" fontSize="7" fontWeight="bold">
        +
      </text>

      {/* Top ground rail - blue (-) */}
      <rect x="8" y="22" width={width - 16} height="10" rx="2" fill="#2563eb" opacity="0.1" />
      <text x="12" y="30" fill="#2563eb" fontSize="7" fontWeight="bold">
        −
      </text>

      {/* Center trench */}
      <rect
        x={width / 2 - centerGap / 2}
        y={rowStartY - 4}
        width={centerGap}
        height={ROWS.length * holeSpacing + 8}
        fill="#e4e4d4"
        opacity="0.6"
      />

      {/* Row labels & holes - top half (a-e) */}
      {ROWS.slice(0, 5).map((row, rowIdx) => {
        const y = rowStartY + rowIdx * holeSpacing
        return (
          <g key={row}>
            {/* Left label */}
            <text x="11" y={y + 2.5} fill="#6b7280" fontSize="6.5" fontWeight="bold" textAnchor="middle">
              {row.toUpperCase()}
            </text>
            {/* Right label */}
            <text x="388" y={y + 2.5} fill="#6b7280" fontSize="6.5" fontWeight="bold" textAnchor="middle">
              {row.toUpperCase()}
            </text>
            {Array.from({ length: COLS }, (_, col) => {
              const x = startX + col * holeSpacing
              return (
                <g key={`${row}-${col}`} className="breadboard-hole" data-row={row} data-col={col + 1}>
                  <circle cx={x} cy={y} r="2.8" fill="#e5e7eb" stroke="#cbd5e1" strokeWidth="0.5" />
                  <rect x={x - 1.2} y={y - 1.2} width="2.4" height="2.4" rx="0.3" fill="#1e293b" />
                </g>
              )
            })}
          </g>
        )
      })}

      {/* Row labels & holes - bottom half (f-j) */}
      {ROWS.slice(5).map((row, rowIdx) => {
        const y = rowStartY + (rowIdx + 5) * holeSpacing + 8
        return (
          <g key={row}>
            {/* Left label */}
            <text x="11" y={y + 2.5} fill="#6b7280" fontSize="6.5" fontWeight="bold" textAnchor="middle">
              {row.toUpperCase()}
            </text>
            {/* Right label */}
            <text x="388" y={y + 2.5} fill="#6b7280" fontSize="6.5" fontWeight="bold" textAnchor="middle">
              {row.toUpperCase()}
            </text>
            {Array.from({ length: COLS }, (_, col) => {
              const x = startX + col * holeSpacing
              return (
                <g key={`${row}-${col}`} className="breadboard-hole" data-row={row} data-col={col + 1}>
                  <circle cx={x} cy={y} r="2.8" fill="#e5e7eb" stroke="#cbd5e1" strokeWidth="0.5" />
                  <rect x={x - 1.2} y={y - 1.2} width="2.4" height="2.4" rx="0.3" fill="#1e293b" />
                </g>
              )
            })}
          </g>
        )
      })}

      {/* Column numbers - Top */}
      {Array.from({ length: COLS }, (_, col) => col + 1).map((num) => (
        <text
          key={`col-num-top-${num}`}
          x={startX + (num - 1) * holeSpacing}
          y={38}
          fill="#6b7280"
          fontSize="5"
          fontWeight="bold"
          textAnchor="middle"
        >
          {num}
        </text>
      ))}

      {/* Column numbers - Bottom */}
      {Array.from({ length: COLS }, (_, col) => col + 1).map((num) => (
        <text
          key={`col-num-bottom-${num}`}
          x={startX + (num - 1) * holeSpacing}
          y={166}
          fill="#6b7280"
          fontSize="5"
          fontWeight="bold"
          textAnchor="middle"
        >
          {num}
        </text>
      ))}

      {/* Bottom ground rail - blue (-) */}
      <rect
        x="8"
        y={height - 34}
        width={width - 16}
        height="10"
        rx="2"
        fill="#2563eb"
        opacity="0.1"
      />
      <text x="12" y={height - 26} fill="#2563eb" fontSize="7" fontWeight="bold">
        −
      </text>

      {/* Bottom power rail - red (+) */}
      <rect
        x="8"
        y={height - 20}
        width={width - 16}
        height="10"
        rx="2"
        fill="#dc2626"
        opacity="0.1"
      />
      <text x="12" y={height - 12} fill="#dc2626" fontSize="7" fontWeight="bold">
        +
      </text>

      {/* Power rail holes - top */}
      {Array.from({ length: COLS }, (_, col) => {
        const x = startX + col * holeSpacing
        return (
          <g key={`top-rail-${col}`}>
            {/* Positive (+) */}
            <circle cx={x} cy="13" r="2.8" fill="#fca5a5" stroke="#f87171" strokeWidth="0.5" />
            <rect x={x - 1.2} y={13 - 1.2} width="2.4" height="2.4" rx="0.3" fill="#1e293b" />
            
            {/* Negative (-) */}
            <circle cx={x} cy="27" r="2.8" fill="#93c5fd" stroke="#60a5fa" strokeWidth="0.5" />
            <rect x={x - 1.2} y={27 - 1.2} width="2.4" height="2.4" rx="0.3" fill="#1e293b" />
          </g>
        )
      })}

      {/* Power rail holes - bottom */}
      {Array.from({ length: COLS }, (_, col) => {
        const x = startX + col * holeSpacing
        return (
          <g key={`bottom-rail-${col}`}>
            {/* Negative (-) */}
            <circle cx={x} cy={height - 29} r="2.8" fill="#93c5fd" stroke="#60a5fa" strokeWidth="0.5" />
            <rect x={x - 1.2} y={height - 29 - 1.2} width="2.4" height="2.4" rx="0.3" fill="#1e293b" />
            
            {/* Positive (+) */}
            <circle cx={x} cy={height - 15} r="2.8" fill="#fca5a5" stroke="#f87171" strokeWidth="0.5" />
            <rect x={x - 1.2} y={height - 15 - 1.2} width="2.4" height="2.4" rx="0.3" fill="#1e293b" />
          </g>
        )
      })}
    </svg>
  )
}

export function BreadboardNode({ selected = false }: { selected?: boolean }) {
  return (
    <div className="relative">
      <BreadboardSVG width={400} height={200} selected={selected} />
    </div>
  )
}
