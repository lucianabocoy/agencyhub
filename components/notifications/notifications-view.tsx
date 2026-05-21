'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { type Notification, type NotificationType } from '@/types/index'
import {
  CheckSquare, Ticket, Bell, Clock, AlertTriangle, Target,
} from 'lucide-react'

const TYPE_ICON: Record<NotificationType, React.ElementType> = {
  task_assigned: CheckSquare,
  task_mentioned: CheckSquare,
  ticket_created: Ticket,
  checkin_reminder: Clock,
  checkout_reminder: Clock,
  objective_update: Target,
  client_neglect_warning: AlertTriangle,
  client_neglect_alarm: AlertTriangle,
}

const TYPE_COLOR: Record<NotificationType, string> = {
  task_assigned: 'text-yesica bg-yesica/10',
  task_mentioned: 'text-yesica bg-yesica/10',
  ticket_created: 'text-warning bg-warning/10',
  checkin_reminder: 'text-muted bg-surface-2',
  checkout_reminder: 'text-muted bg-surface-2',
  objective_update: 'text-luz bg-luz/10',
  client_neglect_warning: 'text-warning bg-warning/10',
  client_neglect_alarm: 'text-danger bg-danger/10',
}

interface Props {
  notifications: Notification[]
  userId: string
}

export function NotificationsView({ notifications: initial, userId }: Props) {
  const supabase = createClient()
  const [items, setItems] = useState(initial)

  async function markAllRead() {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false)
    setItems((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  async function markRead(id: string) {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
  }

  const unreadCount = items.filter((n) => !n.read).length

  if (items.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-xl py-16 text-center">
        <Bell size={32} className="mx-auto text-muted mb-3" />
        <p className="text-muted text-sm">Sin notificaciones</p>
      </div>
    )
  }

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      {unreadCount > 0 && (
        <div className="px-5 py-3 border-b border-border flex justify-end">
          <button
            onClick={markAllRead}
            className="text-xs text-yesica hover:text-yesica/80 transition-colors"
          >
            Marcar todo como leído
          </button>
        </div>
      )}

      <div className="divide-y divide-border">
        {items.map((n) => {
          const Icon = TYPE_ICON[n.type] ?? Bell
          const colorCls = TYPE_COLOR[n.type] ?? 'text-muted bg-surface-2'

          return (
            <button
              key={n.id}
              onClick={() => !n.read && markRead(n.id)}
              className={`w-full text-left px-5 py-4 flex items-start gap-3 transition-colors hover:bg-surface-2 ${!n.read ? 'bg-surface-2/50' : ''}`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${colorCls}`}>
                <Icon size={15} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${n.read ? 'text-muted' : 'text-text'}`}>
                  {n.title}
                </p>
                <p className="text-xs text-muted mt-0.5">{n.message}</p>
                <p className="text-xs text-muted/60 mt-1">
                  {new Date(n.created_at).toLocaleDateString('es-AR', {
                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              </div>
              {!n.read && (
                <div className="w-2 h-2 rounded-full bg-yesica flex-shrink-0 mt-1.5" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
