-- =========================================================
-- Travel Ops by Nuve Works
-- v1.9.1 - FIX DE COTIZACIONES
--
-- Motivo:
-- La antigua prueba de Travel Ops v2.0 dejó tablas llamadas
-- public.quotes y public.quote_options con otra estructura.
-- Esta migración NO toca esas tablas viejas.
-- Crea tablas exclusivas para la v1.9 y evita conflictos.
-- =========================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------
-- CONTADOR DE FOLIOS V1.9
-- ---------------------------------------------------------
create table if not exists public.travelops_quote_counters (
  brand text not null check (brand in ('pink','velora')),
  period text not null,
  last_number integer not null default 0,
  primary key (brand, period)
);

alter table public.travelops_quote_counters enable row level security;
revoke all on public.travelops_quote_counters from anon, authenticated;

create or replace function public.next_travelops_v19_quote_folio(p_brand text)
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

  insert into public.travelops_quote_counters (brand, period, last_number)
  values (p_brand, v_period, 1)
  on conflict (brand, period)
  do update set last_number = public.travelops_quote_counters.last_number + 1
  returning last_number into v_number;

  v_code := case when p_brand = 'pink' then 'PINK' else 'VEL' end;

  return 'COT-' || v_code || '-' || v_period || '-' ||
         lpad(v_number::text, 4, '0');
end;
$$;

grant execute on function public.next_travelops_v19_quote_folio(text)
to authenticated;

-- ---------------------------------------------------------
-- COTIZACIONES V1.9
-- ---------------------------------------------------------
create table if not exists public.travelops_quotes (
  id uuid primary key default gen_random_uuid(),
  folio text not null unique,
  brand text not null check (brand in ('pink','velora')),
  customer_name text not null,
  destination text not null,
  start_date date not null,
  end_date date not null,
  passengers_text text not null,
  rooms_text text not null,
  deposit_percent numeric(6,2) not null default 30
    check (deposit_percent >= 0 and deposit_percent <= 100),
  liquidation_date date,
  commission_percent numeric(6,2) not null default 15
    check (commission_percent >= 0 and commission_percent <= 100),
  status text not null default 'borrador'
    check (status in ('borrador','enviada','aceptada','caducada')),
  include_items jsonb not null default '[]'::jsonb,
  extra_conditions jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create index if not exists idx_travelops_quotes_brand
on public.travelops_quotes(brand);

create index if not exists idx_travelops_quotes_dates
on public.travelops_quotes(start_date, end_date);

create index if not exists idx_travelops_quotes_status
on public.travelops_quotes(status);

create index if not exists idx_travelops_quotes_created_at
on public.travelops_quotes(created_at desc);

-- Usa la función set_updated_at existente de Travel Ops.
drop trigger if exists travelops_quotes_updated_at
on public.travelops_quotes;

create trigger travelops_quotes_updated_at
before update on public.travelops_quotes
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------
-- OPCIONES DE HOSPEDAJE
-- ---------------------------------------------------------
create table if not exists public.travelops_quote_options (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null
    references public.travelops_quotes(id)
    on delete cascade,
  sort_order integer not null default 0
    check (sort_order >= 0 and sort_order <= 2),
  hotel text not null,
  plan text not null,
  total_amount numeric(12,2) not null
    check (total_amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (quote_id, sort_order)
);

create index if not exists idx_travelops_quote_options_quote_id
on public.travelops_quote_options(quote_id);

drop trigger if exists travelops_quote_options_updated_at
on public.travelops_quote_options;

create trigger travelops_quote_options_updated_at
before update on public.travelops_quote_options
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------
-- RLS
-- ---------------------------------------------------------
alter table public.travelops_quotes enable row level security;
alter table public.travelops_quote_options enable row level security;

drop policy if exists "travelops quotes full authenticated"
on public.travelops_quotes;

create policy "travelops quotes full authenticated"
on public.travelops_quotes
for all
to authenticated
using (true)
with check (true);

drop policy if exists "travelops quote options full authenticated"
on public.travelops_quote_options;

create policy "travelops quote options full authenticated"
on public.travelops_quote_options
for all
to authenticated
using (true)
with check (true);

-- FIN
-- Si Supabase muestra "Success. No rows returned", quedó correcto.
