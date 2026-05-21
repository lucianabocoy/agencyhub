'use client'

import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend,
} from 'recharts'
import { type PerformanceMetric, type Client } from '@/types/index'
import { MetricFormModal } from './metric-form-modal'
import { Plus, TrendingUp } from 'lucide-react'

type MetricRow = PerformanceMetric & {
  client: Pick<Client, 'id' | 'name'> | null
}

interface Props {
  initialMetrics: MetricRow[]
  clients: Pick<Client, 'id' | 'name'>[]
  currentUserId: string
  defaultClientId?: string
}

const TOOLTIP_STYLE = {
  backgroundColor: '#1a1d27', border: '1px solid #2d3244',
  borderRadius: '8px', color: '#e4e6ee', fontSize: 12,
}

const PLATFORM_COLOR: Record<string, string> = {
  meta_ads: '#818cf8',
  google_ads: '#34d399',
}

type MetricKey = 'spend' | 'impressions' | 'clicks' | 'ctr' | 'cpc' | 'conversions' | 'cost_per_result' | 'conversion_rate'
const METRIC_OPTIONS: { key: MetricKey; label: string; prefix?: string; suffix?: string }[] = [
  { key: 'spend', label: 'Inversión', prefix: '$' },
  { key: 'impressions', label: 'Impresiones' },
  { key: 'clicks', label: 'Clics' },
  { key: 'ctr', label: 'CTR', suffix: '%' },
  { key: 'cpc', label: 'CPC', prefix: '$' },
  { key: 'conversions', label: 'Conversiones' },
  { key: 'cost_per_result', label: 'Costo/resultado', prefix: '$' },
  { key: 'conversion_rate', label: 'Tasa conv.', suffix: '%' },
]

function fmt(val: unknown, prefix?: string, suffix?: string): string {
  if (val === null || val === undefined) return '—'
  const n = Number(val)
  if (isNaN(n)) return '—'
  const formatted = n.toLocaleString('es-AR', { maximumFractionDigits: 2 })
  return `${prefix ?? ''}${formatted}${suffix ?? ''}`
}

