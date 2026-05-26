export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { type User, type DailyCheckin, type CheckinTask, type Client, type ClientAssignment, type TimeEntry, type Ticket } from '@/types/index'
import { todayAR, formatMinutes } from '@/lib/utils'
import Link from 'next/link'
import { AlertCircle, CheckCircle2, Calendar } from 'lucide-react'
import { HomeTaskList } from '@/components/home/home-task-list'
import { PendingTasksList, type PendingTask } from '@/components/home/pending-tasks-list'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: profileData } = await supabase.from('users').select('*').eq('id', authUser.id).single()
  const profile = profileData as User | null
  if (!profile) redirect('/login')

  const today = todayAR()

  // Check-in de hoy
  const { data: checkinData } = await supabase
    .from('daily_checkins')
    .select('*, checkin_tasks(*, clients(id, name))')
    .eq('user_id', authUser.id)
    .eq('date', today)
    .single()

  const checkin = checkinData as (DailyCheckin & { checkin_tasks: (CheckinTask & { clients: Pick<Client, 'id' | 'name'> })[] }) | null

  // Registros de tiempo de hoy
  const { data: todayEntriesData } = await supabase
    .from('time_entries')
    .select('*, clients(id, name)')
    .eq('user_id', authUser.id)
    .eq('date', today)
    .order('start_time', { ascending: true })

  const todayEntries = (todayEntriesData ?? []) as (TimeEntry & { clients: Pick<Client, 'id' | 'name'> })[]

  const totalMinutesToday = todayEntries.reduce((sum, e) => sum + (e.duration_minutes ?? 0), 0)

  // Clientes disponibles para el usuario
  let assignedClients: Pick<Client, 'id' | 'name'>[] = []
  if (profile.role === 'admin') {
    const { data } = await supabase.from('clients').select('id, name').eq('status', 'activo').order('name')
    assignedClients = (data ?? []) as Pick<Client, 'id' | 'name'>[]
  } else {
    const { data: assignments } = await supabase.from('client_assignments').select('client_id').eq('user_id', authUser.id)
    const ids = ((assignments ?? []) as Pick<ClientAssignment, 'client_id'>[]).map((a) => a.client_id)
    if (ids.length > 0) {
      const { data } = await supabase.from('clients').select('id, name').in('id', ids).eq('status', 'activo').order('name')
      assignedClients = (data ?? []) as Pick<Client, 'id' | 'name'>[]
    }
  }

  // Tareas kanban que vencen hoy o mañana, asignadas al usuario, no completadas
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().slice(0, 10)

  const { data: kanbanDueData } = await supabase
    .from('kanban_tasks')
    .select('id, title, due_date, section, client_id, clients(name), kanban_task_assignees!inner(user_id)')
    .in('due_date', [today, tomorrowStr])
    .is('completed_at', null)
    .neq('section', 'completadas')
    .eq('kanban_task_assignees.user_id', authUser.id)
    .order('due_date', { ascending: true })

  type KanbanDueTask = { id: string; title: string; due_date: string; section: string; client_id: string; clients: { name: string } | null }
  const kanbanDueTasks = (kanbanDueData ?? []) as unknown as KanbanDueTask[]

  // Tickets asignados pendientes
  const { data: ticketsData } = await supabase
    .from('tickets')
    .select('*, clients(id, name)')
    .eq('assigned_to', authUser.id)
    .neq('status', 'completado')
    .order('created_at', { ascending: false })
    .limit(5)

  const tickets = (ticketsData ?? []) as (Ticket & { clients: Pick<Client, 'id' | 'name'> })[]

  // Tareas pendientes de días anteriores (propias)
  const { data: pendingData } = await supabase
    .from('checkin_tasks')
    .select('id, description, status, client_id, checkin_id, clients(name), daily_checkins!inner(date, user_id)')
    .eq('daily_checkins.user_id', authUser.id)
    .lt('daily_checkins.date', today)
    .neq('status', 'completada')
    .order('daily_checkins(date)', { ascending: false })
    .limit(20)

  const myPending: PendingTask[] = ((pendingData ?? []) as Record<string, unknown>[]).map((t) => ({
    id: t.id as string,
    description: t.description as string,
    status: t.status as 'no_iniciada' | 'en_progreso',
    client_name: (t.clients as { name: string } | null)?.name ?? '?',
    date: (t.daily_checkins as { date: string } | null)?.date ?? '',
  }))

  // Tareas pendientes del equipo (solo admin)
  let teamPending: PendingTask[] = []

  // Si es admin, ver check-ins del equipo
  let teamCheckins: { user: Pick<User, 'id' | 'name' | 'color'>; checkin: DailyCheckin | null }[] = []
  if (profile.role === 'admin') {
    const { data: teamPendingData } = await supabase
      .from('checkin_tasks')
      .select('id, description, status, client_id, clients(name), daily_checkins!inner(date, user_id, users(name, color))')
      .lt('daily_checkins.date', today)
      .neq('status', 'completada')
      .order('daily_checkins(date)', { ascending: false })
      .limit(50)

    teamPending = ((teamPendingData ?? []) as Record<string, unknown>[])
      .filter((t) => (t.daily_checkins as { user_id: string } | null)?.user_id !== authUser.id)
      .map((t) => {
        const dc = t.daily_checkins as { date: string; users: { name: string; color: string } | null } | null
        return {
          id: t.id as string,
          description: t.description as string,
          status: t.status as 'no_iniciada' | 'en_progreso',
          client_name: (t.clients as { name: string } | null)?.name ?? '?',
          date: dc?.date ?? '',
          user_name: dc?.users?.name ?? '?',
          user_color: dc?.users?.color ?? '#818cf8',
        }
      })

    const { data: allUsers } = await supabase
      .from('users')
      .select('id, name, color')
      .neq('id', authUser.id)

    if (allUsers) {
      for (const u of allUsers as Pick<User, 'id' | 'name' | 'color'>[]) {
        const { data: uc } = await supabase
          .from('daily_checkins')
          .select('*')
          .eq('user_id', u.id)
          .eq('date', today)
          .single()

        teamCheckins.push({ user: u, checkin: uc as DailyCheckin | null })
      }
    }
  }

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches'

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text">{greeting}, {profile.name.split(' ')[0]} 👋</h1>
        <p className="text-muted text-sm mt-0.5">{today}</p>
      </div>

      {/* KPIs del día */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            label: 'Horas hoy',
            value: formatMinutes(totalMinutesToday),
            sub: `${todayEntries.length} bloques registrados`,
            color: '#818cf8',
          },
          {
            label: 'Tareas planificadas',
            value: checkin?.checkin_tasks.length ?? 0,
            sub: `${checkin?.checkin_tasks.filter((t) => t.status === 'completada').length ?? 0} completadas`,
            color: '#34d399',
          },
          {
            label: 'Tickets pendientes',
            value: tickets.length,
            sub: `${tickets.filter((t) => t.priority === 'urgente').length} urgentes`,
            color: '#f87171',
          },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-surface border border-border rounded-xl p-4">
            <p className="text-muted text-xs font-medium uppercase tracking-wide mb-1">{kpi.label}</p>
            <p className="text-2xl font-bold font-mono" style={{ color: kpi.color }}>{kpi.value}</p>
            <p className="text-muted text-xs mt-1">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Pendientes propios de días anteriores */}
      <PendingTasksList tasks={myPending} />

      {/* Pendientes del equipo — solo admin */}
      {profile.role === 'admin' && teamPending.length > 0 && (
        <PendingTasksList tasks={teamPending} showUser />
      )}

      {/* Alertas kanban: vencen hoy o mañana */}
      {kanbanDueTasks.length > 0 && (
        <div className="bg-surface border border-warning/30 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-warning/20 flex items-center gap-2">
            <Calendar size={15} className="text-warning" />
            <h2 className="font-semibold text-warning text-sm">Tareas kanban próximas a vencer</h2>
          </div>
          <div className="divide-y divide-border">
            {kanbanDueTasks.map((task) => {
              const isToday = task.due_date === today
              return (
                <Link key={task.id} href="/kanban" className="px-4 py-3 flex items-center gap-3 hover:bg-surface-2 transition-colors">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isToday ? 'bg-danger' : 'bg-warning'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text font-medium truncate">{task.title}</p>
                    <p className="text-xs text-muted">{task.clients?.name}</p>
                  </div>
                  <span className={`text-xs font-medium whitespace-nowrap px-2 py-0.5 rounded-full ${
                    isToday
                      ? 'text-danger bg-danger/10 border border-danger/20'
                      : 'text-warning bg-warning/10 border border-warning/20'
                  }`}>
                    {isToday ? 'Vence hoy' : 'Vence mañana'}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        {/* Tareas del día */}
        <HomeTaskList
          tasks={checkin?.checkin_tasks ?? []}
          checkinId={checkin?.id ?? null}
          checkoutCompleted={checkin?.checkout_completed ?? false}
          clients={assignedClients}
          userId={authUser.id}
          today={today}
        />

        {/* Bloques de tiempo de hoy */}
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-text text-sm">Tiempo registrado hoy</h2>
            <Link href="/tiempo" className="text-xs text-yesica hover:underline">Ver todo</Link>
          </div>
          <div className="divide-y divide-border">
            {todayEntries.length === 0 ? (
              <p className="px-4 py-8 text-muted text-sm text-center">Sin bloques registrados hoy.</p>
            ) : (
              todayEntries.slice(0, 6).map((entry) => (
                <div key={entry.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="w-1 h-8 rounded-full bg-yesica/40 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text font-medium">{entry.clients?.name}</p>
                    <p className="text-xs text-muted">{entry.activity_type}</p>
                  </div>
                  <span className="text-xs font-mono text-yesica">
                    {entry.duration_minutes ? formatMinutes(entry.duration_minutes) : (
                      <span className="text-success animate-pulse">●&nbsp;corriendo</span>
                    )}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Tickets urgentes */}
      {tickets.filter((t) => t.priority === 'urgente').length > 0 && (
        <div className="bg-danger/5 border border-danger/20 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-danger/20 flex items-center gap-2">
            <AlertCircle size={16} className="text-danger" />
            <h2 className="font-semibold text-danger text-sm">Tickets urgentes</h2>
          </div>
          <div className="divide-y divide-danger/10">
            {tickets.filter((t) => t.priority === 'urgente').map((ticket) => (
              <div key={ticket.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm text-text font-medium">{ticket.title}</p>
                  <p className="text-xs text-muted">{(ticket as unknown as { clients: { name: string } }).clients?.name} · {ticket.origin}</p>
                </div>
                <span className="text-xs text-muted capitalize">{ticket.status.replace('_', ' ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Panel admin: estado del equipo */}
      {profile.role === 'admin' && teamCheckins.length > 0 && (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="font-semibold text-text text-sm">Estado del equipo hoy</h2>
          </div>
          <div className="divide-y divide-border">
            {teamCheckins.map(({ user, checkin: uc }) => (
              <div key={user.id} className="px-4 py-3 flex items-center gap-3">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-bg flex-shrink-0"
                  style={{ backgroundColor: user.color ?? '#818cf8' }}
                >
                  {user.name.charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-text font-medium">{user.name}</p>
                  {uc ? (
                    <p className="text-xs text-muted">
                      Check-in a las {new Date(uc.checkin_time!).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                      {uc.checkout_completed ? ' · Checkout ✓' : ' · Sin checkout'}
                    </p>
                  ) : (
                    <p className="text-xs text-danger">Sin check-in hoy</p>
                  )}
                </div>
                {uc ? (
                  <CheckCircle2 size={16} className="text-success" />
                ) : (
                  <AlertCircle size={16} className="text-danger" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
