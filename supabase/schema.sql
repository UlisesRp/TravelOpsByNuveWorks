-- TRAVEL OPS BY NUVE WORKS
-- Ejecutar en Supabase > SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  created_at timestamptz default now()
);

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
  billing_status text not null default 'no_solicitada'
    check (billing_status in ('no_solicitada','pendiente','facturada')),
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.passengers (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  first_name text not null,
  last_name_1 text not null,
  last_name_2 text,
  birth_date date not null,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  departure_id uuid not null references public.departures(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete cascade,
  room_number text,
  room_type text not null check (room_type in ('SGL','DBL','TPL','CPL')),
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

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
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table if not exists public.crm_leads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
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

-- OPERACIÓN: cualquier usuario autenticado tiene acceso total.
create policy "auth full profiles" on public.profiles for all to authenticated using (true) with check (true);
create policy "auth full departures" on public.departures for all to authenticated using (true) with check (true);
create policy "auth full bookings" on public.bookings for all to authenticated using (true) with check (true);
create policy "auth full passengers" on public.passengers for all to authenticated using (true) with check (true);
create policy "auth full rooms" on public.rooms for all to authenticated using (true) with check (true);
create policy "auth full room passengers" on public.room_passengers for all to authenticated using (true) with check (true);
create policy "auth full payments" on public.payments for all to authenticated using (true) with check (true);
create policy "auth full audit" on public.audit_log for all to authenticated using (true) with check (true);

-- CRM: cada usuario solamente puede ver/modificar SU información.
create policy "crm own rows select" on public.crm_leads for select to authenticated using (owner_id = auth.uid());
create policy "crm own rows insert" on public.crm_leads for insert to authenticated with check (owner_id = auth.uid());
create policy "crm own rows update" on public.crm_leads for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "crm own rows delete" on public.crm_leads for delete to authenticated using (owner_id = auth.uid());

-- Crea los 3 usuarios desde:
-- Supabase > Authentication > Users > Add user
-- Los tres tendrán acceso total a operación. El CRM queda separado automáticamente por auth.uid().
