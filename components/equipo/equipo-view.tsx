'use client'

import { useState } from 'react'
import { UserPlus, X, Copy, Check } from 'lucide-react'
import { type User } from '@/types/index'

const COLOR_OPTIONS = ['#818cf8', '#34d399', '#f472b6', '#fbbf24', '#f97316', '#60a5fa', '#a78bfa', '#f87171']

interface Props {
  team: User[]
}

export function EquipoView({ team }: Props) {
  const [open, setOpen] = useState(false)
  const [list, setList] = useState(team)
  const [created, setCreated] = useState<{ name: string; email: string; tempPassword: string } | null>(null)

  function handleCreated(user: User, tempPassword: string) {
    setList((prev) => [...prev, user].sort((a, b) => a.name.localeCompare(b.name)))
    setCreated({ name: user.name, email: user.email, tempPassword })
    setOpen(false)
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
              <div key={u.id} className="flex items-center gap-3 px-4 py-3">
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
              </div>
            )
          })}
        </div>
      </div>

      {open && <NuevaUsuariaModal onClose={() => setOpen(false)} onCreated={handleCreated} />}
      {created && <CredencialesModal data={created} onClose={() => setCreated(null)} />}
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
