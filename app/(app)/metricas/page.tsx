export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { type User, type PerformanceMetric, type Client } from '@/types/index'
import { MetricsView } from '@/components/metricas/metrics-view'

type MetricRow = PerformanceMetric & {
  client: Pick<Client, 'id' | 'name'> | null
}

export default async function MetricasPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>
}) {
  const { client: clientFilter } = await searchParams
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: profileData } = await supabase
    .from('users').select('role').eq('id', authUser.id).single()
  if (!profileData) redirect('/login')
  const isAdmin = (profileData as Pick<User, 'role'>).role === 'admin'

  let metricsQuery = supabase
    .from('performance_metrics')
    .select('*, client:clients(id, name)')
    .order('period_start', { ascending: false })

  if (!isAdmin) {
    const { data: assignments } = await supabase
      .from('client_assignments').select('client_id').eq('user_id', authUser.id)
    const ids = ((assignments ?? []) as { client_id: string }[]).map((a) => a.client_id)
    if (ids.length > 0) metricsQuery = metricsQuery.in('client_id', ids)
  }

  const { data: metricsData } = await metricsQuery
  const metrics = (metricsData ?? []) as MetricRow[]

  // Clients for filter + modal
  let clientsQuery = supabase.from('clients').select('id, name').eq('status', 'activo').order('name')
  if (!isAdmin) {
    const { data: assignments } = await supabase
      .from('client_assignments').select('client_id').eq('user_id', authUser.id)
    const ids = ((assignments ?? []) as { client_id: string }[]).map((a) => a.client_id)
    if (ids.length > 0) clientsQuery = clientsQuery.in('id', ids)
  }
  const { data: clientsData } = await clientsQuery
  const clients = (clientsData ?? []) as Pick<Client, 'id' | 'name'>[]

  return (
    <div className="p-6 max-w-6xl">
      <MetricsView
        initialMetrics={metrics}
        clients={clients}
        currentUserId={authUser.id}
        defaultClientId={clientFilter}
      />
    </div>
  )
}
