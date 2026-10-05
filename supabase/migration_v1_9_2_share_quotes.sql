-- =========================================================
-- Travel Ops by Nuve Works
-- Migración v1.9.2 - Enlaces públicos de cotización
-- Pink Sky Travel + Velora Travel
-- Ejecutar UNA VEZ en Supabase > SQL Editor.
-- No elimina datos existentes.
-- =========================================================

create extension if not exists pgcrypto;

alter table public.travelops_quotes
  add column if not exists share_token text,
  add column if not exists share_enabled boolean not null default false,
  add column if not exists shared_at timestamptz;

update public.travelops_quotes
set share_token = encode(gen_random_bytes(18), 'hex')
where share_token is null or trim(share_token) = '';

alter table public.travelops_quotes
  alter column share_token set default encode(gen_random_bytes(18), 'hex'),
  alter column share_token set not null;

create unique index if not exists travelops_quotes_share_token_unique
  on public.travelops_quotes(share_token);

create or replace function public.get_shared_travelops_quote(
  p_quote_id uuid,
  p_token text
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', q.id,
    'folio', q.folio,
    'brand', q.brand,
    'customer_name', q.customer_name,
    'destination', q.destination,
    'start_date', q.start_date,
    'end_date', q.end_date,
    'passengers_text', q.passengers_text,
    'rooms_text', q.rooms_text,
    'deposit_percent', q.deposit_percent,
    'liquidation_date', q.liquidation_date,
    'commission_percent', q.commission_percent,
    'status', q.status,
    'include_items', q.include_items,
    'extra_conditions', q.extra_conditions,
    'created_at', q.created_at,
    'updated_at', q.updated_at,
    'options', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', o.id,
            'hotel', o.hotel,
            'plan', o.plan,
            'total_amount', o.total_amount,
            'sort_order', o.sort_order
          )
          order by o.sort_order
        )
        from public.travelops_quote_options o
        where o.quote_id = q.id
      ),
      '[]'::jsonb
    )
  )
  from public.travelops_quotes q
  where q.id = p_quote_id
    and q.share_enabled = true
    and q.share_token = p_token
  limit 1;
$$;

revoke all on function public.get_shared_travelops_quote(uuid, text) from public;
grant execute on function public.get_shared_travelops_quote(uuid, text) to anon, authenticated;
