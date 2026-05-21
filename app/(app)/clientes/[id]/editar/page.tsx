'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { type Client, type User, type ClientType, type ClientStage, type ClientStatus, type Platform } from '@/types/index'

export default function EditarClientePage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [allUsers, setAllUsers] = useState<Pick<User, 'id' | 'name' | 'color'>[]>([])
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [form, setForm] = useState({
    name: '',
    type: 'servicios' as ClientType,
    stage: 'onboarding' as ClientStage,
    status: 'activo' as ClientStatus,
    budget: '',
    platforms: [] as Platform[],
    drive_folder_url: '',
    website_url: '',
    start_date: new Date().toISOString().slice(0, 10),
    notes: '',
  })

  useEffect(() => {
    async function load() {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      const { data: profileData } = authUser
        ? await supabase.from('users').select('role').eq('id', authUser.id).single()
        : { data: null }
      const role = (profileData as { role: string } | null)?.role
      setIsAdmin(role === 'admin')

      const [{ data: clientData }, { data: usersData }, { data: assignmentsData }] = await Promise.all([
        supabase.from('clients').select('*').eq('id', id).single(),
        supabase.from('users').select('id, name, color').order('name'),
        supabase.from('client_assignments').select('user_id').eq('client_id', id),
      ])

      if (clientData) {
        const c = clientData as Client
        setForm({
          name: c.name,
          type: c.type,
          stage: c.stage,
          status: c.status,
          budget: c.budget?.toString() ?? '',
          platforms: c.platforms as Platform[],
          drive_folder_url: c.drive_folder_url ?? '',
          website_url: c.website_url ?? '',
          start_date: c.start_date,
          notes: c.notes ?? '',
        })
      }
      if (usersData) setAllUsers(usersData as Pick<User, 'id' | 'name' | 'color'>[])
      if (assignmentsData) setSelectedUsers((assignmentsData as { user_id: string }[]).map((a) => a.user_id))
      setFetching(false)
    }
    load()
  }, [id])

  function toggleUser(userId: string) {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((u) => u !== userId) : [...prev, userId]
    )
  }

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

    const { error: err } = await supabase
      .from('clients')
      .update({
        name: form.name.trim(),
        type: form.type,
        stage: form.stage,
        status: form.status,
        budget: form.budget ? parseFloat(form.budget) : null,
        platforms: form.platforms,
        drive_folder_url: form.drive_folder_url || null,
        website_url: form.website_url || null,
        start_date: form.start_date,
        notes: form.notes || null,
      })
      .eq('id', id)

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    // Sync assignments: delete all, re-insert selected
    await supabase.from('client_assignments').delete().eq('client_id', id)
    if (selectedUsers.length > 0) {
      await supabase.from('client_assignments').insert(
        selectedUsers.map((uid) => ({ client_id: id, user_id: uid, min_weekly_hours: 2 }))
      )
    }

    router.push(`/clientes/${id}`)
    router.refresh()
  }

  const inputCls = 'w-full px-3 py-2.5 text-sm rounded-lg'
  const labelCls = 'block text-xs font-medium text-muted mb-1.5'
  const sectionCls = 'bg-surface border border-border rounded-xl p-5 space-y-4'

  if (fetching) {
    return <div className="p-6 text-muted text-sm">Cargando...</div>
  }

  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-xl font-bold text-text mb-6">Editar cliente</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className={sectionCls}>
          <h2 className="text-sm font-semibold text-text">Datos básicos</h2>
          <div>
            <label className={labelCls}>Nombre <span className="text-danger">*</span></label>
            <input
              type="text" value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              required className={inputCls}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Tipo</label>
              <select
                value={form.type}
                onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as ClientType }))}
                className={inputCls}
              >
                <option value="servicios">Servicios</option>
                <option value="ecommerce">Ecommerce</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Etapa</label>
              <select
                value={form.stage}
                onChange={(e) => setForm((p) => ({ ...p, stage: e.target.value as ClientStage }))}
                className={inputCls}
              >
                <option value="onboarding">Onboarding</option>
                <option value="mantenimiento">Mantenimiento</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Estado</label>
            <select
              value={form.status}
              onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as ClientStatus }))}
              className={inputCls}
            >
              <option value="activo">Activo</option>
              <option value="pausado">Pausado</option>
              <option value="baja">Baja</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Presupuesto mensual (ARS)</label>
            <input
              type="number" value={form.budget}
              onChange={(e) => setForm((p) => ({ ...p, budget: e.target.value }))}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Fecha de inicio</label>
            <input
              type="date" value={form.start_date}
              onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))}
              className={inputCls}
            />
          </div>
        </div>

        <div className={sectionCls}>
          <h2 className="text-sm font-semibold text-text">Plataformas</h2>
          <div className="flex gap-3">
            {(['meta_ads', 'google_ads'] as Platform[]).map((p) => (
              <button
                key={p} type="button" onClick={() => togglePlatform(p)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  form.platforms.includes(p)
                    ? 'bg-yesica/15 text-yesica border-yesica/30'
                    : 'bg-surface-2 text-muted border-border hover:border-yesica/30'
                }`}
              >
                {p === 'meta_ads' ? 'Meta Ads' : 'Google Ads'}
              </button>
            ))}
          </div>
        </div>

        <div className={sectionCls}>
          <h2 className="text-sm font-semibold text-text">Links útiles</h2>
          <div>
            <label className={labelCls}>Carpeta de Drive</label>
            <input
              type="url" value={form.drive_folder_url}
              onChange={(e) => setForm((p) => ({ ...p, drive_folder_url: e.target.value }))}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Sitio web</label>
            <input
              type="url" value={form.website_url}
              onChange={(e) => setForm((p) => ({ ...p, website_url: e.target.value }))}
              className={inputCls}
            />
          </div>
        </div>

        {isAdmin && (
          <div className={sectionCls}>
            <h2 className="text-sm font-semibold text-text">Responsables</h2>
            <div className="flex flex-wrap gap-2">
              {allUsers.map((u) => {
                const selected = selectedUsers.includes(u.id)
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => toggleUser(u.id)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors"
                    style={{
                      backgroundColor: selected ? (u.color ?? '#818cf8') + '25' : 'transparent',
                      borderColor: selected ? (u.color ?? '#818cf8') + '60' : '#2d3244',
                      color: selected ? (u.color ?? '#818cf8') : '#8b90a5',
                    }}
                  >
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-bg flex-shrink-0"
                      style={{ backgroundColor: u.color ?? '#818cf8' }}
                    >
                      {u.name.charAt(0)}
                    </span>
                    {u.name}
                  </button>
                )
              })}
            </div>
            {selectedUsers.length === 0 && (
              <p className="text-xs text-muted">Sin responsables asignados</p>
            )}
          </div>
        )}

        <div className={sectionCls}>
          <h2 className="text-sm font-semibold text-text">Notas</h2>
          <textarea
            value={form.notes}
            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            rows={3} className={`${inputCls} resize-none`}
          />
        </div>

        {error && (
          <p className="text-danger text-sm bg-danger/10 border border-danger/20 px-3 py-2 rounded-lg">{error}</p>
        )}

        <div className="flex gap-3 pt-1">
          <button
            type="button" onClick={() => router.back()}
            className="px-5 py-2.5 border border-border text-muted hover:text-text hover:border-muted rounded-lg text-sm transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit" disabled={loading}
            className="px-5 py-2.5 bg-yesica hover:bg-yesica/80 text-bg font-semibold rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {loading ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </div>
  )
}
