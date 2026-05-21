export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { type User, type TimeEntry, type Client } from '@/types/index'
import { formatMinutes } from '@/lib/utils'
import { DashboardCharts } from '@/components/dashboard/dashboard-charts'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: profileData } = await supabase.from('users').select('*').eq('id', authUser.id).single()
  const profile = profileData as User | null
  if (!profile) redirect('/login')

  // Datos de los últimos 30 días
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)

  let query = supabase
    .from('time_entries')
    .select('*, clients(id, name), users(id, name, color)')
    .gte('date', thirtyDaysAgo)
    .not('duration_minutes', 'is', null)

  if (profile.role !== 'admin') {
    query = query.eq('user_id', authUser.id)
  }

  const { data: entriesData } = await query
  const entries = (entriesData ?? []) as (TimeEntry & {
    clients: Pick<Client, 'id' | 'name'>
    users: Pick<User, 'id' | 'name' | 'color'>
  })[]

  // KPIs globales
  const totalMinutes = entries.reduce((s, e) => s + (e.duration_minutes ?? 0), 0)
  const uniqueUsers = new Set(entries.map((e) => e.user_id)).size
  const uniqueClients = new Set(entries.map((e) => e.client_id)).size

  // Horas por cliente (para gráfico de barras)
  const byClient: Record<string, { name: string; minutes: number }> = {}
  for (const e of entries) {
    const id = e.client_id
    if (!byClient[id]) byClient[id] = { name: e.clients?.name ?? '?', minutes: 0 }
    byClient[id].minutes += e.duration_minutes ?? 0
  }
  const clientData = Object.values(byClient)
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 15)
    .map((c) => ({ name: c.name, horas: parseFloat((c.minutes / 60).toFixed(1)) }))

  // Horas por responsable
  const byUser: Record<string, { name: string; color: string; minutes: number }> = {}
  for (const e of entries) {
    const id = e.user_id
    if (!byUser[id]) byUser[id] = { name: e.users?.name ?? '?', color: e.users?.color ?? '#818cf8', minutes: 0 }
    byUser[id].minutes += e.duration_minutes ?? 0
  }
  const userData = Object.values(byUser)
    .map((u) => ({ name: u.name, color: u.color, horas: parseFloat((u.minutes / 60).toFixed(1)) }))

  // Horas por tipo de actividad
  const byActivity: Record<string, number> = {}
  for (const e of entries) {
    const a = e.activity_type
    byActivity[a] = (byActivity[a] ?? 0) + (e.duration_minutes ?? 0)
  }
  const activityData = Object.entries(byActivity)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, minutes]) => ({ name, horas: parseFloat((minutes / 60).toFixed(1)) }))

  // Detalle por persona: horas por cliente
  const byUserClient: Record<string, {
    name: string; color: string; totalMinutes: number;
    clients: Record<string, { name: string; minutes: number; entries: typeof entries }>
  }> = {}
  for (const e of entries) {
    const uid = e.user_id
    if (!byUserClient[uid]) byUserClient[uid] = {
      name: e.users?.name ?? '?', color: e.users?.color ?? '#818cf8', totalMinutes: 0, clients: {}
    }
    byUserClient[uid].totalMinutes += e.duration_minutes ?? 0
    const cid = e.client_id
    if (!byUserClient[uid].clients[cid]) byUserClient[uid].clients[cid] = { name: e.clients?.name ?? '?', minutes: 0, entries: [] }
    byUserClient[uid].clients[cid].minutes += e.duration_minutes ?? 0
    byUserClient[uid].clients[cid].entries.push(e)
  }
  const teamDetail = Object.values(byUserClient).sort((a, b) => b.totalMinutes - a.totalMinutes)

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div>
        <h1 className="text-xl font-bold text-text">Dashboard de Productividad</h1>
        <p className="text-muted text-sm mt-0.5">Últimos 30 días</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Horas totales', value: formatMinutes(totalMinutes), color: '#818cf8' },
          { label: 'Promedio diario', value: formatMinutes(totalMinutes / 30), color: '#34d399' },
          { label: 'Clientes activos', value: uniqueClients, color: '#f472b6' },
          { label: 'Colaboradores', value: uniqueUsers, color: '#fbbf24' },
        ].map((k) => (
          <div key={k.label} className="bg-surface border border-border rounded-xl p-4">
            <p className="text-xs font-medium text-muted uppercase tracking-wide mb-1">{k.label}</p>
            <p className="text-2xl font-bold font-mono" style={{ color: k.color }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Gráficos — componente client */}
      <DashboardCharts
        clientData={clientData}
        userData={userData}
        activityData={activityData}
      />

      {/* Actividad detallada por persona — solo admin */}
      {profile.role === 'admin' && teamDetail.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-text">Actividad del equipo — desglose por cuenta</h2>
          {teamDetail.map((member) => (
            <div key={member.name} className="bg-surface border border-border rounded-xl overflow-hidden">
              {/* Header del miembro */}
              <div className="px-5 py-3 border-b border-border flex items-center gap-3">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-bg flex-shrink-0"
                  style={{ backgroundColor: member.color }}
                >
                  {member.name.charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-text">{member.name}</p>
                </div>
                <span className="text-xs font-mono text-yesica font-semibold">
                  {formatMinutes(member.totalMinutes)} totales
                </span>
              </div>
              {/* Clientes de ese miembro */}
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border text-[11px] font-semibold text-muted uppercase tracking-wide">
                    <th className="px-5 py-2 text-left">Cliente</th>
                    <th className="px-5 py-2 text-left">Última actividad</th>
                    <th className="px-5 py-2 text-right">Horas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {Object.values(member.clients)
                    .sort((a, b) => b.minutes - a.minutes)
                    .map((c) => {
                      const lastEntry = c.entries.sort((a, b) => b.date.localeCompare(a.date))[0]
                      return (
                        <tr key={c.name} className="hover:bg-surface-2 transition-colors">
                          <td className="px-5 py-2.5">
                            <p className="text-sm font-medium text-text">{c.name}</p>
                          </td>
                          <td className="px-5 py-2.5 max-w-xs">
                            <p className="text-xs text-muted truncate">{lastEntry?.activity_type}</p>
                            <p className="text-[11px] text-muted/60 mt-0.5">
                              {lastEntry ? new Date(lastEntry.date + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }) : ''}
                            </p>
                          </td>
                          <td className="px-5 py-2.5 text-right">
                            <span className="text-sm font-mono text-yesica">{formatMinutes(c.minutes)}</span>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
