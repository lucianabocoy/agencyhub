export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { type User, type TimeEntry, type Client, type Objective, type Ticket } from '@/types/index'
import { todayAR } from '@/lib/utils'
import { ReportView } from '@/components/reportes/report-view'

type EntryRow = TimeEntry & {
  clients: Pick<Client, 'id' | 'name'>
  users: Pick<User, 'id' | 'name' | 'color'>
}
type ObjRow = Objective & {
  client: Pick<Client, 'id' | 'name'> | null
  assignee: Pick<User, 'id' | 'name' | 'color'> | null
}

export default async function ReportesPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: profileData } = await supabase
    .from('users').select('role').eq('id', authUser.id).single()
  if (!profileData) redirect('/login')
  const isAdmin = (profileData as Pick<User, 'role'>).role === 'admin'

  // Default period: last 7 days
  const today = todayAR()
  const sevenAgo = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10)

  // Time entries
  let entriesQuery = supabase
    .from('time_entries')
    .select('*, clients(id, name), users(id, name, color)')
    .gte('date', sevenAgo)
    .lte('date', today)
    .not('duration_minutes', 'is', null)

  if (!isAdmin) entriesQuery = entriesQuery.eq('user_id', authUser.id)

  const { data: entriesData } = await entriesQuery
  const entries = (entriesData ?? []) as EntryRow[]

  // Objectives overlapping the period
  let objectivesQuery = supabase
    .from('objectives')
    .select('*, client:clients(id, name), assignee:users!assigned_to(id, name, color)')
    .lte('period_start', today)
    .gte('period_end', sevenAgo)

  if (!isAdmin) objectivesQuery = objectivesQuery.eq('assigned_to', authUser.id)

  const { data: objectivesData } = await objectivesQuery
  const objectives = (objectivesData ?? []) as ObjRow[]

  // Tickets created in the period
  let ticketsQuery = supabase
    .from('tickets')
    .select('*')
    .gte('created_at', sevenAgo + 'T00:00:00')
    .lte('created_at', today + 'T23:59:59')

  if (!isAdmin) {
    ticketsQuery = ticketsQuery.or(`assigned_to.eq.${authUser.id},created_by.eq.${authUser.id}`)
  }

  const { data: ticketsData } = await ticketsQuery
  const tickets = (ticketsData ?? []) as Ticket[]

  // All clients for filter + heatmap
  let clientsQuery = supabase.from('clients').select('id, name').eq('status', 'activo').order('name')
  if (!isAdmin) {
    const { data: assignments } = await supabase
      .from('client_assignments').select('client_id').eq('user_id', authUser.id)
    const ids = ((assignments ?? []) as { client_id: string }[]).map((a) => a.client_id)
    if (ids.length > 0) clientsQuery = clientsQuery.in('id', ids)
  }
  const { data: clientsData } = await clientsQuery
  const allClients = (clientsData ?? []) as Pick<Client, 'id' | 'name'>[]

  return (
    <div className="p-6 max-w-5xl">
      <div data-no-print className="mb-6">
        <h1 className="text-xl font-bold text-text">Reportes</h1>
        <p className="text-muted text-sm mt-0.5">Generá y exportá reportes de actividad</p>
      </div>
      <ReportView
        entries={entries}
        objectives={objectives}
        tickets={tickets}
        allClients={allClients}
        currentUserId={authUser.id}
        isAdmin={isAdmin}
        defaultStart={sevenAgo}
        defaultEnd={today}
      />
    </div>
  )
}
