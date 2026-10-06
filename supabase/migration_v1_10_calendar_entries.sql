-- =========================================================
-- Travel Ops by Nuve Works
-- v1.10 - Agenda interna en Calendario
-- Notas, citas, recordatorios y tareas por fecha.
-- NO borra ni modifica salidas, pasajeros, rooming, pagos,
-- facturacion, agencias ni cotizaciones existentes.
-- =========================================================

create extension if not exists pgcrypto;

-- Asegura que exista el helper de updated_at.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.calendar_entries (
  id uuid primary key default gen_random_uuid(),
  event_date date not null,
  event_time time,
  entry_type text not null default 'nota'
    check (entry_type in ('nota','cita','recordatorio','tarea')),
  title text not null,
  description text,
  brand text
    check (brand is null or brand in ('pink','velora')),
  status text not null default 'pendiente'
    check (status in ('pendiente','hecho','cancelado')),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_calendar_entries_date
  on public.calendar_entries(event_date);

create index if not exists idx_calendar_entries_brand_date
  on public.calendar_entries(brand, event_date);

create index if not exists idx_calendar_entries_status
  on public.calendar_entries(status);

drop trigger if exists calendar_entries_updated_at
  on public.calendar_entries;

create trigger calendar_entries_updated_at
before update on public.calendar_entries
for each row execute function public.set_updated_at();

alter table public.calendar_entries enable row level security;

drop policy if exists "calendar entries full authenticated"
  on public.calendar_entries;

create policy "calendar entries full authenticated"
on public.calendar_entries
for all
to authenticated
using (true)
with check (true);

-- Si aparece "Success. No rows returned", termino correctamente.
