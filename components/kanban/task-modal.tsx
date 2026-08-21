'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  type KanbanTask, type KanbanComment, type User, type Client,
  type KanbanSection, type Priority, ACTIVITY_TYPES,
} from '@/types/index'
import { X, Plus, Trash2, Send, ExternalLink, AtSign } from 'lucide-react'

function renderCommentContent(content: string) {
  const parts = content.split(/(@\w+)/g)
  return parts.map((part, i) =>
    /^@\w+/.test(part)
      ? <span key={i} className="text-yesica font-medium">{part}</span>
      : <span key={i}>{part}</span>
  )
}

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

const AGENCIA_CLIENT_ID = '1881f6c4-c635-44a6-8032-a4930ced612c'

const SECTIONS: { value: KanbanSection; label: string; onlyFor?: string }[] = [
  { value: 'info', label: 'Información' },
  { value: 'tareas', label: 'Pendientes' },
  { value: 'en_proceso', label: 'En proceso' },
  { value: 'completadas', label: 'Completadas' },
  { value: 'reuniones', label: 'Reuniones' },
  { value: 'reportes', label: 'Reportes' },
  { value: 'reunion_de_equipo', label: 'Reunión de equipo', onlyFor: AGENCIA_CLIENT_ID },
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
  const [mentionSearch, setMentionSearch] = useState<string | null>(null)
  const commentEndRef = useRef<HTMLDivElement>(null)
  const commentInputRef = useRef<HTMLInputElement>(null)

  const mentionCandidates = mentionSearch !== null
    ? users.filter((u) => u.name.split(' ')[0].toLowerCase().startsWith(mentionSearch))
    : []

  function handleCommentChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setNewComment(val)
    const cursor = e.target.selectionStart ?? val.length
    const before = val.slice(0, cursor)
    const m = before.match(/@(\w*)$/)
    setMentionSearch(m ? m[1].toLowerCase() : null)
  }

  function selectMention(user: Pick<User, 'id' | 'name' | 'color' | 'avatar_url'>) {
    const cursor = commentInputRef.current?.selectionStart ?? newComment.length
    const firstName = user.name.split(' ')[0]
    const before = newComment.slice(0, cursor).replace(/@\w*$/, `@${firstName} `)
    const after = newComment.slice(cursor)
    setNewComment(before + after)
    setMentionSearch(null)
    setTimeout(() => commentInputRef.current?.focus(), 0)
  }

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

    // Auto-include any link typed but not yet confirmed with "+"
    const pendingLink = newLink.trim()
    const finalLinks = pendingLink && !form.links.includes(pendingLink)
      ? [...form.links, pendingLink]
      : form.links

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
          links: finalLinks,
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
            message: `Se te asignó: "${form.title.trim()}" · ${clients.find((c) => c.id === form.client_id)?.name ?? ''}`,
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
          links: finalLinks,
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
            message: `Se te asignó: "${form.title.trim()}" · ${clients.find((c) => c.id === form.client_id)?.name ?? ''}`,
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

  async function submitComment() {
    if (!newComment.trim() || !task) return
    setSendingComment(true)

    const content = newComment.trim()
    const { data } = await supabase
      .from('kanban_comments')
      .insert({ task_id: task.id, user_id: currentUserId, content })
      .select('*, users(id, name, color, avatar_url)')
      .single()

    if (data) {
      setComments((prev) => [...prev, data as KanbanComment & { users: Pick<User, 'id' | 'name' | 'color' | 'avatar_url'> }])

      // Notify mentioned users
      const mentionedFirstNames = [...content.matchAll(/@(\w+)/g)].map((m) => m[1].toLowerCase())
      const senderName = users.find((u) => u.id === currentUserId)?.name ?? 'Alguien'
      const toNotify = users.filter(
        (u) => u.id !== currentUserId && mentionedFirstNames.includes(u.name.split(' ')[0].toLowerCase())
      )
      for (const u of toNotify) {
        await supabase.from('notifications').insert({
          user_id: u.id,
          type: 'task_mentioned',
          title: 'Te mencionaron en un comentario',
          message: `${senderName}: "${content.slice(0, 80)}${content.length > 80 ? '…' : ''}" · ${task.clients?.name ?? ''}`,
          reference_type: 'kanban_task',
          reference_id: task.id,
        })
      }

      setNewComment('')
      setMentionSearch(null)
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-bg/80 backdrop-blur-sm" onClick={onClose} />
      <form
        onSubmit={handleSubmit}
        className="relative bg-surface border border-border rounded-xl w-full max-w-4xl shadow-2xl flex flex-col"
        style={{ maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <h2 className="text-sm font-semibold text-text">
            {task ? 'Editar tarea' : 'Nueva tarea'}
          </h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-text transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Two-column body */}
        <div className="flex flex-1 min-h-0">

          {/* ── Left: Title + Description + Comments ── */}
          <div className="flex-1 flex flex-col min-w-0 border-r border-border">
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Title */}
              <div>
                <label className={labelCls}>Título <span className="text-danger">*</span></label>
                <input
                  type="text" value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="¿Qué hay que hacer?" required className={inputCls}
                />
              </div>

              {/* Description — fills available space */}
              <div className="flex flex-col flex-1">
                <label className={labelCls}>Descripción</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Detalles, contexto..."
                  className={`${inputCls} resize-none`}
                  style={{ minHeight: '280px' }}
                />
              </div>
            </div>

            {/* Comments — pinned at bottom of left col */}
            {task && (
              <div className="border-t border-border px-5 py-4 space-y-3 flex-shrink-0">
                <h3 className="text-xs font-semibold text-muted uppercase tracking-wide">
                  Comentarios ({comments.length})
                </h3>

                {comments.length > 0 && (
                  <div className="space-y-3 max-h-40 overflow-y-auto">
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
                          <p className="text-xs text-muted mt-0.5 leading-relaxed whitespace-pre-wrap">{renderCommentContent(c.content)}</p>
                        </div>
                      </div>
                    ))}
                    <div ref={commentEndRef} />
                  </div>
                )}

                {/* Comment input — not a nested form */}
                <div className="relative flex gap-2">
                  {mentionCandidates.length > 0 && (
                    <div className="absolute bottom-full mb-1 left-0 right-10 bg-surface border border-border rounded-lg shadow-xl overflow-hidden z-10">
                      {mentionCandidates.map((u) => (
                        <button
                          key={u.id} type="button"
                          onMouseDown={(e) => { e.preventDefault(); selectMention(u) }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-surface-2 transition-colors text-left"
                        >
                          <span
                            className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-bg flex-shrink-0"
                            style={{ backgroundColor: u.color ?? '#818cf8' }}
                          >
                            {u.name.slice(0, 2).toUpperCase()}
                          </span>
                          <span className="text-text">{u.name.split(' ')[0]}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex-1 relative">
                    <input
                      ref={commentInputRef}
                      type="text" value={newComment}
                      onChange={handleCommentChange}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); submitComment() }
                        if (e.key === 'Escape') setMentionSearch(null)
                      }}
                      placeholder="Agregar comentario... (@ para mencionar)"
                      className="w-full px-3 py-2 text-sm rounded-lg bg-surface-2 border border-border text-text focus:outline-none focus:border-yesica/50"
                    />
                  </div>
                  <button
                    type="button" onClick={submitComment}
                    disabled={sendingComment || !newComment.trim()}
                    className="px-3 py-2 bg-yesica/15 hover:bg-yesica/25 text-yesica rounded-lg transition-colors disabled:opacity-40"
                  >
                    <Send size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Right: metadata + actions ── */}
          <div className="w-72 flex-shrink-0 overflow-y-auto p-5 space-y-4">
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

            {/* Column */}
            <div>
              <label className={labelCls}>Columna</label>
              <select
                value={form.section}
                onChange={(e) => setForm((p) => ({ ...p, section: e.target.value as KanbanSection }))}
                className={inputCls}
              >
                {SECTIONS
                  .filter((s) => !s.onlyFor || form.client_id === s.onlyFor)
                  .map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
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

            {/* Action buttons */}
            <div className="space-y-2 pt-1">
              <button
                type="submit" disabled={loading}
                className="w-full py-2.5 bg-yesica hover:bg-yesica/80 text-bg font-semibold rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                {loading ? 'Guardando...' : task ? 'Guardar cambios' : 'Crear tarea'}
              </button>
              <button
                type="button" onClick={onClose}
                className="w-full py-2.5 border border-border text-muted hover:text-text hover:border-muted rounded-lg text-sm transition-colors"
              >
                Cancelar
              </button>
              {task && (isAdmin || task.created_by === currentUserId) && onDelete && (
                <button
                  type="button" onClick={handleDelete}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 text-sm text-danger hover:bg-danger/10 border border-danger/20 rounded-lg transition-colors"
                >
                  <Trash2 size={14} /> Eliminar tarea
                </button>
              )}
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
