'use client'

import { useState } from 'react'
import { type Objective, type Client, type User, type MetricType, type ObjectiveStatus } from '@/types/index'
import { ObjetivoModal } from './objetivo-modal'
import { Plus, Target, TrendingDown, TrendingUp } from 'lucide-react'

type ObjRow = Objective & {
  client: Pick<Client, 'id' | 'name'> | null
  assignee: Pick<User, 'id' | 'name' | 'color'> | null
}

interface Props {
  initialObjectives: ObjRow[]
  clients: Pick<Client, 'id' | 'name'>[]
  users: Pick<User, 'id' | 'name' | 'color'>[]
  currentUserId: string
  isAdmin: boolean
}

const METRIC_LABEL: Record<MetricType, string> = {
  cpl: 'CPL', cpc: 'CPC', ctr: 'CTR',
  conversiones: 'Conversiones', tasa_conversion: 'Tasa conv.', personalizado: '',
}
const METRIC_UNIT: Record<MetricType, string> = {
  cpl: 'ARS', cpc: 'ARS', ctr: '%',
  conversiones: '', tasa_conversion: '%', personalizado: '',
}
const LOWER_IS_BETTER: MetricType[] = ['cpl', 'cpc']

const STATUS_FILTER: { key: ObjectiveStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'activo', label: 'Activos' },
  { key: 'cumplido', label: 'Cumplidos' },
  { key: 'no_cumplido', label: 'No cumplidos' },
]

const STATUS_COLOR: Record<ObjectiveStatus, string> = {
  activo: 'text-yesica bg-yesica/10',
  cumplido: 'text-success bg-success/10',
  no_cumplido: 'text-danger bg-danger/10',
}

function calcProgress(obj: Objective): number {
  const latest = obj.latest_value ?? obj.current_value
  if (LOWER_IS_BETTER.includes(obj.metric_type)) {
    const range = obj.current_value - obj.target_value
    if (range <= 0) return latest <= obj.target_value ? 100 : 0
    return Math.max(0, Math.min(100, ((obj.current_value - latest) / range) * 100))
  }
  if (obj.target_value === 0) return 0
  return Math.max(0, Math.min(100, (latest / obj.target_value) * 100))
}

function fmtValue(val: number | null, type: MetricType, label: string | null): string {
  if (val === null) return '—'
  const unit = METRIC_UNIT[type]
  if (type === 'cpl' || type === 'cpc') {
    return `$${val.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`
  }
  if (type === 'ctr' || type === 'tasa_conversion') return `${val.toFixed(2)}%`
  if (type === 'personalizado') return `${val}${unit ? ' ' + unit : ''}`
  return val.toLocaleString('es-AR')
}

export function ObjetivosView({ initialObjectives, clients, users, currentUserId, isAdmin }: Props) {
  const [objectives, setObjectives] = useState(initialObjectives)
  const [statusFilter, setStatusFilter] = useState<ObjectiveStatus | 'all'>('all')
  const [modal, setModal] = useState<null | 'new' | ObjRow>(null)

  const filtered = statusFilter === 'all'
    ? objectives
    : objectives.filter((o) => o.status === statusFilter)

  const counts: Record<string, number> = {
    all: objectives.length,
    activo: objectives.filter((o) => o.status === 'activo').length,
    cumplido: objectives.filter((o) => o.status === 'cumplido').length,
    no_cumplido: objectives.filter((o) => o.status === 'no_cumplido').length,
  }

  function handleSave(saved: Objective) {
    setObjectives((prev) => {
      const exists = prev.find((o) => o.id === saved.id)
      if (exists) return prev.map((o) => o.id === saved.id ? { ...o, ...saved } : o)
      const clientObj = clients.find((c) => c.id === saved.client_id) ?? null
      const assigneeObj = users.find((u) => u.id === saved.assigned_to) ?? null
      return [{ ...saved, client: clientObj, assignee: assigneeObj }, ...prev]
    })
    setModal(null)
  }

  function handleDelete(id: string) {
    setObjectives((prev) => prev.filter((o) => o.id !== id))
    setModal(null)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text">Objetivos</h1>
          <p className="text-muted text-sm mt-0.5">{counts.activo} activos</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setModal('new')}
            className="flex items-center gap-1.5 px-3 py-2 bg-yesica/15 hover:bg-yesica/25 text-yesica rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={15} /> Nuevo objetivo
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1">
        {STATUS_FILTER.map((s) => (
          <button
            key={s.key}
            onClick={() => setStatusFilter(s.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              statusFilter === s.key
                ? 'bg-yesica/15 text-yesica'
                : 'text-muted hover:text-text hover:bg-surface-2'
            }`}
          >
            {s.label}
            <span className="ml-1.5 text-muted">{counts[s.key]}</span>
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-surface border border-border rounded-xl py-16 text-center">
            <Target size={28} className="mx-auto text-muted mb-3" />
            <p className="text-sm text-muted">Sin objetivos</p>
          </div>
        ) : (
          filtered.map((obj) => {
            const pct = calcProgress(obj)
            const latest = obj.latest_value ?? obj.current_value
            const metricName = obj.metric_type === 'personalizado'
              ? (obj.metric_label ?? 'Personalizado')
              : METRIC_LABEL[obj.metric_type]
            const lowerBetter = LOWER_IS_BETTER.includes(obj.metric_type)
            const onTrack = lowerBetter ? latest <= obj.target_value : latest >= obj.target_value
            const progressColor = obj.status === 'cumplido' ? '#34d399'
              : onTrack ? '#818cf8' : '#f87171'

            return (
              <button
                key={obj.id}
                onClick={() => setModal(obj)}
                className="w-full text-left bg-surface border border-border hover:border-border/80 hover:bg-surface-2/30 rounded-xl px-5 py-4 transition-colors"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-text truncate">
                        {obj.client?.name ?? '—'}
                      </p>
                      <span className="text-muted text-xs">·</span>
                      <span className="text-xs text-muted">{metricName}</span>
                    </div>
                    <p className="text-xs text-muted">
                      {new Date(obj.period_start + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                      {' → '}
                      {new Date(obj.period_end + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {obj.assignee && (
                        <> · <span style={{ color: obj.assignee.color ?? '#818cf8' }}>{obj.assignee.name}</span></>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-lg font-bold font-mono text-text">
                        {fmtValue(latest, obj.metric_type, obj.metric_label)}
                      </p>
                      <p className="text-xs text-muted">
                        meta: {fmtValue(obj.target_value, obj.metric_type, obj.metric_label)}
                      </p>
                    </div>
                    {lowerBetter
                      ? <TrendingDown size={16} className={onTrack ? 'text-success' : 'text-danger'} />
                      : <TrendingUp size={16} className={onTrack ? 'text-success' : 'text-danger'} />
                    }
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[obj.status]}`}>
                      {STATUS_FILTER.find((s) => s.key === obj.status)?.label ?? obj.status}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: progressColor }}
                  />
                </div>
                <p className="text-[10px] text-muted mt-1 text-right">{pct.toFixed(0)}% del objetivo</p>
              </button>
            )
          })
        )}
      </div>

      {/* Modal */}
      {modal !== null && (
        <ObjetivoModal
          objective={modal === 'new' ? null : (modal as ObjRow)}
          clients={clients}
          users={users}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          onClose={() => setModal(null)}
          onSave={handleSave}
          onDelete={isAdmin ? handleDelete : undefined}
        />
      )}
    </div>
  )
}
