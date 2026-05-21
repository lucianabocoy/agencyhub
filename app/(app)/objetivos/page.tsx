export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { type User, type Objective, type Client } from '@/types/index'
import { ObjetivosView } from '@/components/objetivos/objetivos-view'

type ObjRow = Objective & {
  client: Pick<Client, 'id' | 'name'> | null
  assignee: Pick<User, 'id' | 'name' | 'color'> | null
}

export default async function ObjetivosPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: profileData } = await supabase
    .from('users').select('role').eq('id', authUser.id).single()
  if (!profileData) redirect('/login')
  const isAdmin = (profileData as Pick<User, 'role'>).role === 'admin'

  let query = supabase
    .from('objectives')
    .select(`
      *,
      client:clients(id, name),
      assignee:users!assigned_to(id, name, color)
    `)
    .order('created_at', { ascending: false })

  if (!isAdmin) {
    query = query.eq('assigned_to', authUser.id)
  }

  const { data } = await query
  const objectives = (data ?? []) as ObjRow[]

  // Clients (for modal)
  let clientsQuery = supabase.from('clients').select('id, name').eq('status', 'activo').order('name')
  if (!isAdmin) {
    const { data: assignments } = await supabase
      .from('client_assignments').select('client_id').eq('user_id', authUser.id)
    const ids = ((assignments ?? []) as { client_id: string }[]).map((a) => a.client_id)
    if (ids.length > 0) clientsQuery = clientsQuery.in('id', ids)
  }
  const { data: clientsData } = await clientsQuery
  const clients = (clientsData ?? []) as Pick<Client, 'id' | 'name'>[]

  const { data: usersData } = await supabase
    .from('users').select('id, name, color').order('name')
  const users = (usersData ?? []) as Pick<User, 'id' | 'name' | 'color'>[]

  return (
    <div className="p-6 max-w-3xl">
      <ObjetivosView
        initialObjectives={objectives}
        clients={clients}
        users={users}
        currentUserId={authUser.id}
        isAdmin={isAdmin}
      />
    </div>
  )
}
