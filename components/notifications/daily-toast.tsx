'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { type Notification } from '@/types/index'
import { X, CheckSquare, Bell } from 'lucide-react'

interface Props {
  notifications: Notification[]
  userId: string
}

function todayKey() {
  return `daily-notif-${new Date().toISOString().slice(0, 10)}`
}

export function DailyToast({ notifications, userId }: Props) {
  const supabase = createClient()
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (notifications.length === 0) return
    try {
      const already = sessionStorage.getItem(todayKey())
      if (!already) {
        setVisible(true)
        sessionStorage.setItem(todayKey(), '1')
      }
    } catch {
      // sessionStorage not available (private mode, etc.)
    }
  }, [notifications.length])

  async function dismiss() {
    setDismissed(true)
    setTimeout(() => setVisible(false), 300)
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false)
  }

  if (!visible) return null

  return (
    <div
      className="fixed top-4 right-4 z-50 w-80 bg-surface border border-border rounded-xl shadow-2xl overflow-hidden transition-all duration-300"
      style={{
        opacity: dismissed ? 0 : 1,
        transform: dismissed ? 'translateY(-8px)' : 'translateY(0)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Bell size={14} className="text-yesica" />
          <span className="text-sm font-semibold text-text">Novedades del día</span>
          <span className="text-[11px] bg-yesica/15 text-yesica px-1.5 py-0.5 rounded-full font-medium">
            {notifications.length}
          </span>
        </div>
        <button
          onClick={dismiss}
          className="text-muted hover:text-text transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Lista */}
      <div className="max-h-64 overflow-y-auto divide-y divide-border">
        {notifications.map((n) => (
          <div key={n.id} className="px-4 py-3 flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-yesica/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <CheckSquare size={13} className="text-yesica" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-text leading-snug">{n.title}</p>
              <p className="text-xs text-muted mt-0.5 leading-relaxed">{n.message}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-border flex items-center justify-between">
        <Link
          href="/notificaciones"
          onClick={dismiss}
          className="text-xs text-yesica hover:text-yesica/80 transition-colors"
        >
          Ver todas →
        </Link>
        <button
          onClick={dismiss}
          className="text-xs text-muted hover:text-text transition-colors"
        >
          Marcar como leídas
        </button>
      </div>
    </div>
  )
}
