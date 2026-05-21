export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { type Notification } from '@/types/index'
import { NotificationsView } from '@/components/notifications/notifications-view'

export default async function NotificacionesPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', authUser.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const notifications = (data ?? []) as Notification[]

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-text">Notificaciones</h1>
          <p className="text-muted text-sm mt-0.5">
            {notifications.filter((n) => !n.read).length} sin leer
          </p>
        </div>
      </div>
      <NotificationsView notifications={notifications} userId={authUser.id} />
    </div>
  )
}
