export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { type User, type Client, type KanbanTask, type KanbanSection } from '@/types/index'
import { KanbanBoard } from '@/components/kanban/kanban-board'
import { type TaskFull } from '@/components/kanban/task-modal'

export default async function KanbanPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>
}) {
  const { client: initialClientId } = await searchParams
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const { data: profileData } = await supabase
    .from('users').select('role').eq('id', authUser.id).single()
  if (!profileData) redirect('/login')
  const isAdmin = (profileData as Pick<User, 'role'>).role === 'admin'

  // Fetch tasks with assignees + comments
  type RawTask = KanbanTask & {
    assignees: { id: string; user_id: string; users: Pick<User, 'id' | 'name' | 'color' | 'avatar_url'> }[]
    kanban_comments: { id: string; task_id: string; user_id: string; content: string; created_at: string; users: Pick<User, 'id' | 'name' | 'color' | 'avatar_url'> }[]
    clients: Pick<Client, 'id' | 'name'> | null
  }

  const { data: tasksData } = await supabase
    .from('kanban_tasks')
    .select(`
      *,
      assignees:kanban_task_assignees(id, user_id, users(id, name, color, avatar_url)),
      kanban_comments(id, task_id, user_id, content, created_at, users(id, name, color, avatar_url)),
      clients(id, name)
    `)
    .order('position')

  const rawTasks = (tasksData ?? []) as RawTask[]

  // If trafficker: filter to assigned clients only
  let tasks: TaskFull[] = rawTasks as unknown as TaskFull[]
  if (!isAdmin) {
    const { data: assignments } = await supabase
      .from('client_assignments')
      .select('client_id')
      .eq('user_id', authUser.id)
    const assignedClientIds = new Set(((assignments ?? []) as { client_id: string }[]).map((a) => a.client_id))
    tasks = rawTasks.filter((t) => assignedClientIds.has(t.client_id)) as unknown as TaskFull[]
  }

  // Clients list
  let clientsQuery = supabase.from('clients').select('id, name').eq('status', 'activo').order('name')
  if (!isAdmin) {
    const { data: assignments } = await supabase
      .from('client_assignments').select('client_id').eq('user_id', authUser.id)
    const ids = ((assignments ?? []) as { client_id: string }[]).map((a) => a.client_id)
    if (ids.length > 0) clientsQuery = clientsQuery.in('id', ids)
  }
  const { data: clientsData } = await clientsQuery
  const clients = (clientsData ?? []) as Pick<Client, 'id' | 'name'>[]

  // All users
  const { data: usersData } = await supabase
    .from('users').select('id, name, color, avatar_url').order('name')
  const users = (usersData ?? []) as Pick<User, 'id' | 'name' | 'color' | 'avatar_url'>[]

  return (
    <div className="p-6 h-[calc(100vh-52px)] flex flex-col">
      <KanbanBoard
        initialTasks={tasks}
        clients={clients}
        users={users}
        currentUserId={authUser.id}
        isAdmin={isAdmin}
        initialClientId={initialClientId}
      />
    </div>
  )
}
