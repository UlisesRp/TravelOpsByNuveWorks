-- =============================================================
-- TRAVEL OPS by Nuve Works · v2.0
-- Funciones operativas inspiradas en AVRA para uso INTERNO.
-- NO incluye planes, trials, suscripciones ni Mercado Pago.
-- Ejecutar UNA VEZ en el mismo proyecto Supabase de Travel Ops.
-- Es idempotente: puede volver a ejecutarse sin borrar datos.
-- =============================================================

create extension if not exists pgcrypto;

-- -------------------------------------------------------------
-- Compatibilidad con la instalación actual v1.8
-- -------------------------------------------------------------

alter table public.profiles
  add column if not exists avatar_data_url text;

alter table public.bookings
  add column if not exists agency_id uuid references public.agencies(id) on delete set null,
  add column if not exists updated_by uuid references auth.users(id) on delete set null,
  add column if not exists invoice_required boolean not null default false,
  add column if not exists invoice_rfc text,
  add column if not exists invoice_business_name text,
  add column if not exists invoice_tax_regime text,
  add column if not exists invoice_zip text,
  add column if not exists invoice_cfdi_use text,
  add column if not exists invoice_email text,
  add column if not exists invoice_folio text,
  add column if not exists invoice_date date,
  add column if not exists billing_notes text,
  add column if not exists billing_updated_by uuid references auth.users(id) on delete set null,
  add column if not exists billing_updated_at timestamptz;

alter table public.passengers
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

alter table public.payments
  add column if not exists method text,
  add column if not exists reference text,
  add column if not exists updated_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_at timestamptz default now();

alter table public.rooms
  add column if not exists updated_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_at timestamptz default now();

alter table public.crm_leads
  add column if not exists owner_name text,
  add column if not exists owner_avatar text;

-- Travel Ops v1.8 maneja más estados de facturación que el esquema inicial.
alter table public.bookings drop constraint if exists bookings_billing_status_check;
alter table public.bookings
  add constraint bookings_billing_status_check
  check (billing_status in ('no_solicitada','pendiente','solicitada','datos_pendientes','en_proceso','facturada','cancelada'));

-- CRM GLOBAL: todos los usuarios internos ven el mismo pipeline.
drop policy if exists "crm own rows select" on public.crm_leads;
drop policy if exists "crm own rows insert" on public.crm_leads;
drop policy if exists "crm own rows update" on public.crm_leads;
drop policy if exists "crm own rows delete" on public.crm_leads;
drop policy if exists "crm full authenticated" on public.crm_leads;
create policy "crm full authenticated"
on public.crm_leads for all to authenticated
using (true) with check (true);

