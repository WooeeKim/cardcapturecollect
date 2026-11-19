-- Shared town ("Last Stop"): one town every user sees, at the end of everyone's Town List like a line's last stop.
-- A card moved here leaves its owner's own town; the whole card (drawing, mood, place, nickname, memo) is shown
-- to everyone, guests included. Each account can have up to 3 people here. Moving back = deleting the row.
-- Run once in Supabase → SQL Editor.

create table if not exists public.square_cards (
  card_id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  card jsonb not null, -- the Card as the app stores it (src/lib/store.ts)
  moved_at timestamptz not null default now()
);
create index if not exists square_cards_moved_at on public.square_cards (moved_at desc);
create index if not exists square_cards_user on public.square_cards (user_id);

alter table public.square_cards enable row level security;

-- everyone (guests too) can look around
drop policy if exists "anyone: read square" on public.square_cards;
create policy "anyone: read square" on public.square_cards for select to anon, authenticated using (true);

-- only your own cards go in / come out
drop policy if exists "own: move in" on public.square_cards;
create policy "own: move in" on public.square_cards for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "own: move out" on public.square_cards;
create policy "own: move out" on public.square_cards for delete to authenticated using (user_id = auth.uid());

-- 3 per account (the app checks too; this keeps it true even with two devices at once)
create or replace function public.square_cards_cap() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtext(new.user_id::text));
  if (select count(*) from public.square_cards where user_id = new.user_id) >= 3 then
    raise exception 'square_cap' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists square_cards_cap on public.square_cards;
create trigger square_cards_cap before insert on public.square_cards for each row execute function public.square_cards_cap();
