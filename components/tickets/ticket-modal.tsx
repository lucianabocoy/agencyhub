'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  type Ticket, type Client, type User, type TicketStatus,
  type Priority, type TicketOrigin,
} from '@/types/index'
import { X } from 'lucide-react'

interface Props {
  ticket?: Ticket | null
  clients: Pick<Client, 'id' | 'name'>[]
  users: Pick<User, 'id' | 'name' | 'color'>[]
  currentUserId: string
  defaultClientId?: string
  onClose: () => void
  onSave: (ticket: Ticket) => void
  onDelete?: (id: string) => void
}

const PRIORITY_OPTIONS: { value: Priority; label: string; color: string }[] = [
  { value: 'urgente', label: 'Urgente', color: '#f87171' },
  { value: 'normal', label: 'Normal', color: '#60a5fa' },
  { value: 'baja', label: 'Baja', color: '#8b90a5' },
]

const ORIGIN_OPTIONS: { value: TicketOrigin; label: string }[] = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'reunion', label: 'Reunión' },
  { value: 'email', label: 'Email' },
  { value: 'interno', label: 'Interno' },
]

const STATUS_OPTIONS: { value: TicketStatus; label: string }[] = [
  { value: 'nuevo', label: 'Nuevo' },
  { value: 'en_revision', label: 'En revisión' },
  { value: 'en_proceso', label: 'En proceso' },
  { value: 'completado', label: 'Completado' },
]

export function TicketModal({
  ticket, clients, users, currentUserId, defaultClientId,
  onClose, onSave, onDelete,
}: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    client_id: ticket?.client_id ?? defaultClientId ?? '',
    title: ticket?.title ?? '',
    description: ticket?.description ?? '',
    priority: (ticket?.priority ?? 'normal') as Priority,
    origin: (ticket?.origin ?? 'interno') as TicketOrigin,
    assigned_to: ticket?.assigned_to ?? currentUserId,
    status: (ticket?.status ?? 'nuevo') as TicketStatus,
    due_date: ticket?.due_date ?? '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.client_id || !form.title.trim() || !form.assigned_to) {
      setError('Cliente, título y responsable son obligatorios.')
      return
    }
    setLoading(true)
    setError(null)

    if (ticket) {
      const updates: Partial<Ticket> = {
        title: form.title.trim(),
        description: form.description || null,
        priority: form.priority,
        origin: form.origin,
        assigned_to: form.assigned_to,
        status: form.status,
        due_date: form.due_date || null,
        completed_at: form.status === 'completado' && !ticket.completed_at
          ? new Date().toISOString()
          : ticket.completed_at,
      }
      const { data, error: err } = await supabase
        .from('tickets').update(updates).eq('id', ticket.id).select().single()
      if (err) { setError(err.message); setLoading(false); return }
      onSave(data as Ticket)
    } else {
      const { data, error: err } = await supabase
        .from('tickets')
        .insert({
          client_id: form.client_id,
          title: form.title.trim(),
          description: form.description || null,
          priority: form.priority,
          origin: form.origin,
          assigned_to: form.assigned_to,
          created_by: currentUserId,
          status: 'nuevo',
          due_date: form.due_date || null,
        })
        .select().single()
      if (err) { setError(err.message); setLoading(false); return }

      // Notification for assignee
      if (form.assigned_to !== currentUserId) {
        await supabase.from('notifications').insert({
          user_id: form.assigned_to,
          type: 'ticket_created',
          title: 'Nuevo ticket asignado',
          message: `Se te asignó el ticket: "${form.title.trim()}"`,
          reference_type: 'ticket',
          reference_id: (data as Ticket).id,
        })
      }

      onSave(data as Ticket)
    }
  }

  async function handleDelete() {
    if (!ticket || !onDelete) return
    if (!confirm('¿Eliminar este ticket?')) return
    await supabase.from('tickets').delete().eq('id', ticket.id)
    onDelete(ticket.id)
  }

  const inputCls = 'w-full px-3 py-2.5 text-sm rounded-lg bg-surface-2 border border-border text-text focus:outline-none focus:border-yesica/50'
  const labelCls = 'block text-xs font-medium text-muted mb-1.5'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-bg/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface border border-border rounded-xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-text">
            {ticket ? 'Editar ticket' : 'Nuevo ticket'}
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
              disabled={!!ticket}
              className={inputCls}
            >
              <option value="">— Seleccionar —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className={labelCls}>Título <span className="text-danger">*</span></label>
            <input
              type="text" value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="Describí el ticket..." required className={inputCls}
            />
          </div>

          {/* Description */}
          <div>
            <label className={labelCls}>Descripción</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              rows={3} placeholder="Detalles adicionales..." className={`${inputCls} resize-none`}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Priority */}
            <div>
              <label className={labelCls}>Prioridad</label>
              <div className="flex gap-2">
                {PRIORITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value} type="button"
                    onClick={() => setForm((p) => ({ ...p, priority: opt.value }))}
                    className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors ${
                      form.priority === opt.value
                        ? 'border-transparent text-bg'
                        : 'bg-surface-2 text-muted border-border hover:border-muted'
                    }`}
                    style={form.priority === opt.value ? { backgroundColor: opt.color } : {}}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Origin */}
            <div>
              <label className={labelCls}>Origen</label>
              <select
                value={form.origin}
                onChange={(e) => setForm((p) => ({ ...p, origin: e.target.value as TicketOrigin }))}
                className={inputCls}
              >
                {ORIGIN_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Assigned to */}
            <div>
              <label className={labelCls}>Responsable <span className="text-danger">*</span></label>
              <select
                value={form.assigned_to}
                onChange={(e) => setForm((p) => ({ ...p, assigned_to: e.target.value }))}
                className={inputCls}
              >
                <option value="">— Seleccionar —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>

            {/* Due date */}
            <div>
              <label className={labelCls}>Fecha límite</label>
              <input
                type="date" value={form.due_date}
                onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))}
                className={inputCls}
              />
            </div>
          </div>

          {/* Status (only when editing) */}
          {ticket && (
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
            {ticket && onDelete && (
              <button
                type="button" onClick={handleDelete}
                className="px-4 py-2.5 text-sm text-danger hover:bg-danger/10 border border-danger/20 rounded-lg transition-colors"
              >
                Eliminar
              </button>
            )}
            <div className="flex gap-2 ml-auto">
              <button
                type="button" onClick={onClose}
                className="px-4 py-2.5 border border-border text-muted hover:text-text hover:border-muted rounded-lg text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit" disabled={loading}
                className="px-5 py-2.5 bg-yesica hover:bg-yesica/80 text-bg font-semibold rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                {loading ? 'Guardando...' : ticket ? 'Guardar' : 'Crear ticket'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
