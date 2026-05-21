'use client'

import { useState } from 'react'

const TIPOS = [
  'Apagar campaña',
  'Cambio de campaña',
  'Nuevo anuncio',
  'Cambio de presupuesto',
  'Consulta general',
  'Otro',
]

interface Props {
  clientId: string
  clientName: string
}

export function SolicitudForm({ clientId, clientName }: Props) {
  const [form, setForm] = useState({
    contactName: '',
    tipo: '',
    description: '',
    urgente: false,
  })
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.tipo || !form.description.trim()) {
      setError('Completá el tipo de solicitud y la descripción.')
      return
    }
    setLoading(true)
    setError(null)

    const res = await fetch('/api/solicitudes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        contact_name: form.contactName.trim() || null,
        tipo: form.tipo,
        description: form.description.trim(),
        urgente: form.urgente,
      }),
    })

    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Error al enviar. Intentá de nuevo.')
      setLoading(false)
      return
    }

    setSent(true)
  }

  if (sent) {
    return (
      <div className="bg-[#1a1d27] border border-[#2d3244] rounded-2xl p-8 text-center space-y-3">
        <div className="text-4xl">✅</div>
        <h2 className="text-[#e4e6ee] font-bold text-lg">¡Solicitud enviada!</h2>
        <p className="text-[#8b90a5] text-sm">
          Recibimos tu pedido y el equipo de {clientName} lo va a revisar pronto.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="bg-[#1a1d27] border border-[#2d3244] rounded-2xl p-6 space-y-5">
      <div>
        <label className="block text-xs font-medium text-[#8b90a5] mb-1.5">Tu nombre (opcional)</label>
        <input
          type="text"
          value={form.contactName}
          onChange={(e) => setForm((p) => ({ ...p, contactName: e.target.value }))}
          placeholder="Ej: María"
          className="w-full px-3 py-2.5 text-sm rounded-lg bg-[#222633] border border-[#2d3244] text-[#e4e6ee] placeholder:text-[#8b90a5] focus:outline-none focus:border-[#818cf8]"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-[#8b90a5] mb-1.5">
          Tipo de solicitud <span className="text-[#f87171]">*</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          {TIPOS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setForm((p) => ({ ...p, tipo: t }))}
              className="px-3 py-2 rounded-lg text-sm text-left transition-colors border"
              style={{
                backgroundColor: form.tipo === t ? '#818cf825' : '#222633',
                borderColor: form.tipo === t ? '#818cf860' : '#2d3244',
                color: form.tipo === t ? '#818cf8' : '#8b90a5',
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-[#8b90a5] mb-1.5">
          Descripción <span className="text-[#f87171]">*</span>
        </label>
        <textarea
          value={form.description}
          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          placeholder="Contanos qué necesitás con el mayor detalle posible..."
          rows={4}
          required
          className="w-full px-3 py-2.5 text-sm rounded-lg bg-[#222633] border border-[#2d3244] text-[#e4e6ee] placeholder:text-[#8b90a5] focus:outline-none focus:border-[#818cf8] resize-none"
        />
      </div>

      <label className="flex items-center gap-3 cursor-pointer select-none">
        <div
          onClick={() => setForm((p) => ({ ...p, urgente: !p.urgente }))}
          className="w-10 h-6 rounded-full transition-colors flex-shrink-0 relative"
          style={{ backgroundColor: form.urgente ? '#f87171' : '#2d3244' }}
        >
          <div
            className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all"
            style={{ left: form.urgente ? '22px' : '4px' }}
          />
        </div>
        <span className="text-sm text-[#8b90a5]">Es urgente</span>
      </label>

      {error && (
        <p className="text-[#f87171] text-sm bg-[#f87171]/10 border border-[#f87171]/20 px-3 py-2 rounded-lg">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
        style={{ backgroundColor: '#818cf8', color: '#0f1117' }}
      >
        {loading ? 'Enviando...' : 'Enviar solicitud'}
      </button>
    </form>
  )
}
