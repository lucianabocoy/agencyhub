import { randomBytes } from 'crypto'
import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

function generateTempPassword(length = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  return Array.from(randomBytes(length), (b) => chars[b % chars.length]).join('')
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', authUser.id)
    .single()

  if ((profile as { role?: string } | null)?.role !== 'admin') {
    return NextResponse.json({ error: 'Solo un admin puede crear usuarias' }, { status: 403 })
  }

  const { name, email, color } = await request.json()
  if (!name?.trim() || !email?.trim()) {
    return NextResponse.json({ error: 'Nombre y email son obligatorios' }, { status: 400 })
  }

  const tempPassword = generateTempPassword()
  const admin = await createAdminClient()
  const { data, error } = await admin.auth.admin.createUser({
    email: email.trim().toLowerCase(),
    password: tempPassword,
    email_confirm: true,
    user_metadata: { name: name.trim(), role: 'trafficker', color: color || '#818cf8' },
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true, id: data.user.id, email: data.user.email, tempPassword })
}
