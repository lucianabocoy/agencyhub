-- Permiso puntual para entrar a la sección Administración sin ser admin completo
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS can_view_finance boolean NOT NULL DEFAULT false;

UPDATE public.users SET can_view_finance = true
WHERE email IN ('lu.bocoy@gmail.com', 'nati.e.martinez88@gmail.com');

-- Datos de facturación y fiscales por cliente. Tabla separada de `clients` a
-- propósito: `clients` tiene RLS que deja ver la fila completa a cualquier
-- trafficker asignada, y esta plata/datos fiscales no deben filtrarse ahí.
-- Sin policies de RLS: solo accesible vía service role desde rutas de
-- servidor que ya validan admin o can_view_finance.
CREATE TABLE IF NOT EXISTS public.client_billing (
  client_id       uuid PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
  fee             numeric,
  fee_currency    text,
  fee_updated_at  date,
  payment_account text,
  needs_invoice   boolean NOT NULL DEFAULT false,
  fiscal_data     text,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_billing ENABLE ROW LEVEL SECURITY;
