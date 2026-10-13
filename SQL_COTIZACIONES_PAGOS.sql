-- Travel Ops: cobros directos de cotizaciones aceptadas.
-- No modifica ni borra bookings, reservations, payments ni cotizaciones existentes.
CREATE TABLE IF NOT EXISTS public.travelops_quote_payments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 quote_id uuid NOT NULL REFERENCES public.travelops_quotes(id) ON DELETE RESTRICT,
 option_id uuid NOT NULL REFERENCES public.travelops_quote_options(id) ON DELETE RESTRICT,
 total_amount numeric NOT NULL CHECK(total_amount > 0),
 amount numeric NOT NULL CHECK(amount > 0),
 paid_on date NOT NULL DEFAULT CURRENT_DATE,
 method text NOT NULL,
 reference text,
 notes text,
 receipt_number text UNIQUE NOT NULL DEFAULT ('REC-' || to_char(CURRENT_DATE, 'YYYY') || '-' || lpad(nextval('public.payment_receipt_seq')::text, 6, '0')),
 created_by uuid REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_travelops_quote_payments_quote ON public.travelops_quote_payments(quote_id);
ALTER TABLE public.travelops_quote_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "quote_payments_team_read" ON public.travelops_quote_payments;
CREATE POLICY "quote_payments_team_read" ON public.travelops_quote_payments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "quote_payments_team_insert" ON public.travelops_quote_payments;
CREATE POLICY "quote_payments_team_insert" ON public.travelops_quote_payments FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
-- Bloquea que una cotización cambie de opción o precio al registrar un abono posterior.
CREATE OR REPLACE FUNCTION public.validate_travelops_quote_payment() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE prior record; opt record; q_status text; total_paid numeric;
BEGIN
 SELECT status INTO q_status FROM public.travelops_quotes WHERE id=NEW.quote_id;
 IF q_status IS DISTINCT FROM 'aceptada' THEN RAISE EXCEPTION 'La cotización debe estar aceptada'; END IF;
 SELECT id, quote_id, total_amount INTO opt FROM public.travelops_quote_options WHERE id=NEW.option_id;
 IF NOT FOUND OR opt.quote_id <> NEW.quote_id THEN RAISE EXCEPTION 'Opción de cotización inválida'; END IF;
 IF NEW.total_amount <> opt.total_amount THEN RAISE EXCEPTION 'El total difiere del precio de la opción seleccionada'; END IF;
 SELECT option_id,total_amount INTO prior FROM public.travelops_quote_payments WHERE quote_id=NEW.quote_id LIMIT 1;
 IF FOUND AND (prior.option_id <> NEW.option_id OR prior.total_amount <> NEW.total_amount) THEN RAISE EXCEPTION 'La opción vendida ya fue fijada por el primer pago'; END IF;
 SELECT coalesce(sum(amount),0) INTO total_paid FROM public.travelops_quote_payments WHERE quote_id=NEW.quote_id;
 IF total_paid + NEW.amount > NEW.total_amount THEN RAISE EXCEPTION 'El abono supera el saldo pendiente'; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_validate_quote_payment ON public.travelops_quote_payments;
CREATE TRIGGER trg_validate_quote_payment BEFORE INSERT ON public.travelops_quote_payments
FOR EACH ROW EXECUTE FUNCTION public.validate_travelops_quote_payment();
