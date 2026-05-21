'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { type ClientType, type ClientStage, type Platform } from '@/types/index'

export default function NuevoClientePage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: '',
    type: 'servicios' as ClientType,
    stage: 'onboarding' as ClientStage,
    budget: '',
    platforms: [] as Platform[],
    drive_folder_url: '',
    website_url: '',
    start_date: new Date().toISOString().slice(0, 10),
    notes: '',
  })

  function togglePlatform(p: Platform) {
    setForm((prev) => ({
      ...prev,
      platforms: prev.platforms.includes(p)
        ? prev.platforms.filter((x) => x !== p)
        : [...prev.platforms, p],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('El nombre es obligatorio.'); return }

    setLoading(true)
    setError(null)

    const { error } = await supabase.from('clients').insert({
      name: form.name.trim(),
      type: form.type,
      stage: form.stage,
      budget: form.budget ? parseFloat(form.budget) : null,
      platforms: form.platforms,
      drive_folder_url: form.drive_folder_url || null,
      website_url: form.website_url || null,
      start_date: form.start_date,
      notes: form.notes || null,
      status: 'activo',
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/clientes')
    router.refresh()
  }

  const inputCls = 'w-full px-3 py-2.5 text-sm rounded-lg'
  const labelCls = 'block text-xs font-medium text-muted mb-1.5'
  const sectionCls = 'bg-surface border border-border rounded-xl p-5 space-y-4'

  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-xl font-bold text-text mb-6">Nuevo cliente</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className={sectionCls}>
          <h2 className="text-sm font-semibold text-text">Datos básicos</h2>

          <div>
            <label className={labelCls}>Nombre <span className="text-danger">*</span></label>
            <input type="text" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Nombre del cliente" required className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Tipo</label>
              <select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as ClientType }))}
                className={inputCls}>
                <option value="servicios">Servicios</option>
                <option value="ecommerce">Ecommerce</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Etapa</label>
              <select value={form.stage} onChange={(e) => setForm((p) => ({ ...p, stage: e.target.value as ClientStage }))}
                className={inputCls}>
                <option value="onboarding">Onboarding</option>
                <option value="mantenimiento">Mantenimiento</option>
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Presupuesto mensual (ARS)</label>
            <input type="number" value={form.budget} onChange={(e) => setForm((p) => ({ ...p, budget: e.target.value }))}
              placeholder="Ej: 150000" className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Fecha de inicio</label>
            <input type="date" value={form.start_date} onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))}
              className={inputCls} />
          </div>
        </div>

        <div className={sectionCls}>
          <h2 className="text-sm font-semibold text-text">Plataformas</h2>
          <div className="flex gap-3">
            {(['meta_ads', 'google_ads'] as Platform[]).map((p) => (
              <button key={p} type="button" onClick={() => togglePlatform(p)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  form.platforms.includes(p)
                    ? 'bg-yesica/15 text-yesica border-yesica/30'
                    : 'bg-surface-2 text-muted border-border hover:border-yesica/30'
                }`}>
                {p === 'meta_ads' ? 'Meta Ads' : 'Google Ads'}
              </button>
            ))}
          </div>
        </div>

        <div className={sectionCls}>
          <h2 className="text-sm font-semibold text-text">Links útiles</h2>
          <div>
            <label className={labelCls}>Carpeta de Drive</label>
            <input type="url" value={form.drive_folder_url} onChange={(e) => setForm((p) => ({ ...p, drive_folder_url: e.target.value }))}
              placeholder="https://drive.google.com/..." className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Sitio web</label>
            <input type="url" value={form.website_url} onChange={(e) => setForm((p) => ({ ...p, website_url: e.target.value }))}
              placeholder="https://..." className={inputCls} />
          </div>
        </div>

        <div className={sectionCls}>
          <h2 className="text-sm font-semibold text-text">Notas</h2>
          <textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            rows={3} placeholder="Información relevante del cliente..." className={`${inputCls} resize-none`} />
        </div>

        {error && (
          <p className="text-danger text-sm bg-danger/10 border border-danger/20 px-3 py-2 rounded-lg">{error}</p>
        )}

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={() => router.back()}
            className="px-5 py-2.5 border border-border text-muted hover:text-text hover:border-muted rounded-lg text-sm transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={loading}
            className="px-5 py-2.5 bg-yesica hover:bg-yesica/80 text-bg font-semibold rounded-lg text-sm transition-colors disabled:opacity-50">
            {loading ? 'Creando...' : 'Crear cliente'}
          </button>
        </div>
      </form>
    </div>
  )
}
