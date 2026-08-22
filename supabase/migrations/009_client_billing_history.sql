-- Facturación real mes a mes por cliente, para poder calcular LTV y el
-- total facturado por la agencia por mes. Misma política de seguridad que
-- client_billing: tabla separada de `clients`, RLS habilitada sin policies,
-- solo accesible vía service role desde rutas de servidor ya protegidas.
CREATE TABLE IF NOT EXISTS public.client_billing_history (
  client_id  uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  month      date NOT NULL, -- primer día del mes, ej. 2026-08-01
  amount     numeric,
  currency   text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (client_id, month)
);

ALTER TABLE public.client_billing_history ENABLE ROW LEVEL SECURITY;
