create schema if not exists inventory;

create table if not exists inventory.portion_definitions (
  id bigserial primary key,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists inventory.unit_conversions (
  id bigserial primary key,
  portion_definition_id bigint not null references inventory.portion_definitions(id) on delete cascade,
  stock_unit text not null,
  processing_unit text not null,
  conversion_ratio numeric(14,4) not null check (conversion_ratio > 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop table if exists inventory.stock_receipt_items;
drop table if exists inventory.stock_receipts;

create table if not exists inventory.stock_products (
  id bigserial primary key,
  product_name text not null unique,
  product_category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists inventory.suppliers (
  id bigserial primary key,
  supplier_name text not null unique,
  primary_category text,
  default_unit_price numeric(14,4) check (default_unit_price is null or default_unit_price >= 0),
  currency_code char(3) not null default 'VND',
  contact_name text,
  phone text,
  email text,
  address text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists inventory.supplier_products (
  id bigserial primary key,
  supplier_id bigint not null references inventory.suppliers(id) on delete cascade,
  stock_product_id bigint not null references inventory.stock_products(id) on delete cascade,
  unit_price numeric(14,4) not null check (unit_price >= 0),
  currency_code char(3) not null default 'VND',
  is_preferred boolean not null default false,
  lead_time_days integer check (lead_time_days is null or lead_time_days >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_supplier_products_supplier_product unique (supplier_id, stock_product_id)
);

create table if not exists inventory.stock_inbounds (
  id bigserial primary key,
  stock_product_id bigint not null references inventory.stock_products(id) on delete cascade,
  supplier_id bigint references inventory.suppliers(id) on delete set null,
  input_quantity numeric(14,4) not null check (input_quantity > 0),
  input_unit text not null,
  unit_price numeric(14,4) check (unit_price is null or unit_price >= 0),
  currency_code char(3) not null default 'VND',
  unit_conversion_id bigint references inventory.unit_conversions(id) on delete set null,
  conversion_ratio numeric(14,4) check (conversion_ratio is null or conversion_ratio > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_stock_inbounds_conversion_snapshot
    check (
      (unit_conversion_id is null and conversion_ratio is null)
      or
      (unit_conversion_id is not null and conversion_ratio is not null)
    )
);

create table if not exists inventory.stock_balances (
  id bigserial primary key,
  stock_product_id bigint not null unique references inventory.stock_products(id) on delete cascade,
  on_hand_quantity numeric(14,4) not null default 0 check (on_hand_quantity >= 0),
  on_hand_unit text not null,
  unit_conversion_id bigint references inventory.unit_conversions(id) on delete set null,
  conversion_ratio numeric(14,4) check (conversion_ratio is null or conversion_ratio > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_stock_balances_conversion_snapshot
    check (
      (unit_conversion_id is null and conversion_ratio is null)
      or
      (unit_conversion_id is not null and conversion_ratio is not null)
    )
);

create table if not exists inventory.menu_products (
  id bigserial primary key,
  product_name text not null unique,
  product_category text,
  serving_unit text not null default 'phần',
  selling_price numeric(14,4) not null default 0 check (selling_price >= 0),
  status text not null default 'Đang bán',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists inventory.menu_product_components (
  id bigserial primary key,
  menu_product_id bigint not null references inventory.menu_products(id) on delete cascade,
  stock_product_id bigint not null references inventory.stock_products(id) on delete restrict,
  quantity numeric(14,4) not null check (quantity > 0),
  unit text not null,
  sort_order integer not null default 0 check (sort_order >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_menu_product_components unique (menu_product_id, stock_product_id)
);

create table if not exists inventory.product_sales_plans (
  id bigserial primary key,
  menu_product_id bigint not null unique references inventory.menu_products(id) on delete cascade,
  sales_target integer not null default 0 check (sales_target >= 0),
  sales_actual integer not null default 0 check (sales_actual >= 0),
  status text not null default 'active' check (status in ('active', 'limited', 'paused')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists inventory.product_orders (
  id bigserial primary key,
  order_code text not null unique,
  menu_product_id bigint not null references inventory.menu_products(id) on delete cascade,
  order_type text not null check (order_type in ('dine_in', 'takeaway')),
  quantity integer not null default 1 check (quantity > 0),
  unit_price numeric(18, 2) not null default 0 check (unit_price >= 0),
  total_amount numeric(18, 2) not null default 0,
  cost_amount numeric(18, 2) not null default 0,
  profit_amount numeric(18, 2) not null default 0,
  currency_code text not null default 'VND',
  notes text,
  ordered_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table inventory.stock_products
  add column if not exists product_category text;

alter table inventory.stock_inbounds
  add column if not exists supplier_id bigint references inventory.suppliers(id) on delete set null;

alter table inventory.stock_inbounds
  add column if not exists unit_price numeric(14,4) check (unit_price is null or unit_price >= 0);

alter table inventory.stock_inbounds
  add column if not exists currency_code char(3) not null default 'VND';

alter table inventory.suppliers
  add column if not exists primary_category text;

alter table inventory.suppliers
  add column if not exists default_unit_price numeric(14,4) check (default_unit_price is null or default_unit_price >= 0);

alter table inventory.suppliers
  add column if not exists currency_code char(3) not null default 'VND';

alter table inventory.suppliers
  add column if not exists pricing_unit text;

alter table inventory.supplier_products
  add column if not exists pricing_unit text;

-- FIFO lot tracking: each stock_inbounds row is a lot. remaining_quantity is
-- stored in the stock_product's normalized unit (input_quantity * conversion_ratio).
alter table inventory.stock_inbounds
  add column if not exists remaining_quantity numeric(18,4) not null default 0
    check (remaining_quantity >= 0);

-- One-shot backfill that is safe to re-run.
-- Step 1: when remaining_quantity is still 0 (column just created) for ALL
--   rows of a product, fill it from input_quantity * coalesce(conversion_ratio, 1).
-- Step 2: if after step 1 the sum of remaining for a product exceeds the
--   current balance (consumption happened before lot tracking existed),
--   consume the oldest lots FIFO so the totals match.
do $$
declare
  product_record record;
  lot_record record;
  total_remaining numeric(18,4);
  balance_quantity numeric(18,4);
  excess numeric(18,4);
  consume_now numeric(18,4);
begin
  update inventory.stock_inbounds si
  set remaining_quantity = si.input_quantity * coalesce(si.conversion_ratio, 1)
  where si.remaining_quantity = 0
    and si.input_quantity > 0
    and not exists (
      select 1
      from inventory.stock_inbounds inner_si
      where inner_si.stock_product_id = si.stock_product_id
        and inner_si.remaining_quantity > 0
    );

  for product_record in
    select sb.stock_product_id, sb.on_hand_quantity
    from inventory.stock_balances sb
  loop
    select coalesce(sum(remaining_quantity), 0)
    into total_remaining
    from inventory.stock_inbounds
    where stock_product_id = product_record.stock_product_id;

    balance_quantity := product_record.on_hand_quantity;

    if total_remaining > balance_quantity then
      excess := total_remaining - balance_quantity;
      for lot_record in
        select id, remaining_quantity
        from inventory.stock_inbounds
        where stock_product_id = product_record.stock_product_id
          and remaining_quantity > 0
        order by created_at asc, id asc
      loop
        exit when excess <= 0;
        consume_now := least(lot_record.remaining_quantity, excess);
        update inventory.stock_inbounds
        set remaining_quantity = remaining_quantity - consume_now
        where id = lot_record.id;
        excess := excess - consume_now;
      end loop;
    end if;
  end loop;
end $$;

create index if not exists idx_portion_definitions_active
  on inventory.portion_definitions (is_active);

create index if not exists idx_unit_conversions_portion_definition_id
  on inventory.unit_conversions (portion_definition_id);

create index if not exists idx_stock_inbounds_stock_product_id
  on inventory.stock_inbounds (stock_product_id);

create index if not exists idx_stock_inbounds_unit_conversion_id
  on inventory.stock_inbounds (unit_conversion_id);

create index if not exists idx_stock_inbounds_supplier_id
  on inventory.stock_inbounds (supplier_id);

-- Supports FIFO consumption: pick the oldest non-empty lot of a product.
create index if not exists idx_stock_inbounds_lot_fifo
  on inventory.stock_inbounds (stock_product_id, created_at asc, id asc)
  where remaining_quantity > 0;

create index if not exists idx_stock_balances_unit_conversion_id
  on inventory.stock_balances (unit_conversion_id);

create index if not exists idx_menu_products_product_category
  on inventory.menu_products (product_category);

create index if not exists idx_menu_product_components_menu_product_id
  on inventory.menu_product_components (menu_product_id);

create index if not exists idx_menu_product_components_stock_product_id
  on inventory.menu_product_components (stock_product_id);

create index if not exists idx_product_sales_plans_status
  on inventory.product_sales_plans (status);

create index if not exists idx_product_orders_menu_product
  on inventory.product_orders (menu_product_id, ordered_at desc, id desc);

create index if not exists idx_product_orders_ordered_at
  on inventory.product_orders (ordered_at desc);

create index if not exists idx_supplier_products_supplier_id
  on inventory.supplier_products (supplier_id);

create index if not exists idx_supplier_products_stock_product_id
  on inventory.supplier_products (stock_product_id);

-- Performance indexes for the inventory overview & portioning read paths.
-- All are guarded with IF NOT EXISTS so the migration stays idempotent.

-- Supports DISTINCT ON (stock_product_id) ORDER BY stock_product_id, created_at desc, id desc
-- used to find the latest inbound row per product on the overview page.
create index if not exists idx_stock_inbounds_product_created_desc
  on inventory.stock_inbounds (stock_product_id, created_at desc, id desc);

-- Supports ORDER BY created_at DESC LIMIT N and the "today_inbounds" range
-- filter (created_at >= date_trunc('day', now()) AND created_at < ...).
create index if not exists idx_stock_inbounds_created_at_desc
  on inventory.stock_inbounds (created_at desc);

-- Supports the LATERAL price subquery:
--   where stock_product_id = X order by is_preferred desc, updated_at desc limit 1
-- The composite covers all three columns so PG can avoid a sort.
create index if not exists idx_supplier_products_stock_pref_updated
  on inventory.supplier_products (stock_product_id, is_preferred desc, updated_at desc);

-- Supports the inventory overview "Lịch sử nhập theo ngày" timeline query
-- which falls back to supplier_products by (supplier_id, stock_product_id)
-- when an inbound row has no unit_price snapshot. Composite leading on
-- supplier_id matches the equality predicates in the LATERAL join.
create index if not exists idx_supplier_products_supplier_stock
  on inventory.supplier_products (supplier_id, stock_product_id);

-- Supports ORDER BY sb.updated_at DESC used on the overview balances list.
create index if not exists idx_stock_balances_updated_at_desc
  on inventory.stock_balances (updated_at desc);

-- Supports ORDER BY menu_product_id, sort_order, id for the recipe components
-- listing used by the product portioning overview.
create index if not exists idx_menu_product_components_ordering
  on inventory.menu_product_components (menu_product_id, sort_order, id);

comment on schema inventory is 'Inventory domain schema for product stock, balances, portion definitions, and unit conversions.';
comment on table inventory.portion_definitions is 'Master table for portion definitions.';
comment on table inventory.unit_conversions is 'Unit conversions that belong to a portion definition.';
comment on table inventory.stock_products is 'Master table that stores only stock product names.';
comment on table inventory.suppliers is 'Master table for suppliers with contact and status information.';
comment on table inventory.supplier_products is 'Supplier-product matrix storing purchase price and procurement preferences.';
comment on table inventory.stock_inbounds is 'Inbound stock rows storing quantity received, conversion ratio, and input unit.';
comment on table inventory.stock_balances is 'Current stock balance rows storing on-hand quantity, conversion ratio, and on-hand unit.';
comment on table inventory.menu_products is 'Menu products sold to customers, used to define product-level recipes.';
comment on table inventory.menu_product_components is 'Recipe components of a menu product linked to stock products in inventory.';
comment on table inventory.product_sales_plans is 'Sales plan and operational status for each menu product currently being sold.';
comment on column inventory.product_sales_plans.menu_product_id is 'Foreign key referencing inventory.menu_products.id; unique to enforce one sales plan per menu product.';
comment on column inventory.product_sales_plans.sales_target is 'Sales target (planned number of units) for the current operating period.';
comment on column inventory.product_sales_plans.sales_actual is 'Number of units actually sold so far in the current operating period.';
comment on column inventory.product_sales_plans.status is 'Operational status of the menu product: active, limited, or paused.';
comment on column inventory.stock_products.product_category is 'Optional product category used for supplier segmentation and purchasing.';
comment on column inventory.suppliers.primary_category is 'Primary product category supplied by this supplier.';
comment on column inventory.suppliers.default_unit_price is 'Default unit price agreed with supplier for the primary category.';
comment on column inventory.unit_conversions.portion_definition_id is 'Foreign key referencing inventory.portion_definitions.id.';
comment on column inventory.stock_inbounds.stock_product_id is 'Foreign key referencing inventory.stock_products.id.';
comment on column inventory.stock_inbounds.supplier_id is 'Nullable foreign key referencing supplier associated with an inbound row.';
comment on column inventory.stock_inbounds.unit_price is 'Snapshot of the purchase unit price at receipt creation time.';
comment on column inventory.stock_inbounds.unit_conversion_id is 'Nullable foreign key to inventory.unit_conversions when an inbound row uses a conversion rule.';
comment on column inventory.stock_inbounds.remaining_quantity is 'Quantity of this lot still available for FIFO consumption, stored in the stock product normalized unit (input_quantity * conversion_ratio).';
comment on column inventory.stock_balances.stock_product_id is 'Foreign key referencing inventory.stock_products.id.';
comment on column inventory.stock_balances.unit_conversion_id is 'Nullable foreign key to inventory.unit_conversions representing the latest normalization rule used for the balance row.';
comment on column inventory.menu_product_components.stock_product_id is 'Foreign key referencing inventory.stock_products.id to ensure recipe components are linked to stock ingredients.';
comment on table inventory.product_orders is 'Sales orders captured per menu product, used to display order history and compute realized revenue/profit.';
comment on column inventory.product_orders.order_code is 'Human-friendly unique order code generated at insert time, e.g. ORD-YYYYMMDD-XXXX.';
comment on column inventory.product_orders.menu_product_id is 'Foreign key referencing inventory.menu_products.id; cascade delete with the menu product.';
comment on column inventory.product_orders.order_type is 'Order channel: dine_in (Ăn tại quán) or takeaway (Mua mang về).';
comment on column inventory.product_orders.quantity is 'Number of units sold in this order; must be greater than zero.';
comment on column inventory.product_orders.unit_price is 'Selling price per unit at the time the order was captured.';
comment on column inventory.product_orders.total_amount is 'Total revenue for the order (unit_price * quantity).';
comment on column inventory.product_orders.cost_amount is 'Total cost of goods sold for the order, snapshot at insert time.';
comment on column inventory.product_orders.profit_amount is 'Profit for the order (total_amount - cost_amount).';
comment on column inventory.product_orders.currency_code is 'Currency code stored as ISO-like text (default VND).';
comment on column inventory.product_orders.ordered_at is 'Wall-clock time when the order was placed; used for ordering and reporting.';
