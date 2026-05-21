'use client'

import { useState } from 'react'
import { type Ticket, type Client, type User, type TicketStatus, type Priority, PRIORITY_COLORS } from '@/types/index'
import { TicketModal } from './ticket-modal'
import { Plus, Ticket as TicketIcon } from 'lucide-react'

type TicketRow = Ticket & {
  assignee: Pick<User, 'id' | 'name' | 'color'> | null
  creator: Pick<User, 'id' | 'name'> | null
  client: Pick<Client, 'id' | 'name'> | null
}

interface Props {
  initialTickets: TicketRow[]
  clients: Pick<Client, 'id' | 'name'>[]
  users: Pick<User, 'id' | 'name' | 'color'>[]
  currentUserId: string
  isAdmin: boolean
  defaultClientId?: string
}

const STATUSES: { key: TicketStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'nuevo', label: 'Nuevo' },
  { key: 'en_revision', label: 'En revisión' },
  { key: 'en_proceso', label: 'En proceso' },
  { key: 'completado', label: 'Completado' },
]

const STATUS_COLOR: Record<TicketStatus, string> = {
  nuevo: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  en_revision: 'text-warning bg-warning/10 border-warning/20',
  en_proceso: 'text-yesica bg-yesica/10 border-yesica/20',
  completado: 'text-success bg-success/10 border-success/20',
}

const ORIGIN_LABEL: Record<string, string> = {
  whatsapp: 'WhatsApp', reunion: 'Reunión', email: 'Email', interno: 'Interno',
}

export function TicketsView({
  initialTickets, clients, users, currentUserId, isAdmin, defaultClientId,
}: Props) {
  const [tickets, setTickets] = useState(initialTickets)
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all')
  const [modal, setModal] = useState<null | 'new' | TicketRow>(null)

  const filtered = statusFilter === 'all'
    ? tickets
    : tickets.filter((t) => t.status === statusFilter)

  const counts: Record<string, number> = {
    all: tickets.length,
    nuevo: tickets.filter((t) => t.status === 'nuevo').length,
    en_revision: tickets.filter((t) => t.status === 'en_revision').length,
    en_proceso: tickets.filter((t) => t.status === 'en_proceso').length,
    completado: tickets.filter((t) => t.status === 'completado').length,
  }

  function handleSave(saved: Ticket) {
    setTickets((prev) => {
      const exists = prev.find((t) => t.id === saved.id)
      const enriched = saved as TicketRow
      if (exists) {
        return prev.map((t) => t.id === saved.id
          ? { ...t, ...enriched }
          : t
        )
      }
      const clientObj = clients.find((c) => c.id === saved.client_id) ?? null
      const assigneeObj = users.find((u) => u.id === saved.assigned_to) ?? null
      return [{ ...enriched, client: clientObj, assignee: assigneeObj, creator: null }, ...prev]
    })
    setModal(null)
  }

  function handleDelete(id: string) {
    setTickets((prev) => prev.filter((t) => t.id !== id))
    setModal(null)
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text">Tickets</h1>
          <p className="text-muted text-sm mt-0.5">{tickets.filter((t) => t.status !== 'completado').length} abiertos</p>
        </div>
        <button
          onClick={() => setModal('new')}
          className="flex items-center gap-1.5 px-3 py-2 bg-yesica/15 hover:bg-yesica/25 text-yesica rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={15} /> Nuevo ticket
        </button>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 flex-shrink-0">
        {STATUSES.map((s) => (
          <button
            key={s.key}
            onClick={() => setStatusFilter(s.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              statusFilter === s.key
                ? 'bg-yesica/15 text-yesica'
                : 'text-muted hover:text-text hover:bg-surface-2'
            }`}
          >
            {s.label}
            <span className="ml-1.5 text-muted">{counts[s.key]}</span>
          </button>
        ))}
      </div>

      {/* Ticket list */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {filtered.length === 0 ? (
          <div className="bg-surface border border-border rounded-xl py-16 text-center">
            <TicketIcon size={28} className="mx-auto text-muted mb-3" />
            <p className="text-sm text-muted">Sin tickets {statusFilter !== 'all' ? 'con este estado' : ''}</p>
          </div>
        ) : (
          filtered.map((ticket) => {
            const isOverdue = ticket.due_date && ticket.status !== 'completado' &&
              new Date(ticket.due_date + 'T00:00:00') < new Date()

            return (
              <button
                key={ticket.id}
                onClick={() => setModal(ticket)}
                className="w-full text-left bg-surface border border-border hover:border-border/80 hover:bg-surface-2/50 rounded-xl px-4 py-3.5 flex items-center gap-4 transition-colors"
              >
                {/* Priority dot */}
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: PRIORITY_COLORS[ticket.priority as Priority] }}
                />

                {/* Main content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text truncate">{ticket.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {ticket.client && (
                      <span className="text-xs text-muted truncate">{ticket.client.name}</span>
                    )}
                    <span className="text-muted text-xs">·</span>
                    <span className="text-xs text-muted capitalize">{ORIGIN_LABEL[ticket.origin] ?? ticket.origin}</span>
                    {ticket.due_date && (
                      <>
                        <span className="text-muted text-xs">·</span>
                        <span className={`text-xs ${isOverdue ? 'text-danger' : 'text-muted'}`}>
                          {new Date(ticket.due_date + 'T00:00:00').toLocaleDateString('es-AR', {
                            day: 'numeric', month: 'short',
                          })}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Status */}
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium border flex-shrink-0 ${STATUS_COLOR[ticket.status as TicketStatus]}`}>
                  {STATUSES.find((s) => s.key === ticket.status)?.label ?? ticket.status}
                </span>

                {/* Assignee */}
                {ticket.assignee && (
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-bg flex-shrink-0"
                    style={{ backgroundColor: ticket.assignee.color ?? '#818cf8' }}
                    title={ticket.assignee.name}
                  >
                    {ticket.assignee.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </button>
            )
          })
        )}
      </div>

      {/* Modal */}
      {modal !== null && (
        <TicketModal
          ticket={modal === 'new' ? null : (modal as TicketRow)}
          clients={clients}
          users={users}
          currentUserId={currentUserId}
          defaultClientId={defaultClientId}
          onClose={() => setModal(null)}
          onSave={handleSave}
          onDelete={isAdmin || (modal !== 'new' && (modal as TicketRow).created_by === currentUserId) ? handleDelete : undefined}
        />
      )}
    </div>
  )
}
