-- LZN STORE: schema principal. Valores monetários em centavos (integer).
create extension if not exists "pgcrypto";
create extension if not exists "unaccent";

-- Funções utilitárias -------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Perfis e administradores -------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  cpf text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Catálogo -----------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  image_url text,
  parent_id uuid references public.categories(id) on delete set null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  slug text not null unique,
  description text not null default '',
  price_cents integer not null check (price_cents >= 0),
  promo_price_cents integer check (promo_price_cents is null or (promo_price_cents >= 0 and promo_price_cents < price_cents)),
  is_active boolean not null default true,
  is_featured boolean not null default false,
  is_best_seller boolean not null default false,
  is_special_offer boolean not null default false,
  weight_grams integer check (weight_grams is null or weight_grams > 0),
  length_cm numeric(6,2) check (length_cm is null or length_cm > 0),
  width_cm numeric(6,2) check (width_cm is null or width_cm > 0),
  height_cm numeric(6,2) check (height_cm is null or height_cm > 0),
  sales_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Variações (cor, tamanho etc.). Todo produto tem ao menos uma variação.
-- Preço da variação, quando nulo, usa o do produto.
create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku text not null unique,
  name text not null default 'Padrão',
  price_cents integer check (price_cents is null or price_cents >= 0),
  promo_price_cents integer check (promo_price_cents is null or promo_price_cents >= 0),
  is_available boolean not null default true,
  stock_quantity integer check (stock_quantity is null or stock_quantity >= 0), -- null = disponibilidade pelo fornecedor
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  url text not null,
  alt text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Fornecedores ---------------------------------------------------------------
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text,
  email text,
  phone text,
  website text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.supplier_products (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  supplier_sku text,
  supplier_url text,
  cost_cents integer not null check (cost_cents >= 0),
  estimated_days_min integer check (estimated_days_min is null or estimated_days_min >= 0),
  estimated_days_max integer check (estimated_days_max is null or estimated_days_max >= 0),
  shipping_info text,
  is_preferred boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (supplier_id, variant_id)
);

-- Clientes e endereços ---------------------------------------------------------
-- customers permite compra de visitante (user_id nulo) e conta cadastrada.
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  email text not null,
  name text not null,
  phone text,
  cpf text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  label text not null default 'Casa',
  recipient_name text not null,
  zip_code text not null check (zip_code ~ '^[0-9]{8}$'),
  street text not null,
  number text not null,
  complement text,
  district text not null,
  city text not null,
  state char(2) not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Cupons ---------------------------------------------------------------------
create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code)),
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  discount_value integer not null check (discount_value > 0),
  min_order_cents integer not null default 0 check (min_order_cents >= 0),
  max_uses integer check (max_uses is null or max_uses > 0),
  max_uses_per_customer integer not null default 1 check (max_uses_per_customer > 0),
  used_count integer not null default 0,
  starts_at timestamptz,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (discount_type <> 'percent' or discount_value <= 100)
);

-- Pedidos ----------------------------------------------------------------------
create sequence public.order_number_seq start 1001;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint not null unique default nextval('public.order_number_seq'),
  customer_id uuid not null references public.customers(id) on delete restrict,
  status text not null default 'pending_payment' check (status in
    ('pending_payment','paid','sent_to_supplier','shipped','delivered','cancelled','refunded')),
  subtotal_cents integer not null check (subtotal_cents >= 0),
  shipping_cents integer not null default 0 check (shipping_cents >= 0),
  discount_cents integer not null default 0 check (discount_cents >= 0),
  total_cents integer not null check (total_cents >= 0),
  coupon_id uuid references public.coupons(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  supplier_notes text,
  -- Snapshot do endereço no momento da compra
  ship_name text not null,
  ship_zip_code text not null,
  ship_street text not null,
  ship_number text not null,
  ship_complement text,
  ship_district text not null,
  ship_city text not null,
  ship_state char(2) not null,
  customer_cpf text,
  customer_phone text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  product_name text not null,
  variant_name text not null,
  sku text not null,
  image_url text,
  unit_price_cents integer not null check (unit_price_cents >= 0),
  cost_cents integer check (cost_cents is null or cost_cents >= 0),
  quantity integer not null check (quantity > 0 and quantity <= 99)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null default 'mercadopago',
  provider_payment_id text unique,
  idempotency_key text not null unique,
  method text not null check (method in ('pix','credit_card')),
  status text not null default 'pending',
  status_detail text,
  amount_cents integer not null check (amount_cents > 0),
  installments integer not null default 1 check (installments between 1 and 12),
  pix_qr_code text,
  pix_qr_code_base64 text,
  pix_expires_at timestamptz,
  raw_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  carrier text,
  tracking_code text,
  tracking_url text,
  shipped_at timestamptz,
  delivered_at timestamptz,
  estimated_delivery date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.coupon_usages (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  order_id uuid not null unique references public.orders(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  discount_cents integer not null check (discount_cents >= 0),
  created_at timestamptz not null default now()
);

-- Configurações e auditoria ---------------------------------------------------
create table public.store_settings (
  key text primary key,
  value jsonb not null,
  is_public boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb,
  created_at timestamptz not null default now()
);

-- Triggers updated_at ----------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['profiles','categories','products','product_variants','suppliers',
    'supplier_products','customers','addresses','coupons','orders','payments','shipments','store_settings']
  loop
    execute format('create trigger set_updated_at before update on public.%I
      for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- Storage: imagens de produtos --------------------------------------------------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;
