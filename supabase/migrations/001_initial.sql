-- =============================================
-- TIPOS ENUM
-- =============================================

CREATE TYPE user_role       AS ENUM ('admin', 'trafficker');
CREATE TYPE client_type     AS ENUM ('ecommerce', 'servicios');
CREATE TYPE client_stage    AS ENUM ('onboarding', 'mantenimiento');
CREATE TYPE client_status   AS ENUM ('activo', 'pausado', 'baja');
CREATE TYPE priority_level  AS ENUM ('urgente', 'normal', 'baja');
CREATE TYPE task_status     AS ENUM ('completada', 'en_progreso', 'no_iniciada');
CREATE TYPE kanban_section  AS ENUM ('info', 'tareas', 'en_proceso', 'completadas', 'reuniones');
CREATE TYPE ticket_status   AS ENUM ('nuevo', 'en_revision', 'en_proceso', 'completado');
CREATE TYPE ticket_origin   AS ENUM ('whatsapp', 'reunion', 'email', 'interno');
CREATE TYPE objective_status AS ENUM ('activo', 'cumplido', 'no_cumplido');
CREATE TYPE metric_type     AS ENUM ('cpl', 'cpc', 'ctr', 'conversiones', 'tasa_conversion', 'personalizado');
CREATE TYPE platform_type   AS ENUM ('meta_ads', 'google_ads');
CREATE TYPE notification_type AS ENUM (
  'task_assigned', 'task_mentioned', 'ticket_created',
  'checkin_reminder', 'checkout_reminder', 'objective_update',
  'client_neglect_warning', 'client_neglect_alarm'
);

-- =============================================
-- TABLA: users
-- =============================================

CREATE TABLE public.users (
  id         uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      text        UNIQUE NOT NULL,
  name       text        NOT NULL,
  role       user_role   NOT NULL DEFAULT 'trafficker',
  avatar_url text,
  color      text        DEFAULT '#818cf8',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================
-- TABLA: clients
-- =============================================

CREATE TABLE public.clients (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text          UNIQUE NOT NULL,
  type             client_type   NOT NULL,
  stage            client_stage  NOT NULL DEFAULT 'onboarding',
  budget           numeric,
  platforms        text[]        NOT NULL DEFAULT '{}',
  drive_folder_url text,
  website_url      text,
  start_date       date          NOT NULL DEFAULT CURRENT_DATE,
  status           client_status NOT NULL DEFAULT 'activo',
  notes            text,
  created_at       timestamptz   NOT NULL DEFAULT now()
);

-- =============================================
-- TABLA: client_assignments
-- =============================================

CREATE TABLE public.client_assignments (
  id               uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        uuid    NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id          uuid    NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  min_weekly_hours numeric NOT NULL DEFAULT 1.0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, user_id)
);

CREATE INDEX idx_assignments_user ON public.client_assignments (user_id);
CREATE INDEX idx_assignments_client ON public.client_assignments (client_id);

-- =============================================
-- TABLA: daily_checkins
-- =============================================

