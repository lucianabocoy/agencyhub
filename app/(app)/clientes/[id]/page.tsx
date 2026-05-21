export const dynamic = 'force-dynamic'

import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  type User, type Client, type ClientAssignment, type Ticket, type TimeEntry,
  type Priority, PRIORITY_COLORS,
} from '@/types/index'
import { formatARS, formatMinutes } from '@/lib/utils'
import { ExternalLink, Globe, Calendar, Clock, Kanban, ChevronRight, Edit2 } from 'lucide-react'
import { CopyLinkButton } from '@/components/clientes/copy-link-button'

const STAGE_LABEL: Record<string, string> = { onboarding: 'Onboarding', mantenimiento: 'Mantenimiento' }
const TYPE_LABEL: Record<string, string> = { ecommerce: 'Ecommerce', servicios: 'Servicios' }
const STATUS_COLOR: Record<string, string> = {
  activo: 'text-success bg-success/10',
  pausado: 'text-warning bg-warning/10',
  baja: 'text-danger bg-danger/10',
}
const TICKET_STATUS_LABEL: Record<string, string> = {
  nuevo: 'Nuevo', en_revision: 'En revisión', en_proceso: 'En proceso', completado: 'Completado',
}
const TICKET_STATUS_COLOR: Record<string, string> = {
  nuevo: 'text-blue-400 bg-blue-400/10',
  en_revision: 'text-warning bg-warning/10',
  en_proceso: 'text-yesica bg-yesica/10',
  completado: 'text-success bg-success/10',
}
const PLATFORM_LABEL: Record<string, string> = { meta_ads: 'Meta Ads', google_ads: 'Google Ads' }

