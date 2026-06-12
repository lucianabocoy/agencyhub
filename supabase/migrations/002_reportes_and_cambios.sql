-- Agrega 'reportes' al enum kanban_section
ALTER TYPE public.kanban_section ADD VALUE IF NOT EXISTS 'reportes';

-- Tabla de registro de cambios por cliente
CREATE TABLE IF NOT EXISTS public.campaign_changes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  date        date        NOT NULL DEFAULT CURRENT_DATE,
  user_id     uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  action      text        NOT NULL CHECK (char_length(action) > 0),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaign_changes_client ON public.campaign_changes (client_id, date DESC);

ALTER TABLE public.campaign_changes ENABLE ROW LEVEL SECURITY;

-- Lectura: miembros del equipo del cliente o admin
CREATE POLICY "cambios_read" ON public.campaign_changes
  FOR SELECT USING (
    get_user_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.client_assignments ca
      WHERE ca.client_id = campaign_changes.client_id
        AND ca.user_id = auth.uid()
    )
  );

-- Inserción: cualquier usuario autenticado
CREATE POLICY "cambios_insert" ON public.campaign_changes
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Eliminación: solo el autor o admin
CREATE POLICY "cambios_delete" ON public.campaign_changes
  FOR DELETE USING (user_id = auth.uid() OR get_user_role() = 'admin');
