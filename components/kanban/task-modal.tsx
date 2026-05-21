'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  type KanbanTask, type KanbanComment, type User, type Client,
  type KanbanSection, type Priority, ACTIVITY_TYPES,
} from '@/types/index'
import { X, Plus, Trash2, Send, ExternalLink } from 'lucide-react'

export interface TaskFull extends KanbanTask {
  assignees: { id: string; user_id: string; users: Pick<User, 'id' | 'name' | 'color' | 'avatar_url'> }[]
  kanban_comments: (KanbanComment & { users: Pick<User, 'id' | 'name' | 'color' | 'avatar_url'> })[]
  clients?: Pick<Client, 'id' | 'name'> | null
}

interface Props {
  task?: TaskFull | null
  defaultSection?: KanbanSection
  defaultClientId?: string
  clients: Pick<Client, 'id' | 'name'>[]
  users: Pick<User, 'id' | 'name' | 'color' | 'avatar_url'>[]
  currentUserId: string
  isAdmin: boolean
  onClose: () => void
  onSave: (task: TaskFull) => void
  onDelete?: (id: string) => void
}

const SECTIONS: { value: KanbanSection; label: string }[] = [
  { value: 'info', label: 'Información' },
  { value: 'tareas', label: 'Pendientes' },
  { value: 'en_proceso', label: 'En proceso' },
  { value: 'completadas', label: 'Completadas' },
  { value: 'reuniones', label: 'Reuniones' },
]

const PRIORITY_OPTIONS: { value: Priority; label: string; color: string }[] = [
  { value: 'urgente', label: 'Urgente', color: '#f87171' },
  { value: 'normal', label: 'Normal', color: '#60a5fa' },
  { value: 'baja', label: 'Baja', color: '#8b90a5' },
]

