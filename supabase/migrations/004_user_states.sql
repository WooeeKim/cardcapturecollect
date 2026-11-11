-- Per-account app data for the prototyping branch (towns + cards as one JSON blob).
-- Run once in Supabase → SQL Editor.
create table if not exists public.user_states (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.user_states enable row level security;

-- each signed-in user can only see and write their own row
create policy "own state: select" on public.user_states for select using (auth.uid() = user_id);
create policy "own state: insert" on public.user_states for insert with check (auth.uid() = user_id);
create policy "own state: update" on public.user_states for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own state: delete" on public.user_states for delete using (auth.uid() = user_id);
