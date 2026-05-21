'use client'

interface HeatmapEntry {
  client_id: string
  date: string
  duration_minutes: number
}

interface HeatmapClient {
  id: string
  name: string
}

interface Props {
  entries: HeatmapEntry[]
  clients: HeatmapClient[]
  dates: string[]
}

function hrsToColor(hrs: number): string {
  if (hrs === 0) return 'transparent'
  if (hrs < 0.5) return '#3d3e6b'
  if (hrs < 1.5) return '#5254a0'
  if (hrs < 3) return '#6c6fc5'
  if (hrs < 5) return '#818cf8'
  return '#a5b4fc'
}

function formatDayLabel(date: string, totalDates: number): string {
  const d = new Date(date + 'T00:00:00')
  if (totalDates <= 14) {
    return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
  }
  // For longer ranges, only show every 7th label
  return d.getDate() === 1 || d.getDay() === 1
    ? d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
    : ''
}

export function ActivityHeatmap({ entries, clients, dates }: Props) {
  // Build matrix: clientId -> date -> minutes
  const matrix: Record<string, Record<string, number>> = {}
  for (const e of entries) {
    if (!matrix[e.client_id]) matrix[e.client_id] = {}
    matrix[e.client_id][e.date] = (matrix[e.client_id][e.date] ?? 0) + e.duration_minutes
  }

  const activeClients = clients.filter((c) => matrix[c.id])
  if (activeClients.length === 0) {
    return <p className="text-muted text-sm text-center py-6">Sin actividad en el período</p>
  }

  const cellSize = dates.length <= 14 ? 32 : dates.length <= 30 ? 20 : 12

  return (
    <div className="overflow-x-auto">
      <table className="border-separate" style={{ borderSpacing: '2px' }}>
        <thead>
          <tr>
            <th className="w-36 pr-3" />
            {dates.map((d) => (
              <th
                key={d}
                className="text-center"
                style={{ width: cellSize, minWidth: cellSize }}
              >
                <span className="text-[9px] text-muted whitespace-nowrap" style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)', display: 'inline-block', height: 36 }}>
                  {formatDayLabel(d, dates.length)}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {activeClients.map((c) => (
            <tr key={c.id}>
              <td className="text-xs text-text font-medium pr-3 text-right whitespace-nowrap" style={{ maxWidth: 140 }}>
                <span className="truncate block">{c.name}</span>
              </td>
              {dates.map((d) => {
                const mins = matrix[c.id]?.[d] ?? 0
                const hrs = mins / 60
                return (
                  <td key={d} title={hrs > 0 ? `${c.name} — ${d}: ${hrs.toFixed(1)}h` : undefined}>
                    <div
                      className="rounded-sm border border-border/30"
                      style={{
                        width: cellSize,
                        height: cellSize,
                        backgroundColor: hrsToColor(hrs),
                      }}
                    />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Legend */}
      <div className="flex items-center gap-2 mt-3">
        <span className="text-[10px] text-muted">Menos</span>
        {[0, 0.4, 1, 2.5, 4.5].map((v) => (
          <div
            key={v}
            className="w-3 h-3 rounded-sm border border-border/30"
            style={{ backgroundColor: hrsToColor(v) }}
          />
        ))}
        <span className="text-[10px] text-muted">Más</span>
      </div>
    </div>
  )
}
