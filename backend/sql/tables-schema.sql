create schema if not exists sales;

create table if not exists sales.tables (
  id bigserial primary key,
  table_name text not null unique,
  status text not null default 'available' check (status in ('available', 'occupied', 'reserved')),
  qr_token text, -- Mã token duy nhất để sinh link QR gọi món (vd: hash)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sales.table_sessions (
  id bigserial primary key,
  table_id bigint not null references sales.tables(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'paid', 'cancelled')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  total_amount numeric(18, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- We link table orders to menu products
create table if not exists sales.table_orders (
  id bigserial primary key,
  session_id bigint not null references sales.table_sessions(id) on delete cascade,
  menu_product_id bigint not null references inventory.menu_products(id) on delete restrict,
  quantity integer not null default 1 check (quantity > 0),
  unit_price numeric(18, 2) not null check (unit_price >= 0),
  total_amount numeric(18, 2) not null generated always as (quantity * unit_price) stored,
  status text not null default 'pending' check (status in ('pending', 'served', 'cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Khi hóa đơn được thanh toán, ta có thể lưu thông tin vào bảng hoá đơn hoặc dùng chính table_sessions (vì nó đã đại diện cho 1 hóa đơn)
