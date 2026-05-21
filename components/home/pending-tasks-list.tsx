'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle2, Circle } from 'lucide-react'

export interface PendingTask {
  id: string
  description: string
  client_name: string
  date: string
  status: 'no_iniciada' | 'en_progreso'
  user_name?: string
  user_color?: string
}

interface Props {
  tasks: PendingTask[]
  showUser?: boolean
}

export function PendingTasksList({ tasks: initialTasks, showUser }: Props) {
  const supabase = createClient()
  const [tasks, setTasks] = useState(initialTasks)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  async function markDone(id: string) {
    setLoadingId(id)
    await supabase.from('checkin_tasks').update({ status: 'completada' }).eq('id', id)
    setTasks((prev) => prev.filter((t) => t.id !== id))
    setLoadingId(null)
  }

  if (tasks.length === 0) return null

  return (
    <div className="bg-surface border border-danger/20 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-danger/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-danger" />
          <h2 className="font-semibold text-text text-sm">
            Pendientes de días anteriores
            <span className="ml-2 text-xs font-normal text-danger bg-danger/10 px-1.5 py-0.5 rounded-full">
              {tasks.length}
            </span>
          </h2>
        </div>
      </div>
      <div className="divide-y divide-border">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="px-4 py-3 flex items-start gap-3 hover:bg-surface-2/40 transition-colors"
          >
            <button
              onClick={() => markDone(task.id)}
              disabled={loadingId === task.id}
              className="mt-0.5 flex-shrink-0 text-muted hover:text-success transition-colors disabled:opacity-40"
              title="Marcar como completada"
            >
              {loadingId === task.id
                ? <div className="w-[18px] h-[18px] rounded-full border-2 border-muted/40 border-t-success animate-spin" />
                : <Circle size={18} />
              }
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-text">{task.description}</p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-xs text-muted">{task.client_name}</span>
                <span className="text-muted text-xs">·</span>
                <span className="text-xs text-muted">{task.date}</span>
                {showUser && task.user_name && (
                  <>
                    <span className="text-muted text-xs">·</span>
                    <span
                      className="text-xs font-medium px-1.5 py-0.5 rounded-full"
                      style={{ backgroundColor: (task.user_color ?? '#818cf8') + '25', color: task.user_color ?? '#818cf8' }}
                    >
                      {task.user_name}
                    </span>
                  </>
                )}
              </div>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
              task.status === 'en_progreso'
                ? 'bg-warning/10 text-warning'
                : 'bg-surface-2 text-muted'
            }`}>
              {task.status === 'en_progreso' ? 'En progreso' : 'No iniciada'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
