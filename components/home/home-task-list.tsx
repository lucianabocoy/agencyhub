'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { type CheckinTask, type Client, type Priority, PRIORITY_COLORS } from '@/types/index'
import { CheckCircle2, Clock, Circle, Plus, X } from 'lucide-react'
import { useRouter } from 'next/navigation'

type TaskStatus = 'no_iniciada' | 'en_progreso' | 'completada'

type TaskWithClient = CheckinTask & { clients: Pick<Client, 'id' | 'name'> }

const STATUS_NEXT: Record<TaskStatus, TaskStatus> = {
  no_iniciada: 'en_progreso',
  en_progreso: 'completada',
  completada: 'completada',
}

const STATUS_LABEL: Record<TaskStatus, string> = {
  completada: 'Completada',
  en_progreso: 'En progreso',
  no_iniciada: 'No iniciada',
}

function StatusIcon({ status, loading }: { status: TaskStatus; loading: boolean }) {
  if (loading) return <div className="w-4 h-4 rounded-full border-2 border-muted/40 border-t-yesica animate-spin flex-shrink-0" />
  if (status === 'completada') return <CheckCircle2 size={18} className="text-success flex-shrink-0" />
  if (status === 'en_progreso') return <Clock size={18} className="text-warning flex-shrink-0" />
  return <Circle size={18} className="text-muted flex-shrink-0 hover:text-yesica transition-colors" />
}

interface Props {
  tasks: TaskWithClient[]
  checkinId: string | null
  checkoutCompleted?: boolean
  clients: Pick<Client, 'id' | 'name'>[]
  userId: string
  today: string
}

export function HomeTaskList({ tasks: initialTasks, checkinId: initialCheckinId, checkoutCompleted = false, clients, userId, today }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [tasks, setTasks] = useState(initialTasks)
  const [checkinId, setCheckinId] = useState<string | null>(initialCheckinId)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ client_id: '', description: '', priority: 'normal' as Priority })
  const [error, setError] = useState<string | null>(null)

  async function handleClick(task: TaskWithClient) {
    if (task.status === 'completada' || loadingId) return
    const nextStatus = STATUS_NEXT[task.status as TaskStatus]
    setLoadingId(task.id)

    await supabase.from('checkin_tasks').update({ status: nextStatus }).eq('id', task.id)
    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: nextStatus } : t))

    if (nextStatus === 'en_progreso') {
      window.dispatchEvent(new CustomEvent('timer-suggest', { detail: { clientId: task.client_id } }))
    }
    setLoadingId(null)
  }

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault()
    if (!form.client_id || !form.description.trim()) {
      setError('Seleccioná un cliente y escribí una descripción.')
      return
    }
    setSaving(true)
    setError(null)

    let activeCheckinId = checkinId

    // Si no hay checkin del día, crearlo
    if (!activeCheckinId) {
      const { data: newCheckin, error: checkinErr } = await supabase
        .from('daily_checkins')
        .insert({ user_id: userId, date: today, checkin_time: new Date().toISOString() })
        .select('id')
        .single()

      if (checkinErr || !newCheckin) {
        setError('Error al crear el check-in.')
        setSaving(false)
        return
      }
      activeCheckinId = (newCheckin as { id: string }).id
      setCheckinId(activeCheckinId)
    }

    const { data: newTask, error: taskErr } = await supabase
      .from('checkin_tasks')
      .insert({
        checkin_id: activeCheckinId,
        client_id: form.client_id,
        description: form.description.trim(),
        priority: form.priority,
      })
      .select('*, clients(id, name)')
      .single()

    if (taskErr || !newTask) {
      setError('Error al guardar la tarea.')
      setSaving(false)
      return
    }

    setTasks((prev) => [...prev, newTask as TaskWithClient])
    setForm({ client_id: '', description: '', priority: 'normal' })
    setShowForm(false)
    setSaving(false)
    router.refresh()
  }

  const inputCls = 'w-full px-3 py-2 text-sm rounded-lg bg-surface border border-border text-text focus:outline-none focus:border-yesica/60'

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h2 className="font-semibold text-text text-sm">Tareas de hoy</h2>
        <div className="flex items-center gap-2">
          {checkinId && !checkoutCompleted && (
            <span className="text-xs text-warning bg-warning/10 px-2 py-0.5 rounded-full border border-warning/20">
              Pendiente de checkout
            </span>
          )}
          <button
            onClick={() => setShowForm((v) => !v)}
            className="w-6 h-6 rounded-md bg-yesica/20 hover:bg-yesica/30 border border-yesica/30 flex items-center justify-center transition-colors"
            title="Agregar tarea"
          >
            {showForm ? <X size={13} className="text-yesica" /> : <Plus size={13} className="text-yesica" />}
          </button>
        </div>
      </div>

      {/* Formulario inline */}
      {showForm && (
        <form onSubmit={handleAddTask} className="px-4 py-4 border-b border-border bg-surface-2 space-y-3">
          <select
            value={form.client_id}
            onChange={(e) => setForm((p) => ({ ...p, client_id: e.target.value }))}
            className={inputCls}
          >
            <option value="">— Seleccionar cliente —</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <input
            type="text"
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            placeholder="¿Qué vas a hacer?"
            className={inputCls}
          />

          <div className="flex gap-2">
            {(['urgente', 'normal', 'baja'] as Priority[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, priority: p }))}
                className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{
                  backgroundColor: form.priority === p ? PRIORITY_COLORS[p] + '30' : 'transparent',
                  color: form.priority === p ? PRIORITY_COLORS[p] : '#8b90a5',
                  border: `1px solid ${form.priority === p ? PRIORITY_COLORS[p] + '60' : '#1e2a70'}`,
                }}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>

          {error && (
            <p className="text-danger text-xs bg-danger/10 border border-danger/20 px-3 py-2 rounded-lg">{error}</p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-2 bg-yesica hover:bg-yesica/80 text-bg font-semibold rounded-lg transition-colors disabled:opacity-50 text-sm"
          >
            {saving ? 'Guardando...' : '+ Agregar tarea'}
          </button>
        </form>
      )}

      <div className="divide-y divide-border">
        {tasks.length === 0 ? (
          <p className="px-4 py-8 text-muted text-sm text-center">Sin tareas planificadas hoy.</p>
        ) : (
          tasks.map((task) => {
            const status = task.status as TaskStatus
            const isDone = status === 'completada'
            const isLoading = loadingId === task.id

            return (
              <div
                key={task.id}
                className={`px-4 py-3 flex items-start gap-3 ${!isDone ? 'cursor-pointer hover:bg-surface-2 transition-colors' : 'opacity-60'}`}
                onClick={() => handleClick(task)}
              >
                <div className="mt-0.5">
                  <StatusIcon status={status} loading={isLoading} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${isDone ? 'line-through text-muted' : 'text-text'}`}>
                    {task.description}
                  </p>
                  <p className="text-xs text-muted mt-0.5">{task.clients?.name}</p>
                </div>
                <span className={`text-xs whitespace-nowrap ${
                  status === 'en_progreso' ? 'text-warning' :
                  status === 'completada' ? 'text-success' : 'text-muted'
                }`}>
                  {STATUS_LABEL[status]}
                </span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
