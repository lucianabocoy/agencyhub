export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { type User } from '@/types/index'
import { EquipoView } from '@/components/equipo/equipo-view'

export default async function EquipoPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: profileData } = await supabase.from('users').select('role').eq('id', authUser.id).single()
  const profile = profileData as Pick<User, 'role'> | null
  if (!profile || profile.role !== 'admin') redirect('/home')

  const { data } = await supabase.from('users').select('*').order('name')
  const team = (data ?? []) as User[]

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
