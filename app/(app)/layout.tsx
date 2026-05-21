export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'
import { TimerWidget } from '@/components/timer/timer-widget'
import { type User, type Client, type ClientAssignment } from '@/types/index'
import { CheckinGate } from '@/components/checkin/checkin-gate'
import { todayAR } from '@/lib/utils'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single()

  if (!profile) redirect('/login')
  const typedProfile = profile as User

  // Verificar check-in del día
  const today = todayAR()
  const { data: checkin } = await supabase
    .from('daily_checkins')
    .select('id, checkout_completed')
    .eq('user_id', authUser.id)
    .eq('date', today)
    .single()

  // Unread notifications count
  const { count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', authUser.id)
    .eq('read', false)

  // Clientes asignados para el timer (admin ve todos los activos, trafficker solo los suyos)
  let assignedClients: Client[] = []
  if (typedProfile.role === 'admin') {
    const { data } = await supabase
      .from('clients')
      .select('*')
      .eq('status', 'activo')
      .order('name')
    assignedClients = (data ?? []) as Client[]
  } else {
    const { data: assignments } = await supabase
      .from('client_assignments')
      .select('client_id')
      .eq('user_id', authUser.id)
    const clientIds = ((assignments ?? []) as Pick<ClientAssignment, 'client_id'>[]).map((a) => a.client_id)
    if (clientIds.length > 0) {
      const { data } = await supabase
        .from('clients')
        .select('*')
        .in('id', clientIds)
        .eq('status', 'activo')
        .order('name')
      assignedClients = (data ?? []) as Client[]
    }
  }

  const hasCheckin = !!checkin

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <Sidebar
        role={typedProfile.role}
        userName={typedProfile.name}
        color={typedProfile.color ?? '#818cf8'}
        unreadCount={count ?? 0}
      />
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <TimerWidget userId={authUser.id} assignedClients={assignedClients} />
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>

      {/* Check-in gate — bloquea si no hizo check-in */}
      {!hasCheckin && (
        <CheckinGate
          userId={authUser.id}
          today={today}
          clients={assignedClients.map((c) => ({ id: c.id, name: c.name }))}
          userName={typedProfile.name}
        />
      )}
    </div>
  )
}
