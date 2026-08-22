-- Notas privadas de admin sobre cada integrante del equipo (ej: cuánto cobra).
-- Sin policies de RLS a propósito: nadie puede leerla/escribirla desde el
-- cliente (anon/authenticated), solo el service role desde rutas de servidor
-- que ya validan que quien pide sea admin.
CREATE TABLE IF NOT EXISTS public.user_notes (
  user_id    uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  note       text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_notes ENABLE ROW LEVEL SECURITY;
