'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { type TimeEntry, type Client, ACTIVITY_TYPES } from '@/types/index'
import { formatMinutes, todayAR } from '@/lib/utils'
import { Trash2, Pencil, X, Check } from 'lucide-react'

type EntryWithClient = TimeEntry & { clients: Pick<Client, 'id' | 'name'> }

interface Props {
  initialEntries: EntryWithClient[]
  allClients: Pick<Client, 'id' | 'name'>[]
  today: string
}

export function TimeLogList({ initialEntries, allClients, today }: Props) {
  const supabase = createClient()
  const [entries, setEntries] = useState(initialEntries)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{
    client_id: string; activity_type: string; start_time: string; end_time: string
  } | null>(null)
  const [saving, setSaving] = useState(false)

  // Agrupar por fecha
  const byDate: Record<string, EntryWithClient[]> = {}
  for (const e of entries) {
    if (!byDate[e.date]) byDate[e.date] = []
    byDate[e.date].push(e)
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este bloque?')) return
    await supabase.from('time_entries').delete().eq('id', id)
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }

  function startEdit(entry: EntryWithClient) {
    setEditingId(entry.id)
    setEditForm({
      client_id: entry.client_id,
      activity_type: entry.activity_type,
      start_time: entry.start_time
        ? new Date(entry.start_time).toTimeString().slice(0, 5)
        : '',
      end_time: entry.end_time
        ? new Date(entry.end_time).toTimeString().slice(0, 5)
        : '',
    })
  }

  async function handleSave(entry: EntryWithClient) {
    if (!editForm) return
    setSaving(true)

    const dateStr = entry.date
    // Usar new Date() para convertir hora local → UTC antes de guardar en Supabase
    const startISO = new Date(`${dateStr}T${editForm.start_time}:00`).toISOString()
    const endISO = editForm.end_time
      ? new Date(`${dateStr}T${editForm.end_time}:00`).toISOString()
      : null

    let durationMinutes = entry.duration_minutes
    if (endISO) {
      durationMinutes = (new Date(endISO).getTime() - new Date(startISO).getTime()) / 60000
    }

    const { data } = await supabase
      .from('time_entries')
      .update({
        client_id: editForm.client_id,
        activity_type: editForm.activity_type,
        start_time: startISO,
        end_time: endISO,
        duration_minutes: durationMinutes,
        paused_minutes: 0,
      })
      .eq('id', entry.id)
      .select('*, clients(id, name)')
      .single()

    if (data) {
      setEntries((prev) => prev.map((e) => e.id === entry.id ? data as EntryWithClient : e))
    }
    setEditingId(null)
    setEditForm(null)
    setSaving(false)
  }

  const inputCls = 'px-2 py-1 text-xs rounded-lg bg-surface border border-border text-text focus:outline-none focus:border-yesica/50'

  return (
    <div className="divide-y divide-border max-h-[520px] overflow-y-auto">
      {Object.keys(byDate).length === 0 ? (
        <p className="px-4 py-12 text-muted text-sm text-center">Sin registros en los últimos 7 días.</p>
      ) : (
        Object.entries(byDate).map(([date, dayEntries]) => {
          const dayTotal = dayEntries.reduce((s, e) => s + (e.duration_minutes ?? 0), 0)
          return (
            <div key={date}>
              <div className="px-4 py-2 bg-surface-2 flex items-center justify-between sticky top-0">
                <span className="text-xs font-semibold text-muted uppercase tracking-wide">
                  {date === today ? 'Hoy' : date}
                </span>
                <span className="text-xs font-mono text-yesica">{formatMinutes(dayTotal)}</span>
              </div>
              {dayEntries.map((entry) => (
                <div key={entry.id}>
                  {editingId === entry.id && editForm ? (
                    // Fila de edición
                    <div className="px-4 py-3 bg-surface-2/50 space-y-2">
                      <div className="flex gap-2 flex-wrap">
                        <select
                          value={editForm.client_id}
                          onChange={(e) => setEditForm((p) => p ? { ...p, client_id: e.target.value } : p)}
                          className={inputCls}
                        >
                          {allClients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <select
                          value={editForm.activity_type}
                          onChange={(e) => setEditForm((p) => p ? { ...p, activity_type: e.target.value } : p)}
                          className={inputCls}
                        >
                          {ACTIVITY_TYPES.map((a) => <option key={a} value={a}>{a}</option>)}
                          {!ACTIVITY_TYPES.includes(editForm.activity_type as typeof ACTIVITY_TYPES[number]) && (
                            <option value={editForm.activity_type}>{editForm.activity_type}</option>
                          )}
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="time" value={editForm.start_time}
                          onChange={(e) => setEditForm((p) => p ? { ...p, start_time: e.target.value } : p)}
                          className={inputCls} />
                        <span className="text-muted text-xs">→</span>
                        <input type="time" value={editForm.end_time}
                          onChange={(e) => setEditForm((p) => p ? { ...p, end_time: e.target.value } : p)}
                          className={inputCls} />
                        <button onClick={() => handleSave(entry)} disabled={saving}
                          className="p-1.5 rounded-lg bg-success/20 text-success hover:bg-success/30 transition-colors">
                          <Check size={13} />
                        </button>
                        <button onClick={() => { setEditingId(null); setEditForm(null) }}
                          className="p-1.5 rounded-lg bg-surface border border-border text-muted hover:text-text transition-colors">
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Fila normal
                    <div className="px-4 py-3 flex items-center gap-3 group hover:bg-surface-2/30 transition-colors">
                      <div className="w-1 h-8 rounded-full bg-yesica/40 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-text font-medium">{entry.clients?.name}</p>
                        <p className="text-xs text-muted">{entry.activity_type}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-mono text-yesica">
                          {entry.duration_minutes ? formatMinutes(entry.duration_minutes) : (
                            <span className="text-success animate-pulse text-xs">corriendo</span>
                          )}
                        </p>
                        <p className="text-xs text-muted">
                          {new Date(entry.start_time).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                          {entry.end_time && ` → ${new Date(entry.end_time).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`}
                        </p>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => startEdit(entry)}
                          className="p-1.5 rounded-lg text-muted hover:text-text hover:bg-surface transition-colors">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => handleDelete(entry.id)}
                          className="p-1.5 rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        })
      )}
    </div>
  )
}
