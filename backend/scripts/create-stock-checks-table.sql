create table if not exists inventory.stock_checks (
  id bigserial primary key,
  check_code text not null unique,
  status text not null default 'pending',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists inventory.stock_check_items (
  id bigserial primary key,
  check_id bigint not null references inventory.stock_checks(id) on delete cascade,
  stock_product_id bigint not null references inventory.stock_products(id) on delete restrict,
  system_quantity numeric(14,4) not null,
  actual_quantity numeric(14,4) not null,
  variance_quantity numeric(14,4) not null,
  unit text not null,
  created_at timestamptz not null default now()
);
