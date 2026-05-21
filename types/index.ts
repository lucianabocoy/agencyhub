export type UserRole = 'admin' | 'trafficker'
export type ClientType = 'ecommerce' | 'servicios'
export type ClientStage = 'onboarding' | 'mantenimiento'
export type ClientStatus = 'activo' | 'pausado' | 'baja'
export type Platform = 'meta_ads' | 'google_ads'
export type Priority = 'urgente' | 'normal' | 'baja'
export type CheckinTaskStatus = 'completada' | 'en_progreso' | 'no_iniciada'
export type KanbanSection = 'info' | 'tareas' | 'en_proceso' | 'completadas' | 'reuniones'
export type TicketStatus = 'nuevo' | 'en_revision' | 'en_proceso' | 'completado'
export type TicketOrigin = 'whatsapp' | 'reunion' | 'email' | 'interno'
export type ObjectiveStatus = 'activo' | 'cumplido' | 'no_cumplido'
export type MetricType = 'cpl' | 'cpc' | 'ctr' | 'conversiones' | 'tasa_conversion' | 'personalizado'
export type NotificationType =
  | 'task_assigned'
  | 'task_mentioned'
  | 'ticket_created'
  | 'checkin_reminder'
  | 'checkout_reminder'
  | 'objective_update'
  | 'client_neglect_warning'
  | 'client_neglect_alarm'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  avatar_url: string | null
  color: string | null
  created_at: string
}

export interface Client {
  id: string
  name: string
  type: ClientType
  stage: ClientStage
  budget: number | null
  platforms: Platform[]
  drive_folder_url: string | null
  website_url: string | null
  start_date: string
  status: ClientStatus
  notes: string | null
  created_at: string
}

export interface ClientAssignment {
  id: string
  client_id: string
  user_id: string
  min_weekly_hours: number
  created_at: string
}

export interface DailyCheckin {
  id: string
  user_id: string
  date: string
  checkin_time: string | null
  checkout_time: string | null
  checkout_completed: boolean
  created_at: string
}

export interface CheckinTask {
  id: string
  checkin_id: string
  client_id: string
  description: string
  priority: Priority
  status: CheckinTaskStatus
  created_at: string
}

export interface TimeEntry {
  id: string
  user_id: string
  client_id: string
  activity_type: string
  description: string | null
  start_time: string
  end_time: string | null
  duration_minutes: number | null
  paused_minutes: number
  is_running: boolean
  is_paused: boolean
  last_paused_at: string | null
  date: string
  created_at: string
}

export interface KanbanTask {
  id: string
  client_id: string
  section: KanbanSection
  title: string
  description: string | null
  priority: Priority
  due_date: string | null
  position: number
  links: string[]
  completed_at: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface KanbanTaskAssignee {
  id: string
  task_id: string
  user_id: string
}

export interface KanbanComment {
  id: string
  task_id: string
  user_id: string
  content: string
  created_at: string
}

export interface Ticket {
  id: string
  client_id: string
  assigned_to: string
  created_by: string
  title: string
  description: string | null
  priority: Priority
  origin: TicketOrigin
  status: TicketStatus
  due_date: string | null
  completed_at: string | null
  created_at: string
}

export interface Objective {
  id: string
  client_id: string
  assigned_to: string
  created_by: string
  period_type: 'semanal' | 'mensual'
  period_start: string
  period_end: string
  metric_type: MetricType
  metric_label: string | null
  current_value: number
  target_value: number
  latest_value: number | null
  status: ObjectiveStatus
  created_at: string
}

export interface PerformanceMetric {
  id: string
  client_id: string
  uploaded_by: string
  period_start: string
  period_end: string
  platform: Platform
  spend: number | null
  impressions: number | null
  clicks: number | null
  ctr: number | null
  cpc: number | null
  conversions: number | null
  cost_per_result: number | null
  conversion_rate: number | null
  raw_data: Record<string, unknown> | null
  created_at: string
}

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  message: string
  reference_type: string | null
  reference_id: string | null
  read: boolean
  created_at: string
}

// ─── Tipos compuestos para queries con joins ──────────────────────────────────

export interface TimeEntryWithClient extends TimeEntry {
  client: Pick<Client, 'id' | 'name'>
}

export interface CheckinTaskWithClient extends CheckinTask {
  client: Pick<Client, 'id' | 'name'>
}

export interface DailyCheckinWithTasks extends DailyCheckin {
  checkin_tasks: CheckinTaskWithClient[]
}

export interface KanbanTaskWithDetails extends KanbanTask {
  assignees: (KanbanTaskAssignee & { user: Pick<User, 'id' | 'name' | 'avatar_url'> })[]
  comments: (KanbanComment & { user: Pick<User, 'id' | 'name' | 'avatar_url'> })[]
}

export interface ClientWithAssignees extends Client {
  assignments: (ClientAssignment & { user: Pick<User, 'id' | 'name' | 'avatar_url'> })[]
}

// ─── Colores por usuario (hardcoded según el equipo) ─────────────────────────

export const USER_COLORS: Record<string, string> = {
  luciana: '#f472b6',
  yesica: '#818cf8',
  luz: '#34d399',
}

export const PRIORITY_COLORS: Record<Priority, string> = {
  urgente: '#f87171',
  normal: '#60a5fa',
  baja: '#8b90a5',
}

export const ACTIVITY_TYPES = [
  'Revisión de cuentas',
  'Análisis de métricas',
  'Creación de campañas',
  'Optimización de campañas',
  'Investigación de mercado',
  'Creación de guiones/creativos',
  'Configuración de cuenta',
  'Reunión con cliente',
  'Reporte',
  'Otro',
] as const
