import { createClient } from '@/lib/supabase/server'
import { SolicitudForm } from '@/components/public/solicitud-form'
import { notFound } from 'next/navigation'

export default async function SolicitudPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params
  const supabase = await createClient()

  const { data } = await supabase
    .from('clients')
    .select('id, name, status')
    .eq('id', clientId)
    .single()

  if (!data || (data as { status: string }).status === 'baja') notFound()

  const client = data as { id: string; name: string; status: string }

  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#818cf8]/20 border border-[#818cf8]/30 mb-4">
            <span className="font-mono font-bold text-[#818cf8] text-sm">AH</span>
          </div>
          <h1 className="text-[#e4e6ee] text-xl font-bold">Solicitud de cambio</h1>
          <p className="text-[#8b90a5] text-sm mt-1">{client.name}</p>
        </div>
        <SolicitudForm clientId={client.id} clientName={client.name} />
      </div>
    </div>
  )
}
