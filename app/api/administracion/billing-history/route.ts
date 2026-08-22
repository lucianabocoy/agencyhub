import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

async function canAccess() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return false

  const { data: profile } = await supabase
    .from('users')
    .select('role, can_view_finance')
    .eq('id', authUser.id)
    .single()

  const p = profile as { role?: string; can_view_finance?: boolean } | null
  return p?.role === 'admin' || p?.can_view_finance === true
}

export async function POST(request: Request) {
  if (!(await canAccess())) {
    return NextResponse.json({ error: 'No tenés acceso a Administración' }, { status: 403 })
  }

  const { client_id, month, amount, currency } = await request.json()
  if (!client_id || !month) {
    return NextResponse.json({ error: 'Falta client_id o month' }, { status: 400 })
  }

  const admin = await createAdminClient()
  const { error } = await admin.from('client_billing_history').upsert({
    client_id,
    month,
    amount: amount === '' || amount === null || amount === undefined ? null : Number(amount),
    currency: currency || null,
    updated_at: new Date().toISOString(),
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