-- -------------------------------------------------------------
-- CLIENTES
-- -------------------------------------------------------------

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  brand text not null check (brand in ('pink','velora')),
  client_type text not null default 'cliente' check (client_type in ('cliente','agencia')),
  agency_id uuid references public.agencies(id) on delete set null,
  name text not null,
  phone text,
  email text,
  status text not null default 'activo' check (status in ('prospecto','activo','inactivo')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clients_brand_idx on public.clients(brand);
create index if not exists clients_name_idx on public.clients(lower(name));

-- -------------------------------------------------------------
-- COTIZACIONES + HASTA 3 OPCIONES
-- -------------------------------------------------------------

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  brand text not null check (brand in ('pink','velora')),
  client_id uuid references public.clients(id) on delete set null,
  client_name text not null,
  destination text not null,
  start_date date not null,
  end_date date not null,
  adults integer not null default 1 check (adults >= 1),
  minors integer not null default 0 check (minors >= 0),
  airline text,
  flight_out timestamp,
  flight_in timestamp,
  transfer_service text,
  tour_service text,
  tour_price numeric(12,2) not null default 0,
  msi_amount numeric(12,2) not null default 0,
  status text not null default 'borrador'
    check (status in ('borrador','enviada','aceptada','convertida','cancelada')),
  validity_hours integer not null default 48 check (validity_hours in (24,48,72)),
  valid_until timestamptz,
  notes text,
  share_token text,
  converted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quote_options (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  sort_order integer not null default 1 check (sort_order between 1 and 3),
  hotel_service text not null,
  detail text,
  internal_cost numeric(12,2) not null default 0,
  sale_price numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (quote_id, sort_order)
);

create index if not exists quotes_brand_idx on public.quotes(brand);
create index if not exists quotes_client_idx on public.quotes(client_id);
create index if not exists quotes_dates_idx on public.quotes(start_date, end_date);
create index if not exists quote_options_quote_idx on public.quote_options(quote_id);

-- -------------------------------------------------------------
-- RESERVAS / EXPEDIENTES
-- Pueden ser independientes o enlazarse con una salida existente.
-- -------------------------------------------------------------

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  brand text not null check (brand in ('pink','velora')),
  client_id uuid references public.clients(id) on delete set null,
  client_name text not null,
  quote_id uuid references public.quotes(id) on delete set null,
  quote_option_id uuid references public.quote_options(id) on delete set null,
  departure_id uuid references public.departures(id) on delete set null,
  booking_id uuid references public.bookings(id) on delete set null,
  destination text not null,
  start_date date not null,
  end_date date not null,
  adults integer not null default 1 check (adults >= 1),
  minors integer not null default 0 check (minors >= 0),
  hotel_service text,
  airline text,
  flight_out timestamp,
  flight_in timestamp,
  transfer_service text,
  tour_service text,
  tour_price numeric(12,2) not null default 0,
  internal_cost numeric(12,2) not null default 0,
  msi_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  status text not null default 'confirmada'
    check (status in ('por_confirmar','confirmada','cancelada')),
  invoice_required boolean not null default false,
  billing_status text not null default 'no_solicitada'
    check (billing_status in ('no_solicitada','pendiente','solicitada','datos_pendientes','en_proceso','facturada','cancelada')),
  notes text,
  share_token text,
  signed_by text,
  signed_at timestamptz,
  signature_data text,
  accepted_terms boolean not null default false,
  client_confirmed_data boolean not null default false,
  accepted_terms_version text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.quotes
  add column if not exists converted_reservation_id uuid references public.reservations(id) on delete set null;

create index if not exists reservations_brand_idx on public.reservations(brand);
create index if not exists reservations_client_idx on public.reservations(client_id);
create index if not exists reservations_departure_idx on public.reservations(departure_id);
create index if not exists reservations_booking_idx on public.reservations(booking_id);
create index if not exists reservations_dates_idx on public.reservations(start_date, end_date);

-- Reutilizamos las tablas operativas existentes para pasajeros y pagos.
-- Una misma fila puede pertenecer al expediente Y a la reserva de una salida.
alter table public.passengers alter column booking_id drop not null;
alter table public.passengers
  add column if not exists reservation_id uuid references public.reservations(id) on delete cascade;
create index if not exists passengers_reservation_idx on public.passengers(reservation_id);

alter table public.payments alter column booking_id drop not null;
alter table public.payments
  add column if not exists reservation_id uuid references public.reservations(id) on delete cascade;
create index if not exists payments_reservation_idx on public.payments(reservation_id);

-- -------------------------------------------------------------
-- UPDATED_AT
-- -------------------------------------------------------------

create or replace function public.travelops_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists clients_updated_at_v2 on public.clients;
create trigger clients_updated_at_v2 before update on public.clients
for each row execute function public.travelops_set_updated_at();

drop trigger if exists quotes_updated_at_v2 on public.quotes;
create trigger quotes_updated_at_v2 before update on public.quotes
for each row execute function public.travelops_set_updated_at();

drop trigger if exists quote_options_updated_at_v2 on public.quote_options;
create trigger quote_options_updated_at_v2 before update on public.quote_options
for each row execute function public.travelops_set_updated_at();

drop trigger if exists reservations_updated_at_v2 on public.reservations;
create trigger reservations_updated_at_v2 before update on public.reservations
for each row execute function public.travelops_set_updated_at();

-- -------------------------------------------------------------
-- RLS INTERNO: mismos usuarios, todos con acceso a la operación.
-- -------------------------------------------------------------

alter table public.clients enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_options enable row level security;
alter table public.reservations enable row level security;

drop policy if exists "clients full authenticated" on public.clients;
create policy "clients full authenticated" on public.clients
for all to authenticated using (true) with check (true);

drop policy if exists "quotes full authenticated" on public.quotes;
create policy "quotes full authenticated" on public.quotes
for all to authenticated using (true) with check (true);

drop policy if exists "quote options full authenticated" on public.quote_options;
create policy "quote options full authenticated" on public.quote_options
for all to authenticated using (true) with check (true);

drop policy if exists "reservations full authenticated" on public.reservations;
create policy "reservations full authenticated" on public.reservations
for all to authenticated using (true) with check (true);

-- -------------------------------------------------------------
-- ENLACES PÚBLICOS SEGUROS
-- Nunca se devuelve internal_cost ni msi_amount al cliente.
-- -------------------------------------------------------------

create or replace function public.get_shared_travelops_quote(
  p_quote_id uuid,
  p_token text
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'quote', jsonb_build_object(
      'id', q.id,
      'code', q.code,
      'brand', q.brand,
      'clientName', q.client_name,
      'destination', q.destination,
      'startDate', q.start_date,
      'endDate', q.end_date,
      'adults', q.adults,
      'minors', q.minors,
      'airline', q.airline,
      'flightOut', q.flight_out,
      'flightIn', q.flight_in,
      'transfer', q.transfer_service,
      'tour', q.tour_service,
      'status', q.status,
      'validUntil', q.valid_until,
      'notes', q.notes,
      'expired', (q.valid_until is not null and q.valid_until < now() and q.status not in ('aceptada','convertida'))
    ),
    'options', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', o.id,
          'order', o.sort_order,
          'hotel', o.hotel_service,
          'detail', o.detail,
          'finalPrice', round(o.sale_price + q.tour_price + q.msi_amount, 2)
        ) order by o.sort_order
      )
      from public.quote_options o
      where o.quote_id = q.id
    ), '[]'::jsonb)
  )
  from public.quotes q
  where q.id = p_quote_id
    and q.share_token = p_token
    and q.status <> 'cancelada'
  limit 1;
