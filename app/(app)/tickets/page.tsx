export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { type User, type Ticket, type Client } from '@/types/index'
import { TicketsView } from '@/components/tickets/tickets-view'

type TicketRow = Ticket & {
  assignee: Pick<User, 'id' | 'name' | 'color'> | null
  creator: Pick<User, 'id' | 'name'> | null
  client: Pick<Client, 'id' | 'name'> | null
}

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>
}) {
  const { client: clientFilter } = await searchParams
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: profileData } = await supabase
    .from('users').select('role').eq('id', authUser.id).single()
  if (!profileData) redirect('/login')
  const isAdmin = (profileData as Pick<User, 'role'>).role === 'admin'

  let ticketQuery = supabase
    .from('tickets')
    .select(`
      *,
      assignee:users!assigned_to(id, name, color),
      creator:users!created_by(id, name),
      client:clients(id, name)
    `)
    .order('created_at', { ascending: false })

  if (!isAdmin) {
    ticketQuery = ticketQuery.or(`assigned_to.eq.${authUser.id},created_by.eq.${authUser.id}`)
  }

  if (clientFilter) {
    ticketQuery = ticketQuery.eq('client_id', clientFilter)
  }

  const { data: ticketsData } = await ticketQuery
  const tickets = (ticketsData ?? []) as TicketRow[]

  // Clients for modal
  let clientsQuery = supabase.from('clients').select('id, name').eq('status', 'activo').order('name')
  const { data: clientsData } = await clientsQuery
  const clients = (clientsData ?? []) as Pick<Client, 'id' | 'name'>[]

  // Users
  const { data: usersData } = await supabase.from('users').select('id, name, color').order('name')
  const users = (usersData ?? []) as Pick<User, 'id' | 'name' | 'color'>[]

  return (
    <div className="p-6 h-full flex flex-col">
      <TicketsView
        initialTickets={tickets}
        clients={clients}
        users={users}
        currentUserId={authUser.id}
        isAdmin={isAdmin}
        defaultClientId={clientFilter}
      />
    </div>
  )
}
