-- TRAVEL OPS BY NUVE WORKS
-- Ejecutar en Supabase > SQL Editor.
-- Esta versión agrega perfiles con foto, rooming editable, pagos editables,
-- facturación completa y trazabilidad de usuarios.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  avatar_data_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.profiles add column if not exists avatar_data_url text;
alter table public.profiles add column if not exists updated_at timestamptz default now();

create table if not exists public.departures (
  id uuid primary key default gen_random_uuid(),
  brand text not null check (brand in ('pink','velora')),
  destination text not null,
  start_date date not null,
  end_date date not null,
  capacity integer not null default 1 check (capacity > 0),
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  departure_id uuid not null references public.departures(id) on delete cascade,
  customer_name text not null,
  total_amount numeric(12,2) not null default 0,
  paid_amount numeric(12,2) not null default 0,
  billing_status text not null default 'no_solicitada',
  notes text,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  invoice_required boolean not null default false,
  invoice_rfc text,
  invoice_business_name text,
  invoice_tax_regime text,
  invoice_zip text,
  invoice_cfdi_use text,
  invoice_email text,
  invoice_folio text,
  invoice_date date,
  billing_notes text,
  billing_updated_by uuid references auth.users(id),
  billing_updated_at timestamptz
);
alter table public.bookings add column if not exists updated_by uuid references auth.users(id);
alter table public.bookings add column if not exists invoice_required boolean not null default false;
alter table public.bookings add column if not exists invoice_rfc text;
alter table public.bookings add column if not exists invoice_business_name text;
alter table public.bookings add column if not exists invoice_tax_regime text;
alter table public.bookings add column if not exists invoice_zip text;
alter table public.bookings add column if not exists invoice_cfdi_use text;
alter table public.bookings add column if not exists invoice_email text;
alter table public.bookings add column if not exists invoice_folio text;
alter table public.bookings add column if not exists invoice_date date;
alter table public.bookings add column if not exists billing_notes text;
alter table public.bookings add column if not exists billing_updated_by uuid references auth.users(id);
alter table public.bookings add column if not exists billing_updated_at timestamptz;

do $$ begin
  alter table public.bookings drop constraint if exists bookings_billing_status_check;
exception when undefined_object then null; end $$;
alter table public.bookings add constraint bookings_billing_status_check
  check (billing_status in ('no_solicitada','solicitada','datos_pendientes','en_proceso','facturada','cancelada'));

create table if not exists public.passengers (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  first_name text not null,
  last_name_1 text not null,
  last_name_2 text,
  birth_date date not null,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.passengers add column if not exists updated_by uuid references auth.users(id);
alter table public.passengers add column if not exists updated_at timestamptz default now();

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  departure_id uuid not null references public.departures(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete cascade,
  room_number text,
  room_type text not null check (room_type in ('SGL','DBL','TPL','CPL')),
  notes text,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.rooms add column if not exists updated_by uuid references auth.users(id);
alter table public.rooms add column if not exists updated_at timestamptz default now();

create table if not exists public.room_passengers (
  room_id uuid not null references public.rooms(id) on delete cascade,
  passenger_id uuid not null references public.passengers(id) on delete cascade,
  primary key (room_id, passenger_id)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  paid_on date not null default current_date,
  method text,
  reference text,
  notes text,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.payments add column if not exists method text;
alter table public.payments add column if not exists reference text;
alter table public.payments add column if not exists updated_by uuid references auth.users(id);
alter table public.payments add column if not exists updated_at timestamptz default now();

create table if not exists public.crm_leads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  owner_name text,
  owner_avatar text,
  name text not null,
  phone text,
  email text,
  brand text not null check (brand in ('pink','velora')),
  interest text,
  estimated_pax integer,
  next_followup date,
  status text not null default 'nuevo'
    check (status in ('nuevo','contactado','cotizando','seguimiento','ganado','perdido')),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.crm_leads add column if not exists owner_name text;
alter table public.crm_leads add column if not exists owner_avatar text;

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id),
  entity_type text not null,
  entity_id text,
  action text not null,
  detail jsonb,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;
alter table public.departures enable row level security;
alter table public.bookings enable row level security;
alter table public.passengers enable row level security;
alter table public.rooms enable row level security;
alter table public.room_passengers enable row level security;
alter table public.payments enable row level security;
alter table public.crm_leads enable row level security;
alter table public.audit_log enable row level security;

-- Rehacer políticas de forma segura.
drop policy if exists "auth full profiles" on public.profiles;
drop policy if exists "auth full departures" on public.departures;
drop policy if exists "auth full bookings" on public.bookings;
drop policy if exists "auth full passengers" on public.passengers;
drop policy if exists "auth full rooms" on public.rooms;
drop policy if exists "auth full room passengers" on public.room_passengers;
drop policy if exists "auth full payments" on public.payments;
drop policy if exists "auth full audit" on public.audit_log;
drop policy if exists "crm full access global" on public.crm_leads;
drop policy if exists "crm own rows select" on public.crm_leads;
drop policy if exists "crm own rows insert" on public.crm_leads;
drop policy if exists "crm own rows update" on public.crm_leads;
drop policy if exists "crm own rows delete" on public.crm_leads;

create policy "auth full profiles" on public.profiles for all to authenticated using (true) with check (true);
create policy "auth full departures" on public.departures for all to authenticated using (true) with check (true);
create policy "auth full bookings" on public.bookings for all to authenticated using (true) with check (true);
create policy "auth full passengers" on public.passengers for all to authenticated using (true) with check (true);
create policy "auth full rooms" on public.rooms for all to authenticated using (true) with check (true);
create policy "auth full room passengers" on public.room_passengers for all to authenticated using (true) with check (true);
create policy "auth full payments" on public.payments for all to authenticated using (true) with check (true);
create policy "auth full audit" on public.audit_log for all to authenticated using (true) with check (true);
create policy "crm full access global" on public.crm_leads for all to authenticated using (true) with check (true);

-- Crea los 3 usuarios desde Supabase > Authentication > Users.
-- Después inserta/actualiza sus nombres en public.profiles. La propia app
-- puede guardar nombre y foto de perfil desde "Editar perfil".