$$;

grant execute on function public.get_shared_travelops_quote(uuid,text) to anon, authenticated;

create or replace function public.get_shared_travelops_reservation(
  p_reservation_id uuid,
  p_token text
)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'reservation', jsonb_build_object(
      'id', r.id,
      'code', r.code,
      'brand', r.brand,
      'clientName', r.client_name,
      'destination', r.destination,
      'startDate', r.start_date,
      'endDate', r.end_date,
      'adults', r.adults,
      'minors', r.minors,
      'hotel', r.hotel_service,
      'airline', r.airline,
      'flightOut', r.flight_out,
      'flightIn', r.flight_in,
      'transfer', r.transfer_service,
      'tour', r.tour_service,
      'total', r.total_amount,
      'status', r.status,
      'notes', r.notes,
      'signedBy', r.signed_by,
      'signedAt', r.signed_at,
      'acceptedTerms', r.accepted_terms,
      'clientConfirmedData', r.client_confirmed_data
    ),
    'passengers', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'first', p.first_name,
          'last1', p.last_name_1,
          'last2', p.last_name_2,
          'birthDate', p.birth_date
        ) order by p.created_at, p.id
      )
      from public.passengers p
      where p.reservation_id = r.id
         or (r.booking_id is not null and p.booking_id = r.booking_id)
    ), '[]'::jsonb),
    'payments', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'amount', p.amount,
          'date', p.paid_on,
          'method', coalesce(p.method,''),
          'reference', coalesce(p.reference,'')
        ) order by p.paid_on, p.created_at
      )
      from public.payments p
      where p.reservation_id = r.id
         or (r.booking_id is not null and p.booking_id = r.booking_id)
    ), '[]'::jsonb)
  )
  from public.reservations r
  where r.id = p_reservation_id
    and r.share_token = p_token
    and r.status <> 'cancelada'
  limit 1;
$$;

grant execute on function public.get_shared_travelops_reservation(uuid,text) to anon, authenticated;

create or replace function public.confirm_shared_travelops_reservation(
  p_reservation_id uuid,
  p_token text,
  p_signed_by text,
  p_signature_data text,
  p_accept_terms boolean,
  p_confirm_data boolean,
  p_terms_version text default 'TO-2026-09'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res public.reservations%rowtype;
  v_expected integer;
  v_complete integer;
  v_now timestamptz := now();
begin
  select * into v_res
  from public.reservations
  where id = p_reservation_id
    and share_token = p_token
    and status <> 'cancelada'
  for update;

  if not found then
    raise exception 'Enlace de reserva inválido.';
  end if;

  if nullif(trim(coalesce(p_signed_by,'')), '') is null then
    raise exception 'Falta el nombre de quien firma.';
  end if;

  if p_accept_terms is not true or p_confirm_data is not true then
    raise exception 'Debes aceptar términos y confirmar los datos.';
  end if;

  if nullif(trim(coalesce(p_signature_data,'')), '') is null then
    raise exception 'Falta la firma.';
  end if;

  v_expected := greatest(1, coalesce(v_res.adults,0) + coalesce(v_res.minors,0));

  select count(*) into v_complete
  from public.passengers p
  where (p.reservation_id = v_res.id or (v_res.booking_id is not null and p.booking_id = v_res.booking_id))
    and nullif(trim(coalesce(p.first_name,'')), '') is not null
    and nullif(trim(coalesce(p.last_name_1,'')), '') is not null
    and p.birth_date is not null;

  if v_complete < v_expected then
    raise exception 'Faltan datos de pasajeros antes de firmar.';
  end if;

  update public.reservations
  set signed_by = trim(p_signed_by),
      signed_at = v_now,
      signature_data = p_signature_data,
      accepted_terms = true,
      client_confirmed_data = true,
      accepted_terms_version = coalesce(nullif(trim(p_terms_version),''),'TO-2026-09'),
      updated_at = v_now
  where id = v_res.id;

  return jsonb_build_object(
    'signedBy', trim(p_signed_by),
    'signedAt', v_now,
    'acceptedTerms', true,
    'clientConfirmedData', true
  );
end;
$$;

grant execute on function public.confirm_shared_travelops_reservation(uuid,text,text,text,boolean,boolean,text) to anon, authenticated;

-- =============================================================
-- FIN v2.0
-- =============================================================
