-- PASO previo al uso del boton. Solo columnas opcionales; no modifica registros.
ALTER TABLE public.reservations
ADD COLUMN IF NOT EXISTS v3_option_id UUID REFERENCES public.travelops_quote_options(id) ON DELETE RESTRICT;
ALTER TABLE public.reservations
ADD COLUMN IF NOT EXISTS v3_services_snapshot JSONB;
-- La unicidad de v3_quote_id ya fue creada en el paso 28.
