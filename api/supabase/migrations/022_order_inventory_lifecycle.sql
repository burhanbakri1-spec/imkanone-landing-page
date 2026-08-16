begin;

alter table public.orders
  add column if not exists inventory_managed boolean not null default false,
  add column if not exists inventory_state text not null default 'unmanaged',
  add column if not exists idempotency_key text,
  add column if not exists request_fingerprint text,
  add column if not exists cancelled_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_inventory_state_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders add constraint orders_inventory_state_check
      check (inventory_state in ('unmanaged', 'deducted', 'restored'));
  end if;
end $$;

create unique index if not exists uq_orders_company_id_id
  on public.orders(company_id, id);
create unique index if not exists uq_orders_company_idempotency_key
  on public.orders(company_id, idempotency_key)
  where idempotency_key is not null;

alter table public.order_items
  add column if not exists product_sku text not null default '',
  add column if not exists variant_sku text not null default '',
  add column if not exists variant_name text not null default '',
  add column if not exists inventory_managed boolean not null default false;

alter table public.order_items alter column variant_id drop not null;
update public.order_items set variant_id = null where btrim(variant_id) = '';

create unique index if not exists uq_order_items_company_order_id_id
  on public.order_items(company_id, order_id, id);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'order_items_tenant_order_fk'
      and conrelid = 'public.order_items'::regclass
  ) then
    alter table public.order_items add constraint order_items_tenant_order_fk
      foreign key (company_id, order_id)
      references public.orders(company_id, id) on delete cascade not valid;
  end if;
end $$;

create table if not exists public.order_inventory_allocations (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references public.companies(id) on delete restrict,
  order_id text not null,
  order_item_id text not null,
  product_id text not null,
  variant_id text,
  quantity integer not null check (quantity > 0),
  deducted_at timestamptz not null default now(),
  restored_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, order_item_id),
  foreign key (company_id, order_id)
    references public.orders(company_id, id) on delete restrict,
  foreign key (company_id, order_id, order_item_id)
    references public.order_items(company_id, order_id, id) on delete restrict,
  foreign key (company_id, product_id)
    references public.products(company_id, id) on delete restrict,
  foreign key (company_id, product_id, variant_id)
    references public.product_variants(company_id, product_id, id) on delete restrict
);

create index if not exists idx_order_inventory_allocations_order
  on public.order_inventory_allocations(company_id, order_id);
create index if not exists idx_order_inventory_allocations_product
  on public.order_inventory_allocations(company_id, product_id);
create index if not exists idx_order_inventory_allocations_variant
  on public.order_inventory_allocations(company_id, variant_id)
  where variant_id is not null;
create index if not exists idx_order_inventory_allocations_unrestored
  on public.order_inventory_allocations(company_id, restored_at)
  where restored_at is null;

-- The NOT NULL defaults backfill pre-existing rows as unmanaged. No allocation
-- rows or historical stock effects are inferred by this migration.

commit;
