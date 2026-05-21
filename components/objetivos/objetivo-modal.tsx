'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  type Objective, type Client, type User,
  type MetricType, type ObjectiveStatus,
} from '@/types/index'
import { X } from 'lucide-react'

interface Props {
  objective?: Objective | null
  clients: Pick<Client, 'id' | 'name'>[]
  users: Pick<User, 'id' | 'name' | 'color'>[]
  currentUserId: string
  isAdmin: boolean
  onClose: () => void
  onSave: (obj: Objective) => void
  onDelete?: (id: string) => void
}

const METRIC_LABELS: Record<MetricType, string> = {
  cpl: 'CPL (Costo por Lead)',
  cpc: 'CPC (Costo por Clic)',
  ctr: 'CTR (%)',
  conversiones: 'Conversiones',
  tasa_conversion: 'Tasa de Conversión (%)',
  personalizado: 'Personalizado',
}

const STATUS_OPTIONS: { value: ObjectiveStatus; label: string }[] = [
  { value: 'activo', label: 'Activo' },
  { value: 'cumplido', label: 'Cumplido' },
  { value: 'no_cumplido', label: 'No cumplido' },
]

export function ObjetivoModal({
  objective, clients, users, currentUserId, isAdmin,
  onClose, onSave, onDelete,
}: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    client_id: objective?.client_id ?? '',
    assigned_to: objective?.assigned_to ?? currentUserId,
    period_type: objective?.period_type ?? 'mensual' as 'semanal' | 'mensual',
    period_start: objective?.period_start ?? '',
    period_end: objective?.period_end ?? '',
    metric_type: (objective?.metric_type ?? 'conversiones') as MetricType,
    metric_label: objective?.metric_label ?? '',
    current_value: objective?.current_value?.toString() ?? '0',
    target_value: objective?.target_value?.toString() ?? '',
    latest_value: objective?.latest_value?.toString() ?? '',
    status: (objective?.status ?? 'activo') as ObjectiveStatus,
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.client_id || !form.period_start || !form.period_end || !form.target_value) {
      setError('Cliente, período y objetivo son obligatorios.')
      return
    }
    setLoading(true)
    setError(null)

    const payload = {
      client_id: form.client_id,
      assigned_to: form.assigned_to,
      period_type: form.period_type,
      period_start: form.period_start,
      period_end: form.period_end,
      metric_type: form.metric_type,
      metric_label: form.metric_label || null,
      current_value: parseFloat(form.current_value) || 0,
      target_value: parseFloat(form.target_value),
      latest_value: form.latest_value ? parseFloat(form.latest_value) : null,
      status: form.status,
    }

    if (objective) {
      const { data, error: err } = await supabase
        .from('objectives').update(payload).eq('id', objective.id).select().single()
      if (err) { setError(err.message); setLoading(false); return }
      onSave(data as Objective)
    } else {
      const { data, error: err } = await supabase
        .from('objectives')
        .insert({ ...payload, created_by: currentUserId })
        .select().single()
      if (err) { setError(err.message); setLoading(false); return }
      onSave(data as Objective)
    }
  }

  async function handleDelete() {
    if (!objective || !onDelete) return
    if (!confirm('¿Eliminar este objetivo?')) return
    await supabase.from('objectives').delete().eq('id', objective.id)
    onDelete(objective.id)
  }

  const inputCls = 'w-full px-3 py-2.5 text-sm rounded-lg bg-surface-2 border border-border text-text focus:outline-none focus:border-yesica/50'
  const labelCls = 'block text-xs font-medium text-muted mb-1.5'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-bg/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface border border-border rounded-xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-text">
            {objective ? 'Editar objetivo' : 'Nuevo objetivo'}
          </h2>
          <button onClick={onClose} className="text-muted hover:text-text transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Client */}
          <div>
            <label className={labelCls}>Cliente <span className="text-danger">*</span></label>
            <select
              value={form.client_id}
              onChange={(e) => setForm((p) => ({ ...p, client_id: e.target.value }))}
              disabled={!!objective}
              className={inputCls}
            >
              <option value="">— Seleccionar —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Assigned to */}
          <div>
            <label className={labelCls}>Responsable</label>
            <select
              value={form.assigned_to}
              onChange={(e) => setForm((p) => ({ ...p, assigned_to: e.target.value }))}
              className={inputCls}
            >
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>

          {/* Metric type */}
          <div>
            <label className={labelCls}>Tipo de métrica</label>
            <select
              value={form.metric_type}
              onChange={(e) => setForm((p) => ({ ...p, metric_type: e.target.value as MetricType }))}
              className={inputCls}
            >
              {Object.entries(METRIC_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          {/* Custom label */}
          {form.metric_type === 'personalizado' && (
            <div>
              <label className={labelCls}>Nombre de la métrica</label>
              <input
                type="text" value={form.metric_label}
                onChange={(e) => setForm((p) => ({ ...p, metric_label: e.target.value }))}
                placeholder="Ej: ROAS, Lead calificado..." className={inputCls}
              />
            </div>
          )}

          {/* Period */}
          <div>
            <label className={labelCls}>Período</label>
            <div className="flex gap-2 mb-2">
              {(['semanal', 'mensual'] as const).map((pt) => (
                <button
                  key={pt} type="button"
                  onClick={() => setForm((p) => ({ ...p, period_type: pt }))}
                  className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors ${
                    form.period_type === pt
                      ? 'bg-yesica/15 text-yesica border-yesica/30'
                      : 'bg-surface-2 text-muted border-border hover:border-muted'
                  }`}
                >
                  {pt.charAt(0).toUpperCase() + pt.slice(1)}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>Inicio</label>
                <input
                  type="date" value={form.period_start}
                  onChange={(e) => setForm((p) => ({ ...p, period_start: e.target.value }))}
                  required className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Fin</label>
                <input
                  type="date" value={form.period_end}
                  onChange={(e) => setForm((p) => ({ ...p, period_end: e.target.value }))}
                  required className={inputCls}
                />
              </div>
            </div>
          </div>

          {/* Values */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className={labelCls}>Valor actual</label>
              <input
                type="number" step="any" value={form.current_value}
                onChange={(e) => setForm((p) => ({ ...p, current_value: e.target.value }))}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Objetivo <span className="text-danger">*</span></label>
              <input
                type="number" step="any" value={form.target_value}
                onChange={(e) => setForm((p) => ({ ...p, target_value: e.target.value }))}
                required className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Último valor</label>
              <input
                type="number" step="any" value={form.latest_value}
                onChange={(e) => setForm((p) => ({ ...p, latest_value: e.target.value }))}
                placeholder="Actualizar"
                className={inputCls}
              />
            </div>
          </div>

          {/* Status (only when editing) */}
          {objective && (
            <div>
              <label className={labelCls}>Estado</label>
              <div className="flex gap-2">
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value} type="button"
                    onClick={() => setForm((p) => ({ ...p, status: opt.value }))}
                    className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors ${
                      form.status === opt.value
                        ? 'bg-yesica/15 text-yesica border-yesica/30'
                        : 'bg-surface-2 text-muted border-border hover:border-muted'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <p className="text-danger text-sm bg-danger/10 border border-danger/20 px-3 py-2 rounded-lg">{error}</p>
          )}

          <div className="flex items-center gap-3 pt-1">
            {objective && isAdmin && onDelete && (
              <button
                type="button" onClick={handleDelete}
                className="px-3 py-2.5 text-sm text-danger hover:bg-danger/10 border border-danger/20 rounded-lg transition-colors"
              >
                Eliminar
              </button>
            )}
            <div className="flex gap-2 ml-auto">
              <button
                type="button" onClick={onClose}
                className="px-4 py-2.5 border border-border text-muted hover:text-text rounded-lg text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit" disabled={loading}
                className="px-5 py-2.5 bg-yesica hover:bg-yesica/80 text-bg font-semibold rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                {loading ? 'Guardando...' : objective ? 'Guardar' : 'Crear objetivo'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
