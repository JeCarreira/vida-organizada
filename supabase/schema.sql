-- Fase 0 - Base mínima segura
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  notes text,
  area text,
  color text not null default 'areia',
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  event_type text not null default 'Normal',
  prepare_days_before integer not null default 0,
  recurrence text not null default 'none',
  checklist jsonb not null default '[]'::jsonb,
  status text not null default 'por_preparar',
  budget_estimate numeric(10,2) not null default 0,
  budget_spent numeric(10,2) not null default 0,
  budget_currency text not null default 'EUR',
  shopping_list jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_end_after_start check (ends_at is null or ends_at >= starts_at),
  constraint events_prepare_days_non_negative check (prepare_days_before >= 0),
  constraint events_budget_non_negative check (budget_estimate >= 0 and budget_spent >= 0)
);

-- Fase 0.3: campos aditivos para repositórios que já tinham a tabela events criada.
alter table public.events add column if not exists event_type text not null default 'Normal';
alter table public.events add column if not exists prepare_days_before integer not null default 0;
alter table public.events add column if not exists recurrence text not null default 'none';
alter table public.events add column if not exists checklist jsonb not null default '[]'::jsonb;
alter table public.events add column if not exists status text not null default 'por_preparar';

-- Fase 0.6: compras e orçamento por evento.
alter table public.events add column if not exists budget_estimate numeric(10,2) not null default 0;
alter table public.events add column if not exists budget_spent numeric(10,2) not null default 0;
alter table public.events add column if not exists budget_currency text not null default 'EUR';
alter table public.events add column if not exists shopping_list jsonb not null default '[]'::jsonb;

alter table public.events drop constraint if exists events_prepare_days_non_negative;
alter table public.events add constraint events_prepare_days_non_negative check (prepare_days_before >= 0);

alter table public.events drop constraint if exists events_budget_non_negative;
alter table public.events add constraint events_budget_non_negative check (budget_estimate >= 0 and budget_spent >= 0);

create index if not exists events_user_id_starts_at_idx on public.events (user_id, starts_at);
create index if not exists events_user_id_event_type_idx on public.events (user_id, event_type);
create index if not exists events_user_id_status_idx on public.events (user_id, status);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
before update on public.events
for each row execute procedure public.set_updated_at();
