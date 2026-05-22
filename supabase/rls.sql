alter table public.profiles enable row level security;
alter table public.events enable row level security;

-- Profiles
create policy "profiles_select_own"
on public.profiles
for select
using (auth.uid() = id);

create policy "profiles_update_own"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "profiles_insert_own"
on public.profiles
for insert
with check (auth.uid() = id);

-- Events
create policy "events_select_own"
on public.events
for select
using (auth.uid() = user_id);

create policy "events_insert_own"
on public.events
for insert
with check (auth.uid() = user_id);

create policy "events_update_own"
on public.events
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "events_delete_own"
on public.events
for delete
using (auth.uid() = user_id);
