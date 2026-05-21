'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { type Client, type Priority, PRIORITY_COLORS } from '@/types/index'

interface CheckinTask {
  client_id: string
  description: string
  priority: Priority
}

const EMPTY_TASK = (): CheckinTask => ({
  client_id: '',
  description: '',
  priority: 'normal',
})

interface CheckinGateProps {
  userId: string
  today: string
  clients: Pick<Client, 'id' | 'name'>[]
  userName: string
}

export function CheckinGate({ userId, today, clients, userName }: CheckinGateProps) {
  const router = useRouter()
  const supabase = createClient()

  const [tasks, setTasks] = useState<CheckinTask[]>([EMPTY_TASK(), EMPTY_TASK(), EMPTY_TASK()])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches'
  const firstName = userName.split(' ')[0]

  function setTask(index: number, field: keyof CheckinTask, value: string) {
    setTasks((prev) => prev.map((t, i) => (i === index ? { ...t, [field]: value } : t)))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const filled = tasks.filter((t) => t.client_id && t.description.trim())
    if (filled.length < 1) {
      setError('Cargá al menos 1 tarea para comenzar el día.')
      return
    }

    setLoading(true)
    setError(null)

    // Crear check-in
    const { data: checkin, error: checkinError } = await supabase
      .from('daily_checkins')
      .insert({ user_id: userId, date: today, checkin_time: new Date().toISOString() })
      .select('id')
      .single()

    if (checkinError || !checkin) {
      setError('Error al registrar el check-in. Intentá de nuevo.')
      setLoading(false)
      return
    }

    const checkinId = (checkin as { id: string }).id

    // Crear tareas del check-in
    const taskRows = filled.map((t) => ({
      checkin_id: checkinId,
      client_id: t.client_id,
      description: t.description.trim(),
      priority: t.priority,
    }))

    const { error: tasksError } = await supabase.from('checkin_tasks').insert(taskRows)
    if (tasksError) {
      setError('Error al guardar las tareas.')
      setLoading(false)
      return
    }

    router.refresh()
  }

  return (
    <div className="fixed inset-0 z-50 bg-bg/95 backdrop-blur flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-surface border border-border rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border">
          <p className="text-muted text-sm">{today} · {greeting},</p>
          <h2 className="text-text text-xl font-bold mt-0.5">
            {firstName ? `${greeting}, ${firstName} 👋` : `${greeting} 👋`}
          </h2>
          <p className="text-muted text-sm mt-1">
            Para comenzar tu día, contame qué vas a hacer hoy.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {tasks.map((task, i) => (
            <div key={i} className="bg-surface-2 rounded-xl p-4 space-y-3">
              <p className="text-muted text-xs font-medium uppercase tracking-wide">
                Tarea {i + 1} {i === 0 && <span className="text-danger">*</span>}
              </p>

              <select
                value={task.client_id}
                onChange={(e) => setTask(i, 'client_id', e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg"
              >
                <option value="">— Seleccionar cliente —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              <input
                type="text"
                value={task.description}
                onChange={(e) => setTask(i, 'description', e.target.value)}
                placeholder="¿Qué vas a hacer?"
                className="w-full px-3 py-2 text-sm rounded-lg"
              />

              <div className="flex gap-2">
                {(['urgente', 'normal', 'baja'] as Priority[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setTask(i, 'priority', p)}
                    className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    style={{
                      backgroundColor: task.priority === p ? PRIORITY_COLORS[p] + '30' : 'transparent',
                      color: task.priority === p ? PRIORITY_COLORS[p] : '#8b90a5',
                      border: `1px solid ${task.priority === p ? PRIORITY_COLORS[p] + '60' : '#2d3244'}`,
                    }}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {error && (
            <p className="text-danger text-sm bg-danger/10 border border-danger/20 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-yesica hover:bg-yesica/80 text-bg font-semibold rounded-xl transition-colors disabled:opacity-50 text-sm"
          >
            {loading ? 'Registrando...' : '✓ Comenzar mi día'}
          </button>
        </form>
      </div>
    </div>
  )
}
