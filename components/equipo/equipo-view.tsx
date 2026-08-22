'use client'

import { useState } from 'react'
import { UserPlus, X, Copy, Check, Pencil, Briefcase, StickyNote } from 'lucide-react'
import { type User } from '@/types/index'

const COLOR_OPTIONS = ['#818cf8', '#34d399', '#f472b6', '#fbbf24', '#f97316', '#60a5fa', '#a78bfa', '#f87171']

export interface TeamMember extends User {
  clients: { id: string; name: string; status: string }[]
  note: string | null
}

interface Props {
  team: TeamMember[]
}

export function EquipoView({ team }: Props) {
  const [open, setOpen] = useState(false)
  const [list, setList] = useState(team)
  const [created, setCreated] = useState<{ name: string; email: string; tempPassword: string } | null>(null)
  const [selected, setSelected] = useState<TeamMember | null>(null)

  function handleCreated(user: User, tempPassword: string) {
    const member: TeamMember = { ...user, clients: [], note: null }
    setList((prev) => [...prev, member].sort((a, b) => a.name.localeCompare(b.name)))
    setCreated({ name: user.name, email: user.email, tempPassword })
    setOpen(false)
  }

  function handleUpdated(updated: TeamMember) {
    setList((prev) => prev.map((u) => (u.id === updated.id ? updated : u)).sort((a, b) => a.name.localeCompare(b.name)))
    setSelected(updated)
  }

  return (
    <div className="space-y-4">
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 bg-yesica text-bg text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity"
      >
        <UserPlus size={16} />
        Nueva trafficker
      </button>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="divide-y divide-border">
          {list.map((u) => {
            const initials = u.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
            return (
              <button
                key={u.id}
                onClick={() => setSelected(u)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition-colors text-left"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-bg flex-shrink-0"
                  style={{ backgroundColor: u.color ?? '#818cf8' }}
                >
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text truncate">{u.name}</p>
                  <p className="text-xs text-muted truncate">{u.email}</p>
                </div>
                <span
                  className={`px-2 py-1 rounded-md text-[11px] font-semibold capitalize ${
                    u.role === 'admin' ? 'bg-luciana/15 text-luciana' : 'bg-yesica/15 text-yesica'
                  }`}
                >
                  {u.role}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {open && <NuevaUsuariaModal onClose={() => setOpen(false)} onCreated={handleCreated} />}
      {created && <CredencialesModal data={created} onClose={() => setCreated(null)} />}
      {selected && (
        <DetalleUsuariaModal member={selected} onClose={() => setSelected(null)} onUpdated={handleUpdated} />
      )}
    </div>
  )
}

function DetalleUsuariaModal({
  member,
  onClose,
  onUpdated,
}: {
  member: TeamMember
  onClose: () => void
  onUpdated: (updated: TeamMember) => void
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(member.name)
  const [email, setEmail] = useState(member.email)
  const [color, setColor] = useState(member.color ?? COLOR_OPTIONS[0])
  const [note, setNote] = useState(member.note ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const initials = member.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)

  async function handleSave() {
    if (!name.trim() || !email.trim()) { setError('Nombre y email son obligatorios.'); return }

    setLoading(true)
    setError(null)

    const res = await fetch(`/api/team/${member.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), email: email.trim(), color, note: note.trim() }),
    })
    const json = await res.json()

    if (!res.ok) {
      setError(json.error ?? 'No se pudieron guardar los cambios.')
      setLoading(false)
      return
    }

    setLoading(false)
    setEditing(false)
    onUpdated({ ...member, name: name.trim(), email: email.trim().toLowerCase(), color, note: note.trim() || null })
  }

  function handleCancel() {
    setName(member.name)
    setEmail(member.email)
    setColor(member.color ?? COLOR_OPTIONS[0])
    setNote(member.note ?? '')
    setError(null)
    setEditing(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-surface border border-border rounded-xl w-full max-w-md max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-bg flex-shrink-0"
              style={{ backgroundColor: editing ? color : member.color ?? '#818cf8' }}
            >
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text truncate">{member.name}</p>
              <span
                className={`inline-block mt-0.5 px-2 py-0.5 rounded-md text-[11px] font-semibold capitalize ${
                  member.role === 'admin' ? 'bg-luciana/15 text-luciana' : 'bg-yesica/15 text-yesica'
                }`}
              >
                {member.role}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-muted hover:text-text flex-shrink-0">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {!editing ? (
            <>
              <div>
                <p className="text-xs font-medium text-muted mb-1">Email</p>
                <p className="text-sm text-text">{member.email}</p>
              </div>

              <div>
                <p className="text-xs font-medium text-muted mb-2 flex items-center gap-1.5">
                  <Briefcase size={13} /> Cuentas a cargo
                </p>
                {member.clients.length === 0 ? (
                  <p className="text-sm text-muted">Sin cuentas asignadas.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {member.clients.map((c) => (
                      <span key={c.id} className="px-2.5 py-1 rounded-lg bg-surface-2 border border-border text-xs text-text">
                        {c.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-medium text-muted mb-1.5 flex items-center gap-1.5">
                  <StickyNote size={13} /> Notas (solo admin)
                </p>
                <p className="text-sm text-text whitespace-pre-wrap">
                  {member.note || <span className="text-muted">Sin notas.</span>}
                </p>
              </div>

              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-lg border border-border text-muted hover:text-text transition-colors"
              >
                <Pencil size={14} />
                Editar información
              </button>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">Nombre</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-7 h-7 rounded-full transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-offset-surface ring-text scale-110' : ''}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-muted mb-2 flex items-center gap-1.5">
                  <Briefcase size={13} /> Cuentas a cargo
                </p>
                {member.clients.length === 0 ? (
                  <p className="text-sm text-muted">Sin cuentas asignadas.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {member.clients.map((c) => (
                      <span key={c.id} className="px-2.5 py-1 rounded-lg bg-surface-2 border border-border text-xs text-text">
                        {c.name}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-[11px] text-muted mt-1.5">Las cuentas se asignan desde cada cliente.</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted mb-1.5 flex items-center gap-1.5">
                  <StickyNote size={13} /> Notas (solo admin, ej. cuánto cobra)
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="Ej: $X por hora, forma de pago, etc."
                  className="w-full px-3 py-2.5 text-sm rounded-lg resize-none"
                />
              </div>

              {error && (
                <p className="text-danger text-sm bg-danger/10 border border-danger/20 px-3 py-2 rounded-lg">{error}</p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border border-border text-muted hover:text-text transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold rounded-lg bg-yesica text-bg hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {loading ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function NuevaUsuariaModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (user: User, tempPassword: string) => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [color, setColor] = useState(COLOR_OPTIONS[0])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !email.trim()) { setError('Nombre y email son obligatorios.'); return }

    setLoading(true)
    setError(null)

    const res = await fetch('/api/team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), email: email.trim(), color }),
    })
    const json = await res.json()

    if (!res.ok) {
      setError(json.error ?? 'No se pudo crear la usuaria.')
      setLoading(false)
      return
    }

    onCreated(
      {
        id: json.id ?? crypto.randomUUID(),
        email: json.email,
        name: name.trim(),
        role: 'trafficker',
        avatar_url: null,
        color,
        created_at: new Date().toISOString(),
      },
      json.tempPassword
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-surface border border-border rounded-xl w-full max-w-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-text">Nueva trafficker</h2>
          <button onClick={onClose} className="text-muted hover:text-text">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Nombre</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre de la trafficker"
              className="w-full px-3 py-2.5 text-sm rounded-lg"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@ejemplo.com"
              className="w-full px-3 py-2.5 text-sm rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-offset-surface ring-text scale-110' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {error && (
            <p className="text-danger text-sm bg-danger/10 border border-danger/20 px-3 py-2 rounded-lg">{error}</p>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border border-border text-muted hover:text-text transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 text-sm font-semibold rounded-lg bg-yesica text-bg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? 'Creando...' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function CredencialesModal({
  data,
  onClose,
}: {
  data: { name: string; email: string; tempPassword: string }
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(`Email: ${data.email}\nContraseña temporal: ${data.tempPassword}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-surface border border-border rounded-xl w-full max-w-sm p-5">
        <h2 className="text-sm font-semibold text-text mb-1">¡{data.name} ya tiene acceso!</h2>
        <p className="text-muted text-xs mb-4">
          Compartile estos datos para que entre. Esta contraseña no se vuelve a mostrar.
        </p>

        <div className="bg-surface-2 border border-border rounded-lg p-3 space-y-1.5 mb-4 font-mono text-xs">
          <p className="text-text"><span className="text-muted">Email:</span> {data.email}</p>
          <p className="text-text"><span className="text-muted">Contraseña:</span> {data.tempPassword}</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={copy}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-lg border border-border text-muted hover:text-text transition-colors"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copiado' : 'Copiar'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm font-semibold rounded-lg bg-yesica text-bg hover:opacity-90 transition-opacity"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  )
}
