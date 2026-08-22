import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return null

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', authUser.id)
    .single()

  return (profile as { role?: string } | null)?.role === 'admin'
}

export async function PATCH(request: Request, ctx: RouteContext<'/api/team/[id]'>) {
  const isAdmin = await requireAdmin()
  if (!isAdmin) return NextResponse.json({ error: 'Solo un admin puede editar el equipo' }, { status: 403 })

  const { id } = await ctx.params
  const { name, email, color, note } = await request.json()

  const admin = await createAdminClient()

  if (email) {
    const { error: authError } = await admin.auth.admin.updateUserById(id, { email: email.trim().toLowerCase() })
    if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })
  }

  const profileUpdates: Record<string, string> = {}
  if (name) profileUpdates.name = name.trim()
  if (email) profileUpdates.email = email.trim().toLowerCase()
  if (color) profileUpdates.color = color

  if (Object.keys(profileUpdates).length > 0) {
    const { error: updateError } = await admin.from('users').update(profileUpdates).eq('id', id)
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 })
  }

  if (note !== undefined) {
    const { error: noteError } = await admin
      .from('user_notes')
      .upsert({ user_id: id, note: note || null, updated_at: new Date().toISOString() })
    if (noteError) return NextResponse.json({ error: noteError.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
