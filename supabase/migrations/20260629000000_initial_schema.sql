-- Schéma initial : tenants, users, et catalogue de formations (formations, modules, lecons).
-- Les formations/modules/lecons sont un catalogue global créé uniquement par le Super-admin (Ahead) :
-- ils ne sont pas rattachés à un tenant. Seules les tables tenants et users portent l'isolation
-- multi-tenant (tenant_id), base sur laquelle la RLS sera écrite dans une migration suivante.

create extension if not exists pgcrypto;

-- --- tenants ---
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  clerk_org_id text not null unique,
  name text not null,
  slug text not null unique,
  subscription_plan text check (subscription_plan in ('decouverte', 'creation', 'entreprise')),
  subscription_status text check (
    subscription_status in ('trialing', 'active', 'past_due', 'canceled', 'unpaid')
  ),
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- --- users ---
create table public.users (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null unique,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  role text not null check (
    role in ('super_admin', 'admin_tenant', 'tuteur', 'formateur', 'apprenant')
  ),
  email text not null,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index users_tenant_id_idx on public.users (tenant_id);

-- --- formations (catalogue global, créé par le Super-admin) ---
create table public.formations (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  description text,
  thumbnail_url text,
  is_published boolean not null default false,
  created_by uuid references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- --- modules ---
create table public.modules (
  id uuid primary key default gen_random_uuid(),
  formation_id uuid not null references public.formations (id) on delete cascade,
  title text not null,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index modules_formation_id_idx on public.modules (formation_id);

-- --- lecons ---
create table public.lecons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules (id) on delete cascade,
  title text not null,
  content_type text not null default 'markdown' check (content_type in ('markdown', 'video', 'quiz')),
  content_markdown text,
  video_url text,
  order_index integer not null default 0,
  duration_minutes integer,
  is_preview boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lecons_module_id_idx on public.lecons (module_id);
