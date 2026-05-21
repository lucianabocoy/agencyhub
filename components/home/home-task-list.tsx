'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { type CheckinTask, type Client } from '@/types/index'
import { CheckCircle2, Clock, Circle } from 'lucide-react'

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
  checkinId: string
  checkoutCompleted: boolean
}

export function HomeTaskList({ tasks: initialTasks, checkinId, checkoutCompleted }: Props) {
  const supabase = createClient()
  const [tasks, setTasks] = useState(initialTasks)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  async function handleClick(task: TaskWithClient) {
    if (task.status === 'completada' || loadingId) return
    const nextStatus = STATUS_NEXT[task.status as TaskStatus]
    setLoadingId(task.id)

    await supabase
      .from('checkin_tasks')
      .update({ status: nextStatus })
      .eq('id', task.id)

    setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, status: nextStatus } : t))

    // Cuando pasa a "en_progreso", sugerirle al timer widget que pre-seleccione el cliente
    if (nextStatus === 'en_progreso') {
      window.dispatchEvent(new CustomEvent('timer-suggest', {
        detail: { clientId: task.client_id }
      }))
    }

    setLoadingId(null)
  }

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h2 className="font-semibold text-text text-sm">Tareas de hoy</h2>
        {!checkoutCompleted && (
          <span className="text-xs text-warning bg-warning/10 px-2 py-0.5 rounded-full border border-warning/20">
            Pendiente de checkout
          </span>
        )}
      </div>
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
