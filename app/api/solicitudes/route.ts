import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const { client_id, contact_name, tipo, description, urgente } = await req.json()

    if (!client_id || !tipo || !description) {
      return NextResponse.json({ error: 'Faltan campos requeridos.' }, { status: 400 })
    }

    // Find assignee for this client (first trafficker assigned, fallback to admin)
    const { data: assignments } = await adminClient
      .from('client_assignments')
      .select('user_id')
      .eq('client_id', client_id)
      .limit(1)

    let assigneeId: string | null = (assignments ?? [])[0]?.user_id ?? null

    if (!assigneeId) {
      const { data: admin } = await adminClient
        .from('users')
        .select('id')
        .eq('role', 'admin')
        .single()
      assigneeId = (admin as { id: string } | null)?.id ?? null
    }

    if (!assigneeId) {
      return NextResponse.json({ error: 'No hay responsable configurado para este cliente.' }, { status: 400 })
    }

    const title = contact_name
      ? `${tipo} — de ${contact_name}`
      : tipo

    const { error } = await adminClient.from('tickets').insert({
      client_id,
      title,
      description,
      status: 'nuevo',
      priority: urgente ? 'urgente' : 'normal',
      origin: 'cliente',
      assigned_to: assigneeId,
      created_by: assigneeId,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 })
  }
}
