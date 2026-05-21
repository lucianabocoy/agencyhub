export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { type User, type Client, type ClientAssignment } from '@/types/index'
import Link from 'next/link'
import { Plus, ExternalLink, AlertTriangle } from 'lucide-react'

const STAGE_BADGE = {
  onboarding: 'bg-warning/15 text-warning border-warning/20',
  mantenimiento: 'bg-success/15 text-success border-success/20',
}

const STATUS_DOT = {
  activo: 'bg-success',
  pausado: 'bg-warning',
  baja: 'bg-danger',
}

export default async function ClientesPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: profileData } = await supabase.from('users').select('role').eq('id', authUser.id).single()
  const profile = profileData as Pick<User, 'role'> | null
  if (!profile) redirect('/login')

  // Admin ve todos; trafficker ve solo los suyos
  let clientsData
  if (profile.role === 'admin') {
    const { data } = await supabase
      .from('clients')
      .select('*, client_assignments(user_id, min_weekly_hours, users(id, name, color))')
      .order('name')
    clientsData = data
  } else {
    const { data } = await supabase
      .from('client_assignments')
      .select('clients(*, client_assignments(user_id, min_weekly_hours, users(id, name, color)))')
      .eq('user_id', authUser.id)
    clientsData = data?.map((a: Record<string, unknown>) => a.clients).filter(Boolean)
  }

  const clients = (clientsData ?? []) as (Client & {
    client_assignments: (ClientAssignment & { users: Pick<User, 'id' | 'name' | 'color'> })[]
  })[]

  const onboardingCount = clients.filter((c) => c.stage === 'onboarding' && c.status === 'activo').length

  return (
    <div className="p-6 space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text">Clientes</h1>
          <p className="text-muted text-sm mt-0.5">{clients.length} clientes · {onboardingCount} en onboarding</p>
        </div>
        {profile.role === 'admin' && (
          <Link
            href="/clientes/nuevo"
            className="flex items-center gap-2 px-4 py-2 bg-yesica hover:bg-yesica/80 text-bg text-sm font-semibold rounded-lg transition-colors"
          >
            <Plus size={16} /> Nuevo cliente
          </Link>
        )}
      </div>

      {/* Alerta de sobrecarga onboarding (admin) */}
      {profile.role === 'admin' && onboardingCount > 3 && (
        <div className="flex items-center gap-3 bg-warning/10 border border-warning/20 rounded-xl px-4 py-3">
          <AlertTriangle size={16} className="text-warning flex-shrink-0" />
          <p className="text-warning text-sm">
            Hay {onboardingCount} clientes en onboarding. Revisá la distribución de carga del equipo.
          </p>
        </div>
      )}

      {/* Tabla */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border text-xs font-semibold text-muted uppercase tracking-wide">
              <th className="px-5 py-3 text-left">Cliente</th>
              <th className="px-5 py-3 text-left">Tipo</th>
              <th className="px-5 py-3 text-left">Etapa</th>
              <th className="px-5 py-3 text-left">Responsables</th>
              <th className="px-5 py-3 text-left">Plataformas</th>
              <th className="px-5 py-3 text-left">Estado</th>
              <th className="px-5 py-3 text-right">Links</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {clients.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-muted text-sm">
                  Sin clientes todavía.{' '}
                  {profile.role === 'admin' && (
                    <Link href="/clientes/nuevo" className="text-yesica hover:underline">Agregá el primero.</Link>
                  )}
                </td>
              </tr>
            ) : (
              clients.map((client) => (
                <tr key={client.id} className="hover:bg-surface-2 transition-colors">
                  <td className="px-5 py-3">
                    <Link href={`/clientes/${client.id}`} className="font-medium text-text hover:text-yesica transition-colors">
                      {client.name}
                    </Link>
                    {client.budget && (
                      <p className="text-xs text-muted mt-0.5">
                        ${client.budget.toLocaleString('es-AR')}/mes
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-sm text-muted capitalize">{client.type}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-block text-xs font-medium px-2.5 py-0.5 rounded-full border ${STAGE_BADGE[client.stage]}`}>
                      {client.stage}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex -space-x-1">
                      {client.client_assignments?.map((a) => (
                        <div
                          key={a.user_id}
                          title={a.users?.name}
                          className="w-6 h-6 rounded-full border-2 border-surface flex items-center justify-center text-[10px] font-bold text-bg"
                          style={{ backgroundColor: a.users?.color ?? '#818cf8' }}
                        >
                          {a.users?.name?.charAt(0)}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-1">
                      {client.platforms.map((p) => (
                        <span key={p} className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-surface-2 text-muted border border-border">
                          {p === 'meta_ads' ? 'Meta' : 'Google'}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${STATUS_DOT[client.status]}`} />
                      <span className="text-sm text-muted capitalize">{client.status}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {client.drive_folder_url && (
                        <a href={client.drive_folder_url} target="_blank" rel="noopener noreferrer"
                          className="text-muted hover:text-text transition-colors" title="Drive">
                          <ExternalLink size={14} />
                        </a>
                      )}
                      <Link href={`/clientes/${client.id}`} className="text-xs text-yesica hover:underline">
                        Ver →
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
