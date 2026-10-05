-- =========================================================
-- Travel Ops by Nuve Works
-- Migración v1.9 - Cotizaciones
-- Pink Sky Travel + Velora Travel
-- NO modifica ni elimina salidas, bookings, pagos o facturación.
-- Ejecutar UNA VEZ en Supabase > SQL Editor.
-- =========================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------
-- CONTADOR DE FOLIOS
-- ---------------------------------------------------------
create table if not exists public.quote_counters (
  brand text not null check (brand in ('pink','velora')),
  period text not null,
  last_number integer not null default 0,
  primary key (brand, period)
);

alter table public.quote_counters enable row level security;
revoke all on public.quote_counters from anon, authenticated;

create or replace function public.next_travelops_quote_folio(p_brand text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period text := to_char(now(), 'YYYYMM');
  v_number integer;
  v_code text;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.';
  end if;

  if p_brand not in ('pink','velora') then
    raise exception 'Marca inválida.';
  end if;

  insert into public.quote_counters (brand, period, last_number)
  values (p_brand, v_period, 1)
  on conflict (brand, period)
  do update set last_number = public.quote_counters.last_number + 1
  returning last_number into v_number;

  v_code := case when p_brand = 'pink' then 'PINK' else 'VEL' end;
  return 'COT-' || v_code || '-' || v_period || '-' || lpad(v_number::text, 4, '0');
end;
$$;

grant execute on function public.next_travelops_quote_folio(text) to authenticated;

-- ---------------------------------------------------------
-- COTIZACIONES
-- ---------------------------------------------------------
create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  folio text not null unique,
  brand text not null check (brand in ('pink','velora')),
  customer_name text not null,
  destination text not null,
  start_date date not null,
  end_date date not null,
  passengers_text text not null,
  rooms_text text not null,
  deposit_percent numeric(6,2) not null default 30 check (deposit_percent >= 0 and deposit_percent <= 100),
  liquidation_date date,
  commission_percent numeric(6,2) not null default 15 check (commission_percent >= 0 and commission_percent <= 100),
  status text not null default 'borrador' check (status in ('borrador','enviada','aceptada','caducada')),
  include_items jsonb not null default '[]'::jsonb,
  extra_conditions jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create index if not exists idx_quotes_brand on public.quotes(brand);
create index if not exists idx_quotes_dates on public.quotes(start_date, end_date);
create index if not exists idx_quotes_status on public.quotes(status);
create index if not exists idx_quotes_created_at on public.quotes(created_at desc);

drop trigger if exists quotes_updated_at on public.quotes;
create trigger quotes_updated_at
before update on public.quotes
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------
-- OPCIONES DE HOSPEDAJE (1 A 3 POR COTIZACIÓN)
-- ---------------------------------------------------------
create table if not exists public.quote_options (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  sort_order integer not null default 0 check (sort_order >= 0 and sort_order <= 2),
  hotel text not null,
  plan text not null,
  total_amount numeric(12,2) not null check (total_amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (quote_id, sort_order)
);

create index if not exists idx_quote_options_quote_id on public.quote_options(quote_id);

drop trigger if exists quote_options_updated_at on public.quote_options;
create trigger quote_options_updated_at
before update on public.quote_options
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------
-- RLS: Travel Ops es operación interna compartida.
-- Todos los usuarios autenticados tienen acceso a cotizaciones.
-- ---------------------------------------------------------
alter table public.quotes enable row level security;
alter table public.quote_options enable row level security;

drop policy if exists "quotes full authenticated" on public.quotes;
create policy "quotes full authenticated"
on public.quotes
for all
to authenticated
using (true)
with check (true);

drop policy if exists "quote options full authenticated" on public.quote_options;
create policy "quote options full authenticated"
on public.quote_options
for all
to authenticated
using (true)
with check (true);

-- Fin. Un resultado "Success. No rows returned" es correcto.