type AssignmentRow = ClientAssignment & {
  users: Pick<User, 'id' | 'name' | 'color' | 'avatar_url'>
}
type TicketRow = Ticket & {
  assignee: Pick<User, 'id' | 'name' | 'color'> | null
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: profileData } = await supabase
    .from('users').select('role').eq('id', authUser.id).single()
  if (!profileData) redirect('/login')
  const isAdmin = (profileData as Pick<User, 'role'>).role === 'admin'

  const { data: clientData } = await supabase
    .from('clients').select('*').eq('id', id).single()
  if (!clientData) notFound()
  const client = clientData as Client

  if (!isAdmin) {
    const { data: access } = await supabase
      .from('client_assignments')
      .select('id').eq('client_id', id).eq('user_id', authUser.id).single()
    if (!access) notFound()
  }

  const { data: assignmentsData } = await supabase
    .from('client_assignments')
    .select('*, users(id, name, color, avatar_url)')
    .eq('client_id', id)
  const assignments = (assignmentsData ?? []) as AssignmentRow[]

  const { data: ticketsData } = await supabase
    .from('tickets')
    .select('*, assignee:users!assigned_to(id, name, color)')
    .eq('client_id', id)
    .order('created_at', { ascending: false })
    .limit(8)
  const tickets = (ticketsData ?? []) as TicketRow[]

  const thirtyAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const { data: activityData } = await supabase
    .from('time_entries')
    .select('*, users(id, name, color)')
    .eq('client_id', id)
    .gte('date', thirtyAgo)
    .not('duration_minutes', 'is', null)
    .order('date', { ascending: false })
    .order('start_time', { ascending: false })

  type ActivityRow = TimeEntry & { users: Pick<User, 'id' | 'name' | 'color'> }
  const activities = (activityData ?? []) as ActivityRow[]
  const totalMinutes = activities.reduce((s, e) => s + (e.duration_minutes ?? 0), 0)

  const openTickets = tickets.filter((t) => t.status !== 'completado').length

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted mb-1">
            <Link href="/clientes" className="hover:text-text transition-colors">Clientes</Link>
            <ChevronRight size={12} />
            <span>{client.name}</span>
          </div>
          <h1 className="text-xl font-bold text-text">{client.name}</h1>
          <div className="flex items-center gap-2 mt-1.5">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[client.status]}`}>
              {client.status.charAt(0).toUpperCase() + client.status.slice(1)}
            </span>
            <span className="text-xs text-muted">{TYPE_LABEL[client.type]}</span>
            <span className="text-muted text-xs">·</span>
            <span className="text-xs text-muted">{STAGE_LABEL[client.stage]}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CopyLinkButton clientId={id} />
          <Link
            href={`/clientes/${id}/editar`}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-muted hover:text-text border border-border hover:border-muted rounded-lg transition-colors"
          >
            <Edit2 size={14} /> Editar
          </Link>
          <Link
            href={`/kanban?client=${id}`}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-yesica/15 hover:bg-yesica/25 text-yesica rounded-lg transition-colors"
          >
            <Kanban size={14} /> Ver Kanban
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-surface border border-border rounded-xl p-4">
          <p className="text-xs text-muted uppercase tracking-wide mb-1">Horas (30d)</p>
          <p className="text-2xl font-bold font-mono text-yesica">{formatMinutes(totalMinutes)}</p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <p className="text-xs text-muted uppercase tracking-wide mb-1">Presupuesto</p>
          <p className="text-2xl font-bold font-mono text-luciana">
            {client.budget ? formatARS(client.budget) : '—'}
          </p>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <p className="text-xs text-muted uppercase tracking-wide mb-1">Tickets abiertos</p>
          <p className="text-2xl font-bold font-mono text-warning">{openTickets}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Info */}
        <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-text">Información</h2>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted mb-1">Plataformas</p>
              <div className="flex gap-2 flex-wrap">
                {client.platforms.length === 0 ? (
                  <span className="text-sm text-muted">—</span>
                ) : client.platforms.map((p) => (
                  <span key={p} className="text-xs px-2 py-0.5 bg-surface-2 border border-border rounded-full text-muted">
                    {PLATFORM_LABEL[p] ?? p}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-muted mb-1">Fecha de inicio</p>
              <div className="flex items-center gap-1.5 text-sm text-text">
                <Calendar size={13} className="text-muted" />
                {new Date(client.start_date + 'T00:00:00').toLocaleDateString('es-AR', {
                  day: 'numeric', month: 'long', year: 'numeric',
                })}
              </div>
            </div>
            {client.drive_folder_url && (
              <div>
                <p className="text-xs text-muted mb-1">Drive</p>
                <a
                  href={client.drive_folder_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-sm text-yesica hover:text-yesica/80 transition-colors"
                >
                  <ExternalLink size={13} /> Abrir carpeta
                </a>
              </div>
            )}
            {client.website_url && (
              <div>
                <p className="text-xs text-muted mb-1">Sitio web</p>
                <a
                  href={client.website_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-sm text-yesica hover:text-yesica/80 transition-colors"
                >
                  <Globe size={13} /> {client.website_url.replace(/^https?:\/\//, '')}
                </a>
              </div>
            )}
            {client.notes && (
              <div>
                <p className="text-xs text-muted mb-1">Notas</p>
                <p className="text-sm text-text leading-relaxed whitespace-pre-wrap">{client.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Equipo */}
        <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-text">Equipo asignado</h2>
          {assignments.length === 0 ? (
            <p className="text-sm text-muted">Sin responsables asignados</p>
          ) : (
            <div className="space-y-3">
              {assignments.map((a) => (
                <div key={a.id} className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-bg flex-shrink-0"
                    style={{ backgroundColor: a.users?.color ?? '#818cf8' }}
                  >
                    {(a.users?.name ?? '?').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text">{a.users?.name}</p>
                    <p className="text-xs text-muted flex items-center gap-1">
                      <Clock size={11} /> Mín. {a.min_weekly_hours}h/semana
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Registro de actividad */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text">Actividad registrada <span className="text-muted font-normal">(últimos 30 días)</span></h2>
          <span className="text-xs text-muted">{formatMinutes(totalMinutes)} totales</span>
        </div>
        {activities.length === 0 ? (
          <p className="px-5 py-10 text-sm text-muted text-center">Sin actividad registrada en los últimos 30 días</p>
        ) : (
          <div className="divide-y divide-border">
            {activities.map((entry) => (
              <div key={entry.id} className="px-5 py-3 flex items-start gap-3">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-bg flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: entry.users?.color ?? '#818cf8' }}
                  title={entry.users?.name}
                >
                  {entry.users?.name?.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text leading-snug">{entry.activity_type}</p>
                  <p className="text-xs text-muted mt-0.5">
                    {entry.users?.name} · {new Date(entry.date + 'T00:00:00').toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })}
                    {entry.start_time && entry.end_time && ` · ${entry.start_time.slice(0,5)}–${entry.end_time.slice(0,5)}`}
                  </p>
                </div>
                <span className="text-xs font-mono text-yesica flex-shrink-0">
                  {formatMinutes(entry.duration_minutes ?? 0)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tickets recientes */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text">Tickets recientes</h2>
          <Link href={`/tickets?client=${id}`} className="text-xs text-yesica hover:text-yesica/80 transition-colors">
            Ver todos →
          </Link>
        </div>
        {tickets.length === 0 ? (
          <p className="px-5 py-10 text-sm text-muted text-center">Sin tickets para este cliente</p>
        ) : (
          <div className="divide-y divide-border">
            {tickets.map((ticket) => (
              <div key={ticket.id} className="px-5 py-3 flex items-center gap-3">
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: PRIORITY_COLORS[ticket.priority as Priority] }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text font-medium truncate">{ticket.title}</p>
                  <p className="text-xs text-muted capitalize">{ticket.origin}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${TICKET_STATUS_COLOR[ticket.status]}`}>
                  {TICKET_STATUS_LABEL[ticket.status]}
                </span>
                {ticket.assignee && (
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-bg flex-shrink-0"
                    style={{ backgroundColor: ticket.assignee.color ?? '#818cf8' }}
                    title={ticket.assignee.name}
                  >
                    {ticket.assignee.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
