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

export async function PATCH(request: Request, ctx: RouteContext<'/api/administracion/[clientId]'>) {
  if (!(await canAccess())) {
    return NextResponse.json({ error: 'No tenés acceso a Administración' }, { status: 403 })
  }

  const { clientId } = await ctx.params
  const { fee, fee_currency, fee_updated_at, payment_account, needs_invoice, fiscal_data } = await request.json()

  const admin = await createAdminClient()
  const { error } = await admin.from('client_billing').upsert({
    client_id: clientId,
    fee: fee === '' || fee === null || fee === undefined ? null : Number(fee),
    fee_currency: fee_currency || null,
    fee_updated_at: fee_updated_at || null,
    payment_account: payment_account || null,
    needs_invoice: !!needs_invoice,
    fiscal_data: fiscal_data || null,
    updated_at: new Date().toISOString(),
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