CREATE TABLE public.daily_checkins (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date               date        NOT NULL,
  checkin_time       timestamptz,
  checkout_time      timestamptz,
  checkout_completed boolean     NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

CREATE INDEX idx_checkins_user_date ON public.daily_checkins (user_id, date DESC);

-- =============================================
-- TABLA: checkin_tasks
-- =============================================

CREATE TABLE public.checkin_tasks (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  checkin_id  uuid        NOT NULL REFERENCES public.daily_checkins(id) ON DELETE CASCADE,
  client_id   uuid        NOT NULL REFERENCES public.clients(id),
  description text        NOT NULL,
  priority    priority_level NOT NULL DEFAULT 'normal',
  status      task_status NOT NULL DEFAULT 'no_iniciada',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- =============================================
-- TABLA: time_entries
-- =============================================

CREATE TABLE public.time_entries (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  client_id        uuid        NOT NULL REFERENCES public.clients(id),
  activity_type    text        NOT NULL,
  description      text,
  start_time       timestamptz NOT NULL DEFAULT now(),
  end_time         timestamptz,
  duration_minutes numeric,
  paused_minutes   numeric     NOT NULL DEFAULT 0,
  is_running       boolean     NOT NULL DEFAULT false,
  is_paused        boolean     NOT NULL DEFAULT false,
  last_paused_at   timestamptz,
  date             date        NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_time_user_date ON public.time_entries (user_id, date DESC);
CREATE INDEX idx_time_client     ON public.time_entries (client_id, date DESC);
CREATE INDEX idx_time_running    ON public.time_entries (user_id, is_running) WHERE is_running = true;

-- =============================================
-- TABLA: kanban_tasks
-- =============================================

CREATE TABLE public.kanban_tasks (
  id           uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    uuid           NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  section      kanban_section NOT NULL DEFAULT 'tareas',
  title        text           NOT NULL,
  description  text,
  priority     priority_level NOT NULL DEFAULT 'normal',
  due_date     date,
  position     integer        NOT NULL DEFAULT 0,
  links        text[]         NOT NULL DEFAULT '{}',
  completed_at timestamptz,
  created_by   uuid           NOT NULL REFERENCES public.users(id),
  created_at   timestamptz    NOT NULL DEFAULT now(),
  updated_at   timestamptz    NOT NULL DEFAULT now()
);

CREATE INDEX idx_kanban_client_section ON public.kanban_tasks (client_id, section, position);

-- =============================================
-- TABLA: kanban_task_assignees
-- =============================================

CREATE TABLE public.kanban_task_assignees (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.kanban_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  UNIQUE (task_id, user_id)
);

-- =============================================
-- TABLA: kanban_comments
-- =============================================

CREATE TABLE public.kanban_comments (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    uuid        NOT NULL REFERENCES public.kanban_tasks(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES public.users(id),
  content    text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================
-- TABLA: tickets
-- =============================================

CREATE TABLE public.tickets (
  id           uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    uuid           NOT NULL REFERENCES public.clients(id),
  assigned_to  uuid           NOT NULL REFERENCES public.users(id),
  created_by   uuid           NOT NULL REFERENCES public.users(id),
  title        text           NOT NULL,
  description  text,
  priority     priority_level NOT NULL DEFAULT 'normal',
  origin       ticket_origin  NOT NULL,
  status       ticket_status  NOT NULL DEFAULT 'nuevo',
  due_date     date,
  completed_at timestamptz,
  created_at   timestamptz    NOT NULL DEFAULT now()
);

CREATE INDEX idx_tickets_assigned ON public.tickets (assigned_to, status);
CREATE INDEX idx_tickets_client   ON public.tickets (client_id, status);

-- =============================================
-- TABLA: objectives
-- =============================================

CREATE TABLE public.objectives (
  id            uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     uuid             NOT NULL REFERENCES public.clients(id),
  assigned_to   uuid             NOT NULL REFERENCES public.users(id),
  created_by    uuid             NOT NULL REFERENCES public.users(id),
  period_type   text             NOT NULL CHECK (period_type IN ('semanal', 'mensual')),
  period_start  date             NOT NULL,
  period_end    date             NOT NULL,
  metric_type   metric_type      NOT NULL,
  metric_label  text,
  current_value numeric          NOT NULL,
  target_value  numeric          NOT NULL,
  latest_value  numeric,
  status        objective_status NOT NULL DEFAULT 'activo',
  created_at    timestamptz      NOT NULL DEFAULT now()
);

-- =============================================
-- TABLA: performance_metrics
-- =============================================

CREATE TABLE public.performance_metrics (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid          NOT NULL REFERENCES public.clients(id),
  uploaded_by     uuid          NOT NULL REFERENCES public.users(id),
  period_start    date          NOT NULL,
  period_end      date          NOT NULL,
  platform        platform_type NOT NULL,
  spend           numeric,
  impressions     integer,
  clicks          integer,
  ctr             numeric,
  cpc             numeric,
  conversions     integer,
  cost_per_result numeric,
  conversion_rate numeric,
  raw_data        jsonb,
  created_at      timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (client_id, period_start, period_end, platform)
);

-- =============================================
-- TABLA: notifications
-- =============================================

CREATE TABLE public.notifications (
  id             uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid              NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type           notification_type NOT NULL,
  title          text              NOT NULL,
  message        text              NOT NULL,
  reference_type text,
  reference_id   uuid,
  read           boolean           NOT NULL DEFAULT false,
  created_at     timestamptz       NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread ON public.notifications (user_id, read, created_at DESC);

-- =============================================
-- FUNCIONES AUXILIARES
-- =============================================

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.users WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Trigger: updated_at en kanban_tasks
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER kanban_tasks_updated_at
  BEFORE UPDATE ON public.kanban_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger: crear perfil al registrarse
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role, color)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'trafficker'),
    COALESCE(NEW.raw_user_meta_data->>'color', '#818cf8')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

ALTER TABLE public.users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_checkins     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkin_tasks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_tasks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_task_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_comments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.objectives         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications      ENABLE ROW LEVEL SECURITY;

-- users
CREATE POLICY "users_read_all"    ON public.users FOR SELECT USING (true);
CREATE POLICY "users_update_self" ON public.users FOR UPDATE USING (auth.uid() = id);

-- clients: admin ve todos; trafficker solo ve sus clientes asignados
CREATE POLICY "clients_read"         ON public.clients FOR SELECT USING (
  get_user_role() = 'admin'
  OR EXISTS (SELECT 1 FROM public.client_assignments ca WHERE ca.client_id = id AND ca.user_id = auth.uid())
);
CREATE POLICY "clients_admin_write"  ON public.clients FOR ALL    USING (get_user_role() = 'admin');

-- client_assignments: todos ven; solo admin modifica
CREATE POLICY "assignments_read"         ON public.client_assignments FOR SELECT USING (true);
CREATE POLICY "assignments_admin_write"  ON public.client_assignments FOR ALL    USING (get_user_role() = 'admin');

-- daily_checkins: cada uno ve los suyos; admin ve todos
CREATE POLICY "checkins_own" ON public.daily_checkins
  FOR SELECT USING (user_id = auth.uid() OR get_user_role() = 'admin');
CREATE POLICY "checkins_insert" ON public.daily_checkins
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "checkins_update" ON public.daily_checkins
  FOR UPDATE USING (user_id = auth.uid() OR get_user_role() = 'admin');

-- checkin_tasks: ve los propios (via checkin); admin ve todos
CREATE POLICY "checkin_tasks_own" ON public.checkin_tasks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.daily_checkins dc
            WHERE dc.id = checkin_id AND (dc.user_id = auth.uid() OR get_user_role() = 'admin'))
  );
CREATE POLICY "checkin_tasks_insert" ON public.checkin_tasks
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.daily_checkins dc WHERE dc.id = checkin_id AND dc.user_id = auth.uid())
  );
