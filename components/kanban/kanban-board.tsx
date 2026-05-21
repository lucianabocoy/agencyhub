'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  type KanbanTask, type KanbanSection, type Client, type User,
  type Priority, PRIORITY_COLORS,
} from '@/types/index'
import { TaskModal, type TaskFull } from './task-modal'
import { Plus, MessageSquare, Calendar, SlidersHorizontal } from 'lucide-react'

const SECTIONS: { key: KanbanSection; label: string; color: string }[] = [
  { key: 'info', label: 'Información', color: '#60a5fa' },
  { key: 'tareas', label: 'Pendientes', color: '#fbbf24' },
  { key: 'en_proceso', label: 'En proceso', color: '#818cf8' },
  { key: 'completadas', label: 'Completadas', color: '#34d399' },
  { key: 'reuniones', label: 'Reuniones', color: '#f472b6' },
]

interface Props {
  initialTasks: TaskFull[]
  clients: Pick<Client, 'id' | 'name'>[]
  users: Pick<User, 'id' | 'name' | 'color' | 'avatar_url'>[]
  currentUserId: string
  isAdmin: boolean
  initialClientId?: string
}

export function KanbanBoard({
  initialTasks, clients, users, currentUserId, isAdmin, initialClientId,
}: Props) {
  const supabase = createClient()
  const [tasks, setTasks] = useState(initialTasks)
  const [clientFilter, setClientFilter] = useState(initialClientId ?? '')
  const [userFilter, setUserFilter] = useState('')
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<KanbanSection | null>(null)
  const [modal, setModal] = useState<
    null | { mode: 'create'; section: KanbanSection } | { mode: 'edit'; task: TaskFull }
  >(null)

  const filteredTasks = tasks
    .filter((t) => !clientFilter || t.client_id === clientFilter)
    .filter((t) => !userFilter || t.assignees?.some((a) => a.user_id === userFilter))

  function tasksInSection(section: KanbanSection) {
    return filteredTasks
      .filter((t) => t.section === section)
      .sort((a, b) => a.position - b.position)
  }

  // Drag handlers
  function onDragStart(e: React.DragEvent, id: string) {
    setDraggedId(id)
    e.dataTransfer.effectAllowed = 'move'
  }

  function onDragOver(e: React.DragEvent, section: KanbanSection) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOver(section)
  }

  function onDragLeave() {
    setDragOver(null)
  }

  async function onDrop(e: React.DragEvent, section: KanbanSection) {
    e.preventDefault()
    setDragOver(null)
    if (!draggedId) return

    const task = tasks.find((t) => t.id === draggedId)
    if (!task || task.section === section) { setDraggedId(null); return }

    const sectionTasks = tasks.filter((t) => t.section === section)
    const newPosition = sectionTasks.length > 0
      ? Math.max(...sectionTasks.map((t) => t.position)) + 1000
      : 0

    const updates: Partial<KanbanTask> = {
      section,
      position: newPosition,
      completed_at: section === 'completadas' && !task.completed_at
        ? new Date().toISOString()
        : task.completed_at,
    }

    setTasks((prev) => prev.map((t) => t.id === draggedId ? { ...t, ...updates } : t))
    setDraggedId(null)

    await supabase
      .from('kanban_tasks')
      .update(updates)
      .eq('id', draggedId)
  }

  function handleSave(saved: TaskFull) {
    setTasks((prev) => {
      const exists = prev.find((t) => t.id === saved.id)
      if (exists) return prev.map((t) => t.id === saved.id ? saved : t)
      return [saved, ...prev]
    })
    setModal(null)
  }

  function handleDelete(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id))
    setModal(null)
  }

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Top bar */}
      <div className="flex items-center gap-3 flex-shrink-0 flex-wrap">
        <h1 className="text-xl font-bold text-text">Kanban</h1>
        <div className="flex items-center gap-2 ml-auto flex-wrap">

          {/* Filtro por responsable */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setUserFilter('')}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors"
              style={{
                backgroundColor: userFilter === '' ? '#818cf825' : 'transparent',
                borderColor: userFilter === '' ? '#818cf860' : '#2d3244',
                color: userFilter === '' ? '#818cf8' : '#8b90a5',
              }}
            >
              Todos
            </button>
            <button
              onClick={() => setUserFilter(userFilter === currentUserId ? '' : currentUserId)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors"
              style={{
                backgroundColor: userFilter === currentUserId ? '#818cf825' : 'transparent',
                borderColor: userFilter === currentUserId ? '#818cf860' : '#2d3244',
                color: userFilter === currentUserId ? '#818cf8' : '#8b90a5',
              }}
            >
              Solo mis tareas
            </button>
            {users.filter((u) => u.id !== currentUserId).map((u) => (
              <button
                key={u.id}
                onClick={() => setUserFilter(userFilter === u.id ? '' : u.id)}
                title={u.name}
                className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-bg transition-all border-2"
                style={{
                  backgroundColor: u.color ?? '#818cf8',
                  borderColor: userFilter === u.id ? '#ffffff' : 'transparent',
                  opacity: userFilter && userFilter !== u.id ? 0.4 : 1,
                }}
              >
                {u.name.slice(0, 2).toUpperCase()}
              </button>
            ))}
          </div>

          <div className="w-px h-5 bg-border" />

          <SlidersHorizontal size={14} className="text-muted" />
          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-surface border border-border rounded-lg text-text focus:outline-none focus:border-yesica/50"
          >
            <option value="">Todos los clientes</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button
            onClick={() => setModal({ mode: 'create', section: 'tareas' })}
            className="flex items-center gap-1.5 px-3 py-2 bg-yesica/15 hover:bg-yesica/25 text-yesica rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={15} /> Nueva tarea
          </button>
        </div>
      </div>

      {/* Board */}
      <div className="flex gap-4 flex-1 overflow-x-auto pb-2">
        {SECTIONS.map((sec) => {
          const sectionTasks = tasksInSection(sec.key)
          const isDragTarget = dragOver === sec.key

          return (
            <div
              key={sec.key}
              className={`flex-shrink-0 w-68 flex flex-col rounded-xl border transition-colors ${
                isDragTarget ? 'border-yesica/40 bg-yesica/5' : 'border-border bg-surface'
              }`}
              style={{ width: '272px' }}
              onDragOver={(e) => onDragOver(e, sec.key)}
              onDragLeave={onDragLeave}
              onDrop={(e) => onDrop(e, sec.key)}
            >
              {/* Column header */}
              <div className="px-3 py-2.5 border-b border-border flex items-center gap-2">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: sec.color }} />
                <h3 className="text-xs font-semibold text-text flex-1">{sec.label}</h3>
                <span className="text-xs text-muted">{sectionTasks.length}</span>
                <button
                  onClick={() => setModal({ mode: 'create', section: sec.key })}
                  className="text-muted hover:text-text transition-colors ml-1"
                >
                  <Plus size={13} />
                </button>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {sectionTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    isDragging={draggedId === task.id}
                    showClient={!clientFilter}
                    onDragStart={onDragStart}
                    onClick={() => setModal({ mode: 'edit', task })}
                  />
                ))}

                {sectionTasks.length === 0 && (
                  <div
                    className={`h-16 rounded-lg border-2 border-dashed flex items-center justify-center transition-colors ${
                      isDragTarget ? 'border-yesica/40 bg-yesica/5' : 'border-border/40'
                    }`}
                  >
                    <span className="text-xs text-muted/60">
                      {isDragTarget ? 'Soltar aquí' : 'Sin tareas'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal */}
      {modal !== null && (
        <TaskModal
          task={modal.mode === 'edit' ? modal.task : null}
          defaultSection={modal.mode === 'create' ? modal.section : undefined}
          defaultClientId={clientFilter || undefined}
          clients={clients}
          users={users}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          onClose={() => setModal(null)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}

// ─── Task Card ────────────────────────────────────────────────────────────────

interface CardProps {
  task: TaskFull
  isDragging: boolean
  showClient: boolean
  onDragStart: (e: React.DragEvent, id: string) => void
  onClick: () => void
}

function TaskCard({ task, isDragging, showClient, onDragStart, onClick }: CardProps) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const isOverdue = task.due_date && task.section !== 'completadas'
    && new Date(task.due_date + 'T00:00:00') < today

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      onClick={onClick}
      className={`bg-surface-2 border border-border rounded-lg p-3 cursor-pointer hover:border-muted/50 transition-all select-none ${
        isDragging ? 'opacity-40 scale-95' : ''
      }`}
    >
      {/* Priority + title */}
      <div className="flex items-start gap-2 mb-2">
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5"
          style={{ backgroundColor: PRIORITY_COLORS[task.priority as Priority] }}
        />
        <p className="text-sm text-text font-medium leading-snug line-clamp-2 flex-1">
          {task.title}
        </p>
      </div>

      {/* Client label */}
      {showClient && task.clients && (
        <p className="text-[11px] text-muted mb-2 truncate">{task.clients.name}</p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 mt-2">
        <div className="flex items-center gap-2">
          {/* Due date */}
          {task.due_date && (
            <span className={`flex items-center gap-0.5 text-[10px] ${isOverdue ? 'text-danger' : 'text-muted'}`}>
              <Calendar size={10} />
              {new Date(task.due_date + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
            </span>
          )}

          {/* Comments */}
          {task.kanban_comments.length > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted">
              <MessageSquare size={10} />
              {task.kanban_comments.length}
            </span>
          )}
        </div>

        {/* Assignees */}
        <div className="flex -space-x-1">
          {task.assignees.slice(0, 3).map((a) => (
            <div
              key={a.user_id}
              className="w-5 h-5 rounded-full border border-surface-2 flex items-center justify-center text-[8px] font-bold text-bg"
              style={{ backgroundColor: a.users?.color ?? '#818cf8' }}
              title={a.users?.name}
            >
              {(a.users?.name ?? '?').slice(0, 2).toUpperCase()}
            </div>
          ))}
          {task.assignees.length > 3 && (
            <div className="w-5 h-5 rounded-full border border-surface-2 bg-surface flex items-center justify-center text-[8px] text-muted">
              +{task.assignees.length - 3}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
