-- Travel Ops V3 · Pagos sobre el TOTAL OFICIAL de la reserva
-- Ejecutar una sola vez en Supabase SQL Editor.
-- No borra pagos ni reservas. Reemplaza únicamente la validación de nuevos abonos.

DO $$
BEGIN
  IF to_regclass('public.travelops_quote_payments') IS NULL THEN
    RAISE EXCEPTION 'Falta public.travelops_quote_payments. Ejecuta primero SQL_COTIZACIONES_PAGOS.sql';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.validate_travelops_quote_payment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  prior record;
  opt record;
  res record;
  q_status text;
  total_paid numeric;
  expected_total numeric;
BEGIN
  SELECT status INTO q_status
  FROM public.travelops_quotes
  WHERE id = NEW.quote_id;

  IF q_status IS DISTINCT FROM 'aceptada' THEN
    RAISE EXCEPTION 'La cotización debe estar aceptada';
  END IF;

  SELECT id, quote_id, total_amount, display_total_amount
  INTO opt
  FROM public.travelops_quote_options
  WHERE id = NEW.option_id;

  IF NOT FOUND OR opt.quote_id <> NEW.quote_id THEN
    RAISE EXCEPTION 'Opción de cotización inválida';
  END IF;

  SELECT id, code, v3_option_id, total_amount, status
  INTO res
  FROM public.reservations
  WHERE v3_quote_id = NEW.quote_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    IF res.status = 'cancelada' THEN
      RAISE EXCEPTION 'La reserva está cancelada';
    END IF;
    IF res.v3_option_id IS NOT NULL AND res.v3_option_id <> NEW.option_id THEN
      RAISE EXCEPTION 'El pago no corresponde a la opción contratada de la reserva';
    END IF;
    expected_total := res.total_amount;
  ELSE
    -- Compatibilidad con pagos anteriores a V3.
    expected_total := coalesce(opt.display_total_amount, opt.total_amount);
  END IF;

  IF NEW.total_amount <> expected_total THEN
    RAISE EXCEPTION 'El total del pago debe coincidir con el total oficial de la reserva';
  END IF;

  SELECT option_id, total_amount
  INTO prior
  FROM public.travelops_quote_payments
  WHERE quote_id = NEW.quote_id
  ORDER BY created_at
  LIMIT 1;

  IF FOUND AND (prior.option_id <> NEW.option_id OR prior.total_amount <> NEW.total_amount) THEN
    RAISE EXCEPTION 'La opción y el total ya fueron fijados por el primer pago';
  END IF;

  SELECT coalesce(sum(amount),0)
  INTO total_paid
  FROM public.travelops_quote_payments
  WHERE quote_id = NEW.quote_id;

  IF total_paid + NEW.amount > NEW.total_amount THEN
    RAISE EXCEPTION 'El abono supera el saldo pendiente';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_quote_payment
ON public.travelops_quote_payments;

CREATE TRIGGER trg_validate_quote_payment
BEFORE INSERT ON public.travelops_quote_payments
FOR EACH ROW
EXECUTE FUNCTION public.validate_travelops_quote_payment();
