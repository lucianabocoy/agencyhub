'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { type User, type CampaignChangeWithUser } from '@/types/index'
import { Plus, Trash2, ChevronDown } from 'lucide-react'

interface Props {
  clientId: string
  currentUserId: string
  users: Pick<User, 'id' | 'name' | 'color' | 'avatar_url'>[]
  initialChanges: CampaignChangeWithUser[]
}

function getMonthKey(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function formatMonthLabel(key: string) {
  const [y, m] = key.split('-')
  const d = new Date(Number(y), Number(m) - 1, 1)
  return d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
    .replace(/^\w/, (c) => c.toUpperCase())
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

export function RegistroCambios({ clientId, currentUserId, users, initialChanges }: Props) {
  const supabase = createClient()
  const [changes, setChanges] = useState(initialChanges)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ date: today(), user_id: currentUserId, action: '' })

  // Group by month, most recent first
  const months = [...new Set(changes.map((c) => getMonthKey(c.date)))]
    .sort((a, b) => b.localeCompare(a))

  const [activeMonth, setActiveMonth] = useState<string>(months[0] ?? getMonthKey(today()))

  const changesInMonth = changes
    .filter((c) => getMonthKey(c.date) === activeMonth)
    .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at))

  const allMonths = [...new Set([...months, getMonthKey(today())])]
    .sort((a, b) => b.localeCompare(a))

  const handleAdd = useCallback(async () => {
    if (!form.action.trim()) return
    setLoading(true)

    const { data, error } = await supabase
      .from('campaign_changes')
      .insert({ client_id: clientId, date: form.date, user_id: form.user_id, action: form.action.trim() })
      .select('*, users(id, name, color, avatar_url)')
      .single()

    if (!error && data) {
      setChanges((prev) => [data as CampaignChangeWithUser, ...prev])
      const newMonthKey = getMonthKey(form.date)
      setActiveMonth(newMonthKey)
      setForm({ date: today(), user_id: currentUserId, action: '' })
      setShowForm(false)
    }
    setLoading(false)
  }, [supabase, clientId, form, currentUserId])

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('¿Eliminar este cambio?')) return
    await supabase.from('campaign_changes').delete().eq('id', id)
    setChanges((prev) => prev.filter((c) => c.id !== id))
  }, [supabase])

  const inputCls = 'w-full px-3 py-2 text-sm rounded-lg bg-surface-2 border border-border text-text focus:outline-none focus:border-yesica/50'

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-border flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text">Registro de cambios</h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-yesica/15 hover:bg-yesica/25 text-yesica rounded-lg transition-colors font-medium"
        >
          <Plus size={12} /> Agregar
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="px-5 py-4 border-b border-border bg-surface-2/50 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Fecha</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Encargada</label>
              <select
                value={form.user_id}
                onChange={(e) => setForm((p) => ({ ...p, user_id: e.target.value }))}
                className={inputCls}
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name.split(' ')[0]}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Acción / Cambio</label>
            <textarea
              value={form.action}
              onChange={(e) => setForm((p) => ({ ...p, action: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAdd() }}
              rows={2}
              placeholder="Ej: Se pausaron los anuncios del conjunto A por bajo rendimiento..."
              className={`${inputCls} resize-none`}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowForm(false)}
              className="px-3 py-2 text-xs text-muted hover:text-text border border-border rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleAdd}
              disabled={loading || !form.action.trim()}
              className="px-4 py-2 text-xs bg-yesica hover:bg-yesica/80 text-bg font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      {/* Month tabs */}
      {allMonths.length > 0 && (
        <div className="flex gap-1 px-4 pt-3 pb-0 overflow-x-auto">
          {allMonths.map((m) => (
            <button
              key={m}
              onClick={() => setActiveMonth(m)}
              className={`px-3 py-1.5 text-xs font-medium rounded-t-lg border-b-2 transition-colors whitespace-nowrap ${
                activeMonth === m
                  ? 'border-yesica text-yesica'
                  : 'border-transparent text-muted hover:text-text'
              }`}
            >
              {formatMonthLabel(m)}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      {changesInMonth.length === 0 ? (
        <p className="px-5 py-10 text-sm text-muted text-center">
          Sin cambios registrados en {formatMonthLabel(activeMonth)}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-2.5 text-left text-xs font-medium text-muted uppercase tracking-wide w-32">Fecha</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted uppercase tracking-wide w-28">Encargada</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted uppercase tracking-wide">Acción</th>
                <th className="px-4 py-2.5 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {changesInMonth.map((c) => {
                const u = c.users
                const d = new Date(c.date + 'T00:00:00')
                const canDelete = c.user_id === currentUserId
                return (
                  <tr key={c.id} className="group hover:bg-surface-2/40 transition-colors">
                    <td className="px-5 py-3 text-xs text-muted tabular-nums whitespace-nowrap">
                      {d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium text-bg"
                        style={{ backgroundColor: u?.color ?? '#818cf8' }}
                      >
                        <span className="w-3.5 h-3.5 rounded-full bg-white/20 flex items-center justify-center text-[8px] font-bold">
                          {(u?.name ?? '?').slice(0, 1).toUpperCase()}
                        </span>
                        {u?.name?.split(' ')[0] ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-text leading-snug">{c.action}</td>
                    <td className="px-4 py-3">
                      {canDelete && (
                        <button
                          onClick={() => handleDelete(c.id)}
                          className="opacity-0 group-hover:opacity-100 text-muted hover:text-danger transition-all"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
