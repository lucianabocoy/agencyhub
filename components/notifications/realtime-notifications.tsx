'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { type Notification } from '@/types/index'
import { X, Check, MessageSquare, CheckSquare, Bell } from 'lucide-react'

interface ToastNotif extends Notification {
  visible: boolean
}

interface Props {
  userId: string
}

export function RealtimeNotifications({ userId }: Props) {
  const supabase = createClient()
  const [toasts, setToasts] = useState<ToastNotif[]>([])

  const dismiss = useCallback(async (id: string, markRead = false) => {
    setToasts((prev) => prev.map((t) => t.id === id ? { ...t, visible: false } : t))
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 350)
    if (markRead) {
      await supabase.from('notifications').update({ read: true }).eq('id', id)
    }
  }, [supabase])

  useEffect(() => {
    const channel = supabase
      .channel(`notif-${userId}`)
      .on(
        'postgres_changes' as 'system',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload: { new: Notification }) => {
          const notif: ToastNotif = { ...payload.new, visible: true }
          setToasts((prev) => [...prev.slice(-3), notif])
          // Auto-dismiss after 12 seconds
          setTimeout(() => dismiss(notif.id), 12000)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId, supabase, dismiss])

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-[60] flex flex-col gap-2 w-80">
      {toasts.map((toast) => {
        const isMention = toast.type === 'task_mentioned'
        const Icon = isMention ? MessageSquare : CheckSquare

        return (
          <div
            key={toast.id}
            className="bg-surface border border-border rounded-xl shadow-2xl overflow-hidden transition-all duration-300"
            style={{
              opacity: toast.visible ? 1 : 0,
              transform: toast.visible ? 'translateY(0) scale(1)' : 'translateY(-10px) scale(0.96)',
            }}
          >
            {/* Accent bar */}
            <div className="h-0.5 bg-yesica w-full" />

            <div className="flex items-start gap-3 p-4">
              <div className="w-8 h-8 rounded-lg bg-yesica/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Icon size={14} className="text-yesica" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-text leading-snug">{toast.title}</p>
                <p className="text-xs text-muted mt-1 leading-relaxed line-clamp-3">{toast.message}</p>
              </div>

              <div className="flex flex-col gap-1 flex-shrink-0 ml-1">
                {/* Tilde = marcar como vista */}
                <button
                  onClick={() => dismiss(toast.id, true)}
                  title="Marcar como vista"
                  className="w-6 h-6 rounded-md bg-success/15 hover:bg-success/30 text-success flex items-center justify-center transition-colors"
                >
                  <Check size={12} />
                </button>
                {/* X = solo cerrar el toast (queda sin leer) */}
                <button
                  onClick={() => dismiss(toast.id, false)}
                  title="Cerrar"
                  className="w-6 h-6 rounded-md hover:bg-surface-2 text-muted hover:text-text flex items-center justify-center transition-colors"
                >
                  <X size={11} />
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
