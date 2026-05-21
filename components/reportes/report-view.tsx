'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  type TimeEntry, type Client, type User, type Objective,
  type Ticket, type MetricType, PRIORITY_COLORS, type Priority,
} from '@/types/index'
import { formatMinutes } from '@/lib/utils'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LabelList, Cell,
} from 'recharts'
import { ActivityHeatmap } from './activity-heatmap'
import { Printer, RefreshCw } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type EntryRow = TimeEntry & {
  clients: Pick<Client, 'id' | 'name'>
  users: Pick<User, 'id' | 'name' | 'color'>
}
type ObjRow = Objective & {
  client: Pick<Client, 'id' | 'name'> | null
  assignee: Pick<User, 'id' | 'name' | 'color'> | null
}

interface InitialData {
  entries: EntryRow[]
  objectives: ObjRow[]
  tickets: Ticket[]
  allClients: Pick<Client, 'id' | 'name'>[]
}

interface Props extends InitialData {
  currentUserId: string
  isAdmin: boolean
  defaultStart: string
  defaultEnd: string
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const LOWER_IS_BETTER: MetricType[] = ['cpl', 'cpc']
const TOOLTIP_STYLE = {
  backgroundColor: '#1a1d27', border: '1px solid #2d3244',
  borderRadius: '8px', color: '#e4e6ee', fontSize: 11,
}
const TICKET_STATUS_LABEL: Record<string, string> = {
  nuevo: 'Nuevo', en_revision: 'En revisión', en_proceso: 'En proceso', completado: 'Completado',
}

function calcObjProgress(obj: Objective): number {
  const latest = obj.latest_value ?? obj.current_value
  if (LOWER_IS_BETTER.includes(obj.metric_type)) {
    const range = obj.current_value - obj.target_value
    if (range <= 0) return latest <= obj.target_value ? 100 : 0
    return Math.max(0, Math.min(100, ((obj.current_value - latest) / range) * 100))
  }
  if (obj.target_value === 0) return 0
  return Math.max(0, Math.min(100, ((obj.latest_value ?? obj.current_value) / obj.target_value) * 100))
}

function buildDateRange(start: string, end: string): string[] {
  const dates: string[] = []
  const d = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  while (d <= e) {
    dates.push(d.toISOString().slice(0, 10))
    d.setDate(d.getDate() + 1)
  }
  return dates
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ReportView({
  entries: initialEntries,
  objectives: initialObjectives,
  tickets: initialTickets,
  allClients,
  currentUserId,
  isAdmin,
  defaultStart,
  defaultEnd,
}: Props) {
  const supabase = createClient()
  const [start, setStart] = useState(defaultStart)
  const [end, setEnd] = useState(defaultEnd)
  const [clientFilter, setClientFilter] = useState('')
  const [entries, setEntries] = useState(initialEntries)
  const [objectives, setObjectives] = useState(initialObjectives)
  const [tickets, setTickets] = useState(initialTickets)
  const [loading, setLoading] = useState(false)

  const refetch = useCallback(async (s: string, e: string) => {
    setLoading(true)
    const [entriesRes, objectivesRes, ticketsRes] = await Promise.all([
      supabase
        .from('time_entries')
        .select('*, clients(id, name), users(id, name, color)')
        .gte('date', s).lte('date', e)
        .not('duration_minutes', 'is', null)
        .then((r) => r),
      supabase
        .from('objectives')
        .select('*, client:clients(id, name), assignee:users!assigned_to(id, name, color)')
        .or(`period_start.lte.${e},period_end.gte.${s}`)
        .then((r) => r),
      supabase
        .from('tickets')
        .select('*')
        .gte('created_at', s + 'T00:00:00')
        .lte('created_at', e + 'T23:59:59')
        .then((r) => r),
    ])
    setEntries((entriesRes.data ?? []) as EntryRow[])
    setObjectives((objectivesRes.data ?? []) as ObjRow[])
    setTickets((ticketsRes.data ?? []) as Ticket[])
    setLoading(false)
  }, [])

  function applyFilters() {
    if (start && end && start <= end) refetch(start, end)
  }

  // Filtered entries (by client if selected)
  const filteredEntries = clientFilter
    ? entries.filter((e) => e.client_id === clientFilter)
    : entries

  const filteredObjectives = clientFilter
    ? objectives.filter((o) => o.client_id === clientFilter)
    : objectives

  const filteredTickets = clientFilter
    ? tickets.filter((t) => t.client_id === clientFilter)
    : tickets

  // ─── Derived data ──────────────────────────────────────────────────────────

  const totalMinutes = filteredEntries.reduce((s, e) => s + (e.duration_minutes ?? 0), 0)
  const uniqueClients = new Set(filteredEntries.map((e) => e.client_id)).size
  const ticketsClosed = filteredTickets.filter((t) => t.status === 'completado').length
  const objectivesMet = filteredObjectives.filter((o) => o.status === 'cumplido').length

  // By client
  const byClient: Record<string, { name: string; minutes: number }> = {}
  for (const e of filteredEntries) {
    if (!byClient[e.client_id]) byClient[e.client_id] = { name: e.clients?.name ?? '?', minutes: 0 }
    byClient[e.client_id].minutes += e.duration_minutes ?? 0
  }
  const clientChartData = Object.values(byClient)
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 10)
    .map((c) => ({ name: c.name, horas: parseFloat((c.minutes / 60).toFixed(1)) }))

  // By user
  const byUser: Record<string, { name: string; color: string; minutes: number }> = {}
  for (const e of filteredEntries) {
    if (!byUser[e.user_id]) byUser[e.user_id] = { name: e.users?.name ?? '?', color: e.users?.color ?? '#818cf8', minutes: 0 }
    byUser[e.user_id].minutes += e.duration_minutes ?? 0
  }
  const userChartData = Object.values(byUser)
    .map((u) => ({ name: u.name.split(' ')[0], color: u.color, horas: parseFloat((u.minutes / 60).toFixed(1)) }))

  // By activity
  const byActivity: Record<string, number> = {}
  for (const e of filteredEntries) {
    byActivity[e.activity_type] = (byActivity[e.activity_type] ?? 0) + (e.duration_minutes ?? 0)
  }
  const activityData = Object.entries(byActivity)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, mins]) => ({ name, horas: parseFloat((mins / 60).toFixed(1)) }))

  // Heatmap data
  const dateRange = buildDateRange(start, end)
  const heatmapClients = allClients.filter((c) =>
    !clientFilter || c.id === clientFilter
  )

  // Ticket status counts
  const ticketCounts: Record<string, number> = {}
  for (const t of filteredTickets) {
    ticketCounts[t.status] = (ticketCounts[t.status] ?? 0) + 1
  }

  // Format date range label
  const periodLabel = `${new Date(start + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })} al ${new Date(end + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}`
  const clientName = clientFilter ? allClients.find((c) => c.id === clientFilter)?.name : undefined

  return (
    <div className="space-y-6">
      {/* Controls — hidden on print */}
      <div data-no-print className="flex items-center gap-3 flex-wrap">
        <div>
          <p className="text-xs text-muted mb-1">Desde</p>
          <input
            type="date" value={start}
            onChange={(e) => setStart(e.target.value)}
            className="px-3 py-2 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none"
          />
        </div>
        <div>
          <p className="text-xs text-muted mb-1">Hasta</p>
          <input
            type="date" value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="px-3 py-2 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none"
          />
        </div>
        <div>
          <p className="text-xs text-muted mb-1">Cliente</p>
          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none"
          >
            <option value="">Todos</option>
            {allClients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="mt-5 flex gap-2">
          <button
            onClick={applyFilters}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-surface border border-border hover:border-muted rounded-lg text-sm text-muted hover:text-text transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-4 py-2 bg-yesica/15 hover:bg-yesica/25 text-yesica rounded-lg text-sm font-medium transition-colors"
          >
            <Printer size={14} /> Exportar PDF
          </button>
        </div>
      </div>

      {/* ─── Report content (printed) ──────────────────────────────────────── */}

      {/* Cover */}
      <div data-report-section className="bg-surface border border-border rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-yesica/20 border border-yesica/30 flex items-center justify-center">
                <span className="font-mono font-bold text-yesica text-xs">AH</span>
              </div>
              <span className="font-bold text-text">AgencyHub</span>
            </div>
            <h1 className="text-2xl font-bold text-text">Reporte de Productividad</h1>
            {clientName && <p className="text-yesica text-sm mt-0.5">Cliente: {clientName}</p>}
            <p className="text-muted text-sm mt-1">{periodLabel}</p>
          </div>
          <p className="text-xs text-muted text-right">
            Generado el {new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div data-report-section className="grid grid-cols-4 gap-4">
        {[
          { label: 'Horas trabajadas', value: formatMinutes(totalMinutes), color: '#818cf8' },
          { label: 'Clientes con actividad', value: uniqueClients, color: '#34d399' },
          { label: 'Tickets cerrados', value: ticketsClosed, color: '#60a5fa' },
          { label: 'Objetivos cumplidos', value: objectivesMet, color: '#f472b6' },
        ].map((k) => (
          <div key={k.label} className="bg-surface border border-border rounded-xl p-4">
            <p className="text-xs text-muted uppercase tracking-wide mb-1">{k.label}</p>
            <p className="text-2xl font-bold font-mono" style={{ color: k.color }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      {filteredEntries.length > 0 && (
        <div data-report-section className="grid grid-cols-2 gap-6">
          {/* By client */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-text mb-4">
              Horas por cliente
            </h2>
            {clientChartData.length === 0 ? (
              <p className="text-muted text-sm text-center py-6">Sin datos</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(160, clientChartData.length * 32)}>
                <BarChart
                  data={clientChartData} layout="vertical"
                  margin={{ left: 110, right: 50, top: 4, bottom: 4 }}
                >
                  <CartesianGrid horizontal={false} stroke="#2d3244" strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fill: '#8b90a5', fontSize: 10 }} axisLine={false} tickLine={false} unit="h" />
                  <YAxis type="category" dataKey="name" width={105} tick={{ fill: '#e4e6ee', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: unknown) => [`${v}h`, 'Horas']} />
                  <Bar dataKey="horas" fill="#818cf8" radius={[0, 4, 4, 0]} maxBarSize={20}>
                    <LabelList dataKey="horas" position="right" formatter={(v: unknown) => `${v}h`} style={{ fill: '#8b90a5', fontSize: 10 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* By user */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-text mb-4">Horas por responsable</h2>
            {userChartData.length === 0 ? (
              <p className="text-muted text-sm text-center py-6">Sin datos</p>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={userChartData} margin={{ top: 4, right: 30, bottom: 4, left: 4 }}>
                  <CartesianGrid vertical={false} stroke="#2d3244" strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fill: '#e4e6ee', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#8b90a5', fontSize: 11 }} axisLine={false} tickLine={false} unit="h" />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: unknown) => [`${v}h`, 'Horas']} />
                  <Bar dataKey="horas" radius={[4, 4, 0, 0]} maxBarSize={44}>
                    {userChartData.map((u, i) => (
                      <Cell key={i} fill={u.color} />
                    ))}
                    <LabelList dataKey="horas" position="top" formatter={(v: unknown) => `${v}h`} style={{ fill: '#8b90a5', fontSize: 10 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* Activity breakdown */}
      {activityData.length > 0 && (
        <div data-report-section className="bg-surface border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-text mb-4">Distribución por tipo de actividad</h2>
          <ResponsiveContainer width="100%" height={Math.max(120, activityData.length * 28)}>
            <BarChart data={activityData} layout="vertical" margin={{ left: 160, right: 60, top: 4, bottom: 4 }}>
              <CartesianGrid horizontal={false} stroke="#2d3244" strokeDasharray="3 3" />
              <XAxis type="number" tick={{ fill: '#8b90a5', fontSize: 10 }} axisLine={false} tickLine={false} unit="h" />
              <YAxis type="category" dataKey="name" width={155} tick={{ fill: '#e4e6ee', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: unknown) => [`${v}h`, 'Horas']} />
              <Bar dataKey="horas" fill="#34d399" radius={[0, 4, 4, 0]} maxBarSize={16}>
                <LabelList dataKey="horas" position="right" formatter={(v: unknown) => `${v}h`} style={{ fill: '#8b90a5', fontSize: 10 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Activity heatmap */}
      {dateRange.length <= 90 && filteredEntries.length > 0 && (
        <div data-report-section className="bg-surface border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-text mb-4">
            Mapa de actividad — horas por cliente / día
          </h2>
          <ActivityHeatmap
            entries={filteredEntries.map((e) => ({
              client_id: e.client_id,
              date: e.date,
              duration_minutes: e.duration_minutes ?? 0,
            }))}
            clients={heatmapClients}
            dates={dateRange}
          />
        </div>
      )}

      {/* Objectives table */}
      {filteredObjectives.length > 0 && (
        <div data-report-section data-report-page-break className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-text">Objetivos del período</h2>
          </div>
          <div className="divide-y divide-border">
            {filteredObjectives.map((obj) => {
              const pct = calcObjProgress(obj)
              const latest = obj.latest_value ?? obj.current_value
              const statusColor = {
                activo: '#818cf8', cumplido: '#34d399', no_cumplido: '#f87171',
              }[obj.status]

              return (
                <div key={obj.id} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div>
                      <p className="text-sm font-medium text-text">{obj.client?.name}</p>
                      <p className="text-xs text-muted">{obj.metric_label ?? obj.metric_type.toUpperCase()}</p>
                    </div>
                    <div className="flex items-center gap-4 text-sm font-mono">
                      <span className="text-text">{latest.toLocaleString('es-AR', { maximumFractionDigits: 2 })}</span>
                      <span className="text-muted">/ {obj.target_value.toLocaleString('es-AR', { maximumFractionDigits: 2 })}</span>
                      <span className="text-xs font-sans px-2 py-0.5 rounded-full" style={{ color: statusColor, backgroundColor: `${statusColor}20` }}>
                        {obj.status === 'cumplido' ? 'Cumplido' : obj.status === 'no_cumplido' ? 'No cumplido' : 'Activo'}
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: statusColor }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Tickets summary */}
      {filteredTickets.length > 0 && (
        <div data-report-section className="bg-surface border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-text mb-4">Tickets del período ({filteredTickets.length} total)</h2>
          <div className="grid grid-cols-4 gap-3">
            {(['nuevo', 'en_revision', 'en_proceso', 'completado'] as const).map((s) => (
              <div key={s} className="bg-surface-2 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold font-mono text-text">{ticketCounts[s] ?? 0}</p>
                <p className="text-xs text-muted mt-0.5">{TICKET_STATUS_LABEL[s]}</p>
              </div>
            ))}
          </div>

          {/* Priority breakdown */}
          <div className="mt-3 space-y-1">
            {(['urgente', 'normal', 'baja'] as Priority[]).map((p) => {
              const count = filteredTickets.filter((t) => t.priority === p).length
              if (count === 0) return null
              return (
                <div key={p} className="flex items-center gap-2 text-xs">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PRIORITY_COLORS[p] }} />
                  <span className="text-muted capitalize">{p}</span>
                  <span className="text-text font-medium">{count}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {filteredEntries.length === 0 && filteredObjectives.length === 0 && filteredTickets.length === 0 && (
        <div className="bg-surface border border-border rounded-xl py-20 text-center">
          <p className="text-muted text-sm">Sin datos para el período seleccionado</p>
        </div>
      )}
    </div>
  )
}
