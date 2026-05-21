export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { type User, type TimeEntry, type Client, type ClientAssignment } from '@/types/index'
import { todayAR, formatMinutes } from '@/lib/utils'
import { TimeLogList } from '@/components/tiempo/time-log-list'

export default async function TiempoPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: profileData } = await supabase.from('users').select('role').eq('id', authUser.id).single()
  const profile = profileData as Pick<User, 'role'> | null
  if (!profile) redirect('/login')

  const today = todayAR()

  // Registros de la última semana
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)

  const { data: entriesData } = await supabase
    .from('time_entries')
    .select('*, clients(id, name)')
    .eq('user_id', authUser.id)
    .gte('date', weekAgo)
    .order('start_time', { ascending: false })

  const entries = (entriesData ?? []) as (TimeEntry & { clients: Pick<Client, 'id' | 'name'> })[]

  // Clientes para el selector de edición
  let allClients: Pick<Client, 'id' | 'name'>[] = []
  if (profile.role === 'admin') {
    const { data } = await supabase.from('clients').select('id, name').eq('status', 'activo').order('name')
    allClients = (data ?? []) as Pick<Client, 'id' | 'name'>[]
  } else {
    const { data: assigns } = await supabase.from('client_assignments').select('client_id').eq('user_id', authUser.id)
    const ids = ((assigns ?? []) as Pick<ClientAssignment, 'client_id'>[]).map((a) => a.client_id)
    if (ids.length > 0) {
      const { data } = await supabase.from('clients').select('id, name').in('id', ids).eq('status', 'activo').order('name')
      allClients = (data ?? []) as Pick<Client, 'id' | 'name'>[]
    }
  }

  // Agrupar por fecha
  const byDate: Record<string, typeof entries> = {}
  for (const e of entries) {
    if (!byDate[e.date]) byDate[e.date] = []
    byDate[e.date].push(e)
  }

  const totalWeek = entries.reduce((sum, e) => sum + (e.duration_minutes ?? 0), 0)
  const totalToday = entries.filter((e) => e.date === today).reduce((sum, e) => sum + (e.duration_minutes ?? 0), 0)

  // Resumen por cliente (semana)
  const byClient: Record<string, { name: string; minutes: number }> = {}
  for (const e of entries) {
    const cid = e.client_id
    if (!byClient[cid]) byClient[cid] = { name: e.clients?.name ?? 'Desconocido', minutes: 0 }
    byClient[cid].minutes += e.duration_minutes ?? 0
  }
  const clientSummary = Object.values(byClient).sort((a, b) => b.minutes - a.minutes)

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-text">Registro de tiempo</h1>
        <p className="text-muted text-sm mt-0.5">Últimos 7 días</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Hoy', value: formatMinutes(totalToday), color: '#818cf8' },
          { label: 'Esta semana', value: formatMinutes(totalWeek), color: '#34d399' },
          { label: 'Bloques registrados', value: entries.length, color: '#f472b6' },
        ].map((k) => (
          <div key={k.label} className="bg-surface border border-border rounded-xl p-4">
            <p className="text-xs font-medium text-muted uppercase tracking-wide mb-1">{k.label}</p>
            <p className="text-2xl font-bold font-mono" style={{ color: k.color }}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Resumen por cliente */}
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-text">Por cliente (semana)</h2>
          </div>
          <div className="divide-y divide-border">
            {clientSummary.length === 0 ? (
              <p className="px-4 py-6 text-muted text-sm text-center">Sin datos</p>
            ) : (
              clientSummary.map((c) => {
                const pct = totalWeek > 0 ? (c.minutes / totalWeek) * 100 : 0
                return (
                  <div key={c.name} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm text-text font-medium">{c.name}</span>
                      <span className="text-xs font-mono text-yesica">{formatMinutes(c.minutes)}</span>
                    </div>
                    <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                      <div className="h-full bg-yesica/60 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Log por día */}
        <div className="col-span-2 bg-surface border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold text-text">Log de bloques</h2>
          </div>
          <TimeLogList initialEntries={entries} allClients={allClients} today={today} />
        </div>
      </div>
    </div>
  )
}
