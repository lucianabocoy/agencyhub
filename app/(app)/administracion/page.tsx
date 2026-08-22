export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { type User, type Client, type ClientAssignment, type ClientBilling } from '@/types/index'
import { AdministracionView, type ClientRow } from '@/components/administracion/administracion-view'

export default async function AdministracionPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: profileData } = await supabase
    .from('users')
    .select('role, can_view_finance')
    .eq('id', authUser.id)
    .single()
  const profile = profileData as Pick<User, 'role' | 'can_view_finance'> | null
  if (!profile || !(profile.role === 'admin' || profile.can_view_finance)) redirect('/home')

  const { data: clientsData } = await supabase
    .from('clients')
    .select('*, client_assignments(user_id, users(id, name, color))')
    .order('name')
  const clients = (clientsData ?? []) as (Client & {
    client_assignments: (ClientAssignment & { users: Pick<User, 'id' | 'name' | 'color'> })[]
  })[]

  // Datos de facturación/fiscales: tabla separada, solo vía service role.
  const admin = await createAdminClient()
  const { data: billingData } = await admin.from('client_billing').select('*')
  const billingByClient = new Map(((billingData ?? []) as ClientBilling[]).map((b) => [b.client_id, b]))

  const rows: ClientRow[] = clients.map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    responsables: c.client_assignments.map((a) => a.users).filter(Boolean),
    billing: billingByClient.get(c.id) ?? null,
  }))

  return <AdministracionView rows={rows} />
}
