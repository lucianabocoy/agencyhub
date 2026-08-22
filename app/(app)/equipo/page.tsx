export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { type User } from '@/types/index'
import { EquipoView, type TeamMember } from '@/components/equipo/equipo-view'

export default async function EquipoPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: profileData } = await supabase.from('users').select('role').eq('id', authUser.id).single()
  const profile = profileData as Pick<User, 'role'> | null
  if (!profile || profile.role !== 'admin') redirect('/home')

  const { data: usersData } = await supabase.from('users').select('*').order('name')
  const users = (usersData ?? []) as User[]

  const { data: assignmentsData } = await supabase
    .from('client_assignments')
    .select('user_id, clients(id, name, status)')
  const assignments = (assignmentsData ?? []) as unknown as {
    user_id: string
    clients: { id: string; name: string; status: string } | null
  }[]

  // Notas privadas: solo legibles vía service role, no vía RLS del cliente.
  const admin = await createAdminClient()
  const { data: notesData } = await admin.from('user_notes').select('user_id, note')
  const notes = (notesData ?? []) as { user_id: string; note: string | null }[]
  const noteByUser = new Map(notes.map((n) => [n.user_id, n.note]))

  const team: TeamMember[] = users.map((u) => ({
    ...u,
    clients: assignments
      .filter((a) => a.user_id === u.id && a.clients)
      .map((a) => a.clients!),
    note: noteByUser.get(u.id) ?? null,
  }))

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-text">Equipo</h1>
        <p className="text-muted text-sm mt-0.5">Gestioná las cuentas de acceso de tu equipo.</p>
      </div>

      <EquipoView team={team} />
    </div>
  )
}
