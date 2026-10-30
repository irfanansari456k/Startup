create table if not exists public.shop_rates (
  product_id text primary key check (
    product_id in (
      'boiler-kata-hua',
      'khada-boiler',
      'cockrel',
      'layer',
      'desi-chicken'
    )
  ),
  price_inr numeric(10, 2) not null check (price_inr > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

create table if not exists public.shop_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.shop_rates enable row level security;
alter table public.shop_admins enable row level security;

create or replace function public.is_shop_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.shop_admins
    where user_id = (select auth.uid())
  );
$$;

create or replace function public.set_shop_rate_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_shop_rate_updated_at on public.shop_rates;
create trigger set_shop_rate_updated_at
before update on public.shop_rates
for each row execute function public.set_shop_rate_updated_at();

drop policy if exists "Anyone can read shop rates" on public.shop_rates;
create policy "Anyone can read shop rates"
on public.shop_rates for select
to anon, authenticated
using (true);

drop policy if exists "Shop admins can insert rates" on public.shop_rates;
create policy "Shop admins can insert rates"
on public.shop_rates for insert
to authenticated
with check (public.is_shop_admin());

drop policy if exists "Shop admins can update rates" on public.shop_rates;
create policy "Shop admins can update rates"
on public.shop_rates for update
to authenticated
using (public.is_shop_admin())
with check (public.is_shop_admin());

drop policy if exists "Shop admins can read their own admin record" on public.shop_admins;
create policy "Shop admins can read their own admin record"
on public.shop_admins for select
to authenticated
using (user_id = (select auth.uid()));

grant select on public.shop_rates to anon, authenticated;
grant insert, update on public.shop_rates to authenticated;
grant select on public.shop_admins to authenticated;
revoke all on function public.is_shop_admin() from public, anon;
grant execute on function public.is_shop_admin() to authenticated;
revoke all on function public.set_shop_rate_updated_at() from public, anon, authenticated;