export function TaskModal({
  task, defaultSection, defaultClientId, clients, users, currentUserId, isAdmin,
  onClose, onSave, onDelete,
}: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newComment, setNewComment] = useState('')
  const [sendingComment, setSendingComment] = useState(false)
  const [comments, setComments] = useState(task?.kanban_comments ?? [])
  const commentEndRef = useRef<HTMLDivElement>(null)

  const [form, setForm] = useState({
    client_id: task?.client_id ?? defaultClientId ?? '',
    section: (task?.section ?? defaultSection ?? 'tareas') as KanbanSection,
    title: task?.title ?? '',
    description: task?.description ?? '',
    priority: (task?.priority ?? 'normal') as Priority,
    due_date: task?.due_date ?? '',
    links: task?.links ?? [] as string[],
    assigneeIds: (task?.assignees ?? []).map((a) => a.user_id),
  })
  const [newLink, setNewLink] = useState('')

  function toggleAssignee(userId: string) {
    setForm((prev) => ({
      ...prev,
      assigneeIds: prev.assigneeIds.includes(userId)
        ? prev.assigneeIds.filter((id) => id !== userId)
        : [...prev.assigneeIds, userId],
    }))
  }

  function addLink() {
    const url = newLink.trim()
    if (!url || form.links.includes(url)) return
    setForm((prev) => ({ ...prev, links: [...prev.links, url] }))
    setNewLink('')
  }

  function removeLink(url: string) {
    setForm((prev) => ({ ...prev, links: prev.links.filter((l) => l !== url) }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.client_id || !form.title.trim()) {
      setError('Cliente y título son obligatorios.')
      return
    }
    setLoading(true)
    setError(null)

    if (task) {
      // Update task
      const { data, error: err } = await supabase
        .from('kanban_tasks')
        .update({
          section: form.section,
          title: form.title.trim(),
          description: form.description || null,
          priority: form.priority,
          due_date: form.due_date || null,
          links: form.links,
          completed_at: form.section === 'completadas' && !task.completed_at
            ? new Date().toISOString()
            : task.completed_at,
        })
        .eq('id', task.id)
        .select()
        .single()

      if (err) { setError(err.message); setLoading(false); return }

      // Sync assignees
      const currentIds = task.assignees.map((a) => a.user_id)
      const toAdd = form.assigneeIds.filter((id) => !currentIds.includes(id))
      const toRemove = currentIds.filter((id) => !form.assigneeIds.includes(id))

      if (toRemove.length > 0) {
        await supabase.from('kanban_task_assignees')
          .delete().eq('task_id', task.id).in('user_id', toRemove)
      }
      for (const userId of toAdd) {
        await supabase.from('kanban_task_assignees').insert({ task_id: task.id, user_id: userId })
        if (userId !== currentUserId) {
          await supabase.from('notifications').insert({
            user_id: userId,
            type: 'task_assigned',
            title: 'Tarea asignada',
            message: `Se te asignó: "${form.title.trim()}"`,
            reference_type: 'kanban_task',
            reference_id: task.id,
          })
        }
      }

      const assignees = form.assigneeIds.map((uid) => {
        const u = users.find((x) => x.id === uid)!
        return { id: '', user_id: uid, users: u }
      })

      onSave({ ...(data as KanbanTask), assignees, kanban_comments: comments, clients: task.clients ?? null })
    } else {
      // Create task
      const maxPos = Math.floor(Date.now() / 1000)
      const { data, error: err } = await supabase
        .from('kanban_tasks')
        .insert({
          client_id: form.client_id,
          section: form.section,
          title: form.title.trim(),
          description: form.description || null,
          priority: form.priority,
          due_date: form.due_date || null,
          links: form.links,
          position: maxPos,
          created_by: currentUserId,
        })
        .select()
        .single()

      if (err) { setError(err.message); setLoading(false); return }

      const taskId = (data as KanbanTask).id
      for (const userId of form.assigneeIds) {
        await supabase.from('kanban_task_assignees').insert({ task_id: taskId, user_id: userId })
        if (userId !== currentUserId) {
          await supabase.from('notifications').insert({
            user_id: userId,
            type: 'task_assigned',
            title: 'Nueva tarea asignada',
            message: `Se te asignó: "${form.title.trim()}"`,
            reference_type: 'kanban_task',
            reference_id: taskId,
          })
        }
      }

      const assignees = form.assigneeIds.map((uid) => {
        const u = users.find((x) => x.id === uid)!
        return { id: '', user_id: uid, users: u }
      })
      const clientObj = clients.find((c) => c.id === form.client_id) ?? null

      onSave({ ...(data as KanbanTask), assignees, kanban_comments: [], clients: clientObj })
    }
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault()
    if (!newComment.trim() || !task) return
    setSendingComment(true)

    const { data } = await supabase
      .from('kanban_comments')
      .insert({ task_id: task.id, user_id: currentUserId, content: newComment.trim() })
      .select('*, users(id, name, color, avatar_url)')
      .single()

    if (data) {
      setComments((prev) => [...prev, data as KanbanComment & { users: Pick<User, 'id' | 'name' | 'color' | 'avatar_url'> }])
      setNewComment('')
      setTimeout(() => commentEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
    setSendingComment(false)
  }

  async function handleDelete() {
    if (!task || !onDelete) return
    if (!confirm('¿Eliminar esta tarea?')) return
    await supabase.from('kanban_tasks').delete().eq('id', task.id)
    onDelete(task.id)
  }

  const inputCls = 'w-full px-3 py-2.5 text-sm rounded-lg bg-surface-2 border border-border text-text focus:outline-none focus:border-yesica/50'
  const labelCls = 'block text-xs font-medium text-muted mb-1.5'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-12 overflow-y-auto">
      <div className="absolute inset-0 bg-bg/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-surface border border-border rounded-xl w-full max-w-xl shadow-2xl mb-8">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-text">
            {task ? 'Editar tarea' : 'Nueva tarea'}
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
              disabled={!!task}
              className={inputCls}
            >
              <option value="">— Seleccionar —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className={labelCls}>Título <span className="text-danger">*</span></label>
            <input
              type="text" value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              placeholder="¿Qué hay que hacer?" required className={inputCls}
            />
          </div>

          {/* Description */}
          <div>
            <label className={labelCls}>Descripción</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              rows={3} placeholder="Detalles, contexto..." className={`${inputCls} resize-none`}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Section */}
            <div>
              <label className={labelCls}>Columna</label>
              <select
                value={form.section}
                onChange={(e) => setForm((p) => ({ ...p, section: e.target.value as KanbanSection }))}
                className={inputCls}
              >
                {SECTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
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

          {/* Assignees */}
          <div>
            <label className={labelCls}>Responsables</label>
            <div className="flex gap-2 flex-wrap">
              {users.map((u) => {
                const selected = form.assigneeIds.includes(u.id)
                return (
                  <button
                    key={u.id} type="button" onClick={() => toggleAssignee(u.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      selected
                        ? 'border-transparent text-bg'
                        : 'bg-surface-2 text-muted border-border hover:border-muted'
                    }`}
                    style={selected ? { backgroundColor: u.color ?? '#818cf8' } : {}}
                  >
                    <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold"
                      style={{ backgroundColor: selected ? 'rgba(255,255,255,0.3)' : (u.color ?? '#818cf8'), color: '#0f1117' }}>
                      {u.name.slice(0, 2).toUpperCase()}
                    </span>
                    {u.name.split(' ')[0]}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Links */}
          <div>
            <label className={labelCls}>Links</label>
            {form.links.length > 0 && (
              <div className="space-y-1 mb-2">
                {form.links.map((link) => (
                  <div key={link} className="flex items-center gap-2 text-xs">
                    <ExternalLink size={11} className="text-muted flex-shrink-0" />
                    <a
                      href={link} target="_blank" rel="noreferrer"
                      className="text-yesica hover:underline truncate flex-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {link}
                    </a>
                    <button
                      type="button" onClick={() => removeLink(link)}
                      className="text-muted hover:text-danger transition-colors flex-shrink-0"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="url" value={newLink}
                onChange={(e) => setNewLink(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink() } }}
                placeholder="https://..." className={`${inputCls} flex-1`}
              />
              <button
                type="button" onClick={addLink}
                className="px-3 py-2.5 bg-surface-2 border border-border hover:border-muted rounded-lg text-muted hover:text-text transition-colors"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          {error && (
            <p className="text-danger text-sm bg-danger/10 border border-danger/20 px-3 py-2 rounded-lg">{error}</p>
          )}

          <div className="flex items-center gap-3 pt-1">
            {task && (isAdmin || task.created_by === currentUserId) && onDelete && (
              <button
                type="button" onClick={handleDelete}
                className="flex items-center gap-1.5 px-3 py-2.5 text-sm text-danger hover:bg-danger/10 border border-danger/20 rounded-lg transition-colors"
              >
                <Trash2 size={14} /> Eliminar
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
                {loading ? 'Guardando...' : task ? 'Guardar' : 'Crear tarea'}
              </button>
            </div>
          </div>
        </form>

        {/* Comments section — only when editing */}
        {task && (
          <div className="border-t border-border px-5 py-4 space-y-3">
            <h3 className="text-xs font-semibold text-muted uppercase tracking-wide">
              Comentarios ({comments.length})
            </h3>

            {comments.length > 0 && (
              <div className="space-y-3 max-h-48 overflow-y-auto">
                {comments.map((c) => (
                  <div key={c.id} className="flex gap-2.5">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-bg flex-shrink-0 mt-0.5"
                      style={{ backgroundColor: c.users?.color ?? '#818cf8' }}
                    >
                      {(c.users?.name ?? '?').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs font-medium text-text">{c.users?.name}</span>
                        <span className="text-[10px] text-muted">
                          {new Date(c.created_at).toLocaleDateString('es-AR', {
                            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-muted mt-0.5 leading-relaxed whitespace-pre-wrap">{c.content}</p>
                    </div>
                  </div>
                ))}
                <div ref={commentEndRef} />
              </div>
            )}

            <form onSubmit={submitComment} className="flex gap-2">
              <input
                type="text" value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Agregar comentario..."
                className="flex-1 px-3 py-2 text-sm rounded-lg bg-surface-2 border border-border text-text focus:outline-none focus:border-yesica/50"
              />
              <button
                type="submit" disabled={sendingComment || !newComment.trim()}
                className="px-3 py-2 bg-yesica/15 hover:bg-yesica/25 text-yesica rounded-lg transition-colors disabled:opacity-40"
              >
                <Send size={14} />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