export function MetricsView({ initialMetrics, clients, currentUserId, defaultClientId }: Props) {
  const [metrics, setMetrics] = useState(initialMetrics)
  const [clientFilter, setClientFilter] = useState(defaultClientId ?? '')
  const [platformFilter, setPlatformFilter] = useState<'all' | 'meta_ads' | 'google_ads'>('all')
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>('spend')
  const [showModal, setShowModal] = useState(false)

  const filtered = metrics.filter((m) => {
    if (clientFilter && m.client_id !== clientFilter) return false
    if (platformFilter !== 'all' && m.platform !== platformFilter) return false
    return true
  })

  // Bar chart data: aggregated by client (latest period)
  const byClient: Record<string, { name: string; meta: number; google: number }> = {}
  for (const m of filtered) {
    const name = m.client?.name ?? m.client_id
    if (!byClient[m.client_id]) byClient[m.client_id] = { name, meta: 0, google: 0 }
    const val = (m[selectedMetric] as number | null) ?? 0
    if (m.platform === 'meta_ads') byClient[m.client_id].meta += val
    else byClient[m.client_id].google += val
  }
  const barData = Object.values(byClient).sort((a, b) => (b.meta + b.google) - (a.meta + a.google)).slice(0, 8)

  // Line chart data: by period (selected client only)
  const lineData: Record<string, Record<string, unknown>> = {}
  for (const m of filtered) {
    const key = `${m.period_start}→${m.period_end}`
    if (!lineData[key]) lineData[key] = { period: m.period_start }
    const val = (m[selectedMetric] as number | null) ?? null
    if (val !== null) {
      const existing = (lineData[key][m.platform] as number | undefined) ?? 0
      lineData[key][m.platform] = existing + val
    }
  }
  const lineChartData = Object.values(lineData).sort((a, b) =>
    String(a.period).localeCompare(String(b.period))
  )

  const metricOpt = METRIC_OPTIONS.find((m) => m.key === selectedMetric)!

  function handleSave(saved: PerformanceMetric) {
    const clientObj = clients.find((c) => c.id === saved.client_id) ?? null
    setMetrics((prev) => {
      const exists = prev.find((m) => m.id === saved.id)
      if (exists) return prev.map((m) => m.id === saved.id ? { ...m, ...saved } : m)
      return [{ ...saved, client: clientObj }, ...prev]
    })
    setShowModal(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text">Métricas de rendimiento</h1>
          <p className="text-muted text-sm mt-0.5">{filtered.length} registros</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-yesica/15 hover:bg-yesica/25 text-yesica rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={15} /> Agregar métricas
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          className="px-3 py-2 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-yesica/50"
        >
          <option value="">Todos los clientes</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="flex gap-1">
          {(['all', 'meta_ads', 'google_ads'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPlatformFilter(p)}
              className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                platformFilter === p
                  ? 'bg-yesica/15 text-yesica'
                  : 'bg-surface border border-border text-muted hover:text-text'
              }`}
            >
              {p === 'all' ? 'Todas' : p === 'meta_ads' ? 'Meta Ads' : 'Google Ads'}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl py-20 text-center">
          <TrendingUp size={32} className="mx-auto text-muted mb-3" />
          <p className="text-sm text-muted">Sin datos de rendimiento registrados</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-4 px-4 py-2 bg-yesica/15 hover:bg-yesica/25 text-yesica rounded-lg text-sm font-medium transition-colors"
          >
            Agregar primer registro
          </button>
        </div>
      ) : (
        <>
          {/* Metric selector */}
          <div className="flex gap-1 flex-wrap">
            {METRIC_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setSelectedMetric(opt.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  selectedMetric === opt.key
                    ? 'bg-yesica/15 text-yesica'
                    : 'text-muted hover:text-text hover:bg-surface-2'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Bar chart: by client */}
            <div className="bg-surface border border-border rounded-xl p-5">
              <h2 className="text-sm font-semibold text-text mb-4">
                {metricOpt.label} por cliente
              </h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barData} margin={{ top: 4, right: 20, bottom: 4, left: 4 }}>
                  <CartesianGrid vertical={false} stroke="#2d3244" strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fill: '#e4e6ee', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#8b90a5', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(v: unknown) => [fmt(v, metricOpt.prefix, metricOpt.suffix), '']}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#8b90a5' }} />
                  <Bar dataKey="meta" name="Meta Ads" fill="#818cf8" radius={[4, 4, 0, 0]} maxBarSize={32} />
                  <Bar dataKey="google" name="Google Ads" fill="#34d399" radius={[4, 4, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Line chart: over time */}
            <div className="bg-surface border border-border rounded-xl p-5">
              <h2 className="text-sm font-semibold text-text mb-4">
                {metricOpt.label} en el tiempo
              </h2>
              {lineChartData.length < 2 ? (
                <p className="text-muted text-sm py-8 text-center">Necesitás al menos 2 períodos para ver la evolución</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={lineChartData} margin={{ top: 4, right: 20, bottom: 4, left: 4 }}>
                    <CartesianGrid stroke="#2d3244" strokeDasharray="3 3" />
                    <XAxis dataKey="period" tick={{ fill: '#8b90a5', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#8b90a5', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(v: unknown) => [fmt(v, metricOpt.prefix, metricOpt.suffix), '']}
                    />
                    <Legend wrapperStyle={{ fontSize: 11, color: '#8b90a5' }} />
                    <Line dataKey="meta_ads" name="Meta Ads" stroke="#818cf8" strokeWidth={2} dot={{ r: 3 }} />
                    <Line dataKey="google_ads" name="Google Ads" stroke="#34d399" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Data table */}
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-border">
              <h2 className="text-sm font-semibold text-text">Registros</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    {['Cliente', 'Plataforma', 'Período', 'Inversión', 'Impresiones', 'Clics', 'CTR', 'CPC', 'Conversiones', 'Costo/conv.'].map((h) => (
                      <th key={h} className="text-left px-4 py-2.5 font-medium text-muted whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.slice(0, 20).map((m) => (
                    <tr key={m.id} className="hover:bg-surface-2/50 transition-colors">
                      <td className="px-4 py-2.5 text-text font-medium whitespace-nowrap">{m.client?.name ?? '—'}</td>
                      <td className="px-4 py-2.5">
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                          style={{ backgroundColor: `${PLATFORM_COLOR[m.platform]}20`, color: PLATFORM_COLOR[m.platform] }}
                        >
                          {m.platform === 'meta_ads' ? 'Meta' : 'Google'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-muted whitespace-nowrap font-mono">
                        {m.period_start} → {m.period_end}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-text">{fmt(m.spend, '$')}</td>
                      <td className="px-4 py-2.5 font-mono text-muted">{fmt(m.impressions)}</td>
                      <td className="px-4 py-2.5 font-mono text-muted">{fmt(m.clicks)}</td>
                      <td className="px-4 py-2.5 font-mono text-muted">{fmt(m.ctr, '', '%')}</td>
                      <td className="px-4 py-2.5 font-mono text-muted">{fmt(m.cpc, '$')}</td>
                      <td className="px-4 py-2.5 font-mono text-muted">{fmt(m.conversions)}</td>
                      <td className="px-4 py-2.5 font-mono text-muted">{fmt(m.cost_per_result, '$')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {showModal && (
        <MetricFormModal
          clients={clients}
          currentUserId={currentUserId}
          defaultClientId={defaultClientId ?? (clientFilter || undefined)}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
