export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { type User, type TimeEntry, type Client, type ClientAssignment } from '@/types/index'
import { todayAR, formatMinutes } from '@/lib/utils'
import { TimeLogList } from '@/components/tiempo/time-log-list'

export default async function TiempoPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string; period?: string }>
}) {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: profileData } = await supabase.from('users').select('role').eq('id', authUser.id).single()
  const profile = profileData as Pick<User, 'role'> | null
  if (!profile) redirect('/login')

  const isAdmin = profile.role === 'admin'
  const { user: targetUserParam, period } = await searchParams
  const isMonth = period === 'month'
  const isLastMonth = period === 'lastmonth'

  const today = todayAR()

  // Mes anterior: calcular rango completo
  const todayDate = new Date(today + 'T00:00:00')
  const prevMonthYear = todayDate.getMonth() === 0 ? todayDate.getFullYear() - 1 : todayDate.getFullYear()
  const prevMonthNum = todayDate.getMonth() === 0 ? 12 : todayDate.getMonth()
  const prevMonthStart = `${prevMonthYear}-${String(prevMonthNum).padStart(2, '0')}-01`
  const prevMonthLastDay = new Date(todayDate.getFullYear(), todayDate.getMonth(), 0).getDate()
  const prevMonthEnd = `${prevMonthYear}-${String(prevMonthNum).padStart(2, '0')}-${String(prevMonthLastDay).padStart(2, '0')}`
  const prevMonthLabel = new Date(prevMonthYear, prevMonthNum - 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })

  // Rango de fechas según período
  const startDate = isLastMonth
    ? prevMonthStart
    : isMonth
      ? today.slice(0, 7) + '-01'
      : new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
  const endDate = isLastMonth ? prevMonthEnd : null

  // Para admin: traer todos los usuarios
  let allUsers: Pick<User, 'id' | 'name' | 'color'>[] = []
  if (isAdmin) {
    const { data } = await supabase.from('users').select('id, name, color').order('name')
    allUsers = (data ?? []) as Pick<User, 'id' | 'name' | 'color'>[]
  }

  const targetUserId = isAdmin && targetUserParam ? targetUserParam : authUser.id
  const targetUser = allUsers.find((u) => u.id === targetUserId)

  // Helper para construir href manteniendo los params actuales
  function href(params: { user?: string; period?: string }) {
    const p = new URLSearchParams()
    if (params.user) p.set('user', params.user)
    if (params.period) p.set('period', params.period)
    const qs = p.toString()
    return `/tiempo${qs ? '?' + qs : ''}`
  }

  let entriesQuery = supabase
    .from('time_entries')
    .select('*, clients(id, name)')
    .eq('user_id', targetUserId)
    .gte('date', startDate)
  if (endDate) entriesQuery = entriesQuery.lte('date', endDate)
  const { data: entriesData } = await entriesQuery.order('start_time', { ascending: false })

  const entries = (entriesData ?? []) as (TimeEntry & { clients: Pick<Client, 'id' | 'name'> })[]

  // Clientes para el selector de edición
  let allClients: Pick<Client, 'id' | 'name'>[] = []
  if (isAdmin) {
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

  const totalPeriod = entries.reduce((sum, e) => sum + (e.duration_minutes ?? 0), 0)
  const totalToday = entries.filter((e) => e.date === today).reduce((sum, e) => sum + (e.duration_minutes ?? 0), 0)

  const byClient: Record<string, { name: string; minutes: number }> = {}
  for (const e of entries) {
    const cid = e.client_id
    if (!byClient[cid]) byClient[cid] = { name: e.clients?.name ?? 'Desconocido', minutes: 0 }
    byClient[cid].minutes += e.duration_minutes ?? 0
  }
  const clientSummary = Object.values(byClient).sort((a, b) => b.minutes - a.minutes)

  return (
    <div className="p-6 flex flex-col gap-6 h-[calc(100vh-52px)] max-w-4xl">
      <div className="flex items-start justify-between flex-wrap gap-3 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text">Registro de tiempo</h1>
          <p className="text-muted text-sm mt-0.5">
            {isAdmin && targetUser && targetUserId !== authUser.id
              ? `Viendo registros de ${targetUser.name} · ${isLastMonth ? prevMonthLabel : isMonth ? 'este mes' : 'últimos 7 días'}`
              : isLastMonth ? prevMonthLabel : isMonth ? 'Este mes' : 'Últimos 7 días'}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Selector de período */}
          <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-0.5">
            <Link
              href={href({ user: targetUserParam, period: undefined })}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                !isMonth && !isLastMonth ? 'bg-yesica/20 text-yesica' : 'text-muted hover:text-text'
              }`}
            >
              7 días
            </Link>
            <Link
              href={href({ user: targetUserParam, period: 'month' })}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                isMonth ? 'bg-yesica/20 text-yesica' : 'text-muted hover:text-text'
              }`}
            >
              Este mes
            </Link>
            <Link
              href={href({ user: targetUserParam, period: 'lastmonth' })}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                isLastMonth ? 'bg-yesica/20 text-yesica' : 'text-muted hover:text-text'
              }`}
            >
              Mes anterior
            </Link>
          </div>

          {/* Selector de usuaria (solo admin) */}
          {isAdmin && allUsers.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <Link
                href={href({ period: isMonth ? 'month' : undefined })}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  !targetUserParam || targetUserParam === authUser.id
                    ? 'bg-yesica/15 border-yesica/40 text-yesica'
                    : 'border-border text-muted hover:text-text'
                }`}
              >
                Yo
              </Link>
              {allUsers.filter((u) => u.id !== authUser.id).map((u) => (
                <Link
                  key={u.id}
                  href={href({ user: u.id, period: isMonth ? 'month' : undefined })}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    targetUserId === u.id
                      ? 'border-transparent text-bg'
                      : 'border-border text-muted hover:text-text'
                  }`}
                  style={targetUserId === u.id ? { backgroundColor: u.color ?? '#818cf8' } : {}}
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: u.color ?? '#818cf8' }}
                  />
                  {u.name}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4 flex-shrink-0">
        {[
          { label: 'Hoy', value: formatMinutes(totalToday), color: '#818cf8' },
          { label: isLastMonth ? prevMonthLabel : isMonth ? 'Este mes' : 'Esta semana', value: formatMinutes(totalPeriod), color: '#34d399' },
          { label: 'Bloques registrados', value: entries.length, color: '#f472b6' },
        ].map((k) => (
          <div key={k.label} className="bg-surface border border-border rounded-xl p-4">
            <p className="text-xs font-medium text-muted uppercase tracking-wide mb-1">{k.label}</p>
            <p className="text-2xl font-bold font-mono" style={{ color: k.color }}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6 flex-1 min-h-0">
        {/* Resumen por cliente */}
        <div className="bg-surface border border-border rounded-xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-border flex-shrink-0">
            <h2 className="text-sm font-semibold text-text">
              Por cliente ({isLastMonth ? 'mes ant.' : isMonth ? 'mes' : 'semana'})
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {clientSummary.length === 0 ? (
              <p className="px-4 py-6 text-muted text-sm text-center">Sin datos</p>
            ) : (
              clientSummary.map((c) => {
                const pct = totalPeriod > 0 ? (c.minutes / totalPeriod) * 100 : 0
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
        <div className="col-span-2 bg-surface border border-border rounded-xl overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-border flex-shrink-0">
            <h2 className="text-sm font-semibold text-text">Log de bloques</h2>
          </div>
          {/* key fuerza remount cuando cambia el usuario, reiniciando el estado */}
          <TimeLogList key={targetUserId} initialEntries={entries} allClients={allClients} today={today} />
        </div>
      </div>
    </div>
  )
}