CREATE POLICY "checkin_tasks_update" ON public.checkin_tasks
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.daily_checkins dc
            WHERE dc.id = checkin_id AND (dc.user_id = auth.uid() OR get_user_role() = 'admin'))
  );

-- time_entries: propios + admin ve todos
CREATE POLICY "time_own"          ON public.time_entries FOR SELECT USING (user_id = auth.uid() OR get_user_role() = 'admin');
CREATE POLICY "time_insert"       ON public.time_entries FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "time_update"       ON public.time_entries FOR UPDATE USING (user_id = auth.uid() OR get_user_role() = 'admin');

-- kanban_tasks: admin ve todos; trafficker solo ve tareas de sus clientes asignados
CREATE POLICY "kanban_read"       ON public.kanban_tasks FOR SELECT USING (
  get_user_role() = 'admin'
  OR EXISTS (SELECT 1 FROM public.client_assignments ca WHERE ca.client_id = kanban_tasks.client_id AND ca.user_id = auth.uid())
);
CREATE POLICY "kanban_insert"     ON public.kanban_tasks FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "kanban_update"     ON public.kanban_tasks FOR UPDATE USING (created_by = auth.uid() OR get_user_role() = 'admin');
CREATE POLICY "kanban_delete"     ON public.kanban_tasks FOR DELETE USING (created_by = auth.uid() OR get_user_role() = 'admin');

-- kanban_task_assignees
CREATE POLICY "assignees_read"    ON public.kanban_task_assignees FOR SELECT USING (true);
CREATE POLICY "assignees_write"   ON public.kanban_task_assignees FOR ALL    USING (auth.uid() IS NOT NULL);

-- kanban_comments
CREATE POLICY "comments_read"     ON public.kanban_comments FOR SELECT USING (true);
CREATE POLICY "comments_insert"   ON public.kanban_comments FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "comments_update"   ON public.kanban_comments FOR UPDATE USING (user_id = auth.uid());

-- tickets: todos ven; asignados o admin modifican
CREATE POLICY "tickets_read"      ON public.tickets FOR SELECT USING (true);
CREATE POLICY "tickets_insert"    ON public.tickets FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "tickets_update"    ON public.tickets FOR UPDATE USING (assigned_to = auth.uid() OR created_by = auth.uid() OR get_user_role() = 'admin');

-- objectives: todos ven; admin crea/modifica
CREATE POLICY "objectives_read"   ON public.objectives FOR SELECT USING (true);
CREATE POLICY "objectives_write"  ON public.objectives FOR ALL    USING (get_user_role() = 'admin' OR assigned_to = auth.uid());

-- performance_metrics: todos ven; quien sube o admin modifica
CREATE POLICY "metrics_read"      ON public.performance_metrics FOR SELECT USING (true);
CREATE POLICY "metrics_insert"    ON public.performance_metrics FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "metrics_update"    ON public.performance_metrics FOR UPDATE USING (uploaded_by = auth.uid() OR get_user_role() = 'admin');

-- notifications: solo el destinatario ve las suyas
CREATE POLICY "notif_own"         ON public.notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "notif_insert"      ON public.notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "notif_update"      ON public.notifications FOR UPDATE USING (user_id = auth.uid());

-- =============================================
-- SUPABASE REALTIME (para notificaciones live)
-- =============================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.time_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_checkins;
