-- Card share links: <site>/c/<id> shows one card to anyone with the link (api/card.js).
-- The app uploads the card image to the public Storage bucket "card-shares" and adds a row here
-- (src/lib/cardShare.ts). Run once in Supabase → SQL Editor. No secrets in this file.

create table if not exists public.card_shares (
  id text primary key check (id ~ '^[A-Za-z0-9]{10,32}$'), -- random, unguessable link id
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id text not null,
  nickname text,
  memo text,
  mood text,
  place text,
  serial text,
  image_path text not null, -- "<user_id>/<id>.png" in bucket card-shares
  created_at timestamptz not null default now()
);
create index if not exists card_shares_user on public.card_shares (user_id);

alter table public.card_shares enable row level security;

-- anyone with the link can read a shared card (the id is the secret; there is no list page)
drop policy if exists "shared cards: read" on public.card_shares;
create policy "shared cards: read" on public.card_shares for select to anon, authenticated using (true);
-- only the owner adds or removes their shares
drop policy if exists "shared cards: insert own" on public.card_shares;
create policy "shared cards: insert own" on public.card_shares for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "shared cards: delete own" on public.card_shares;
create policy "shared cards: delete own" on public.card_shares for delete to authenticated using (user_id = auth.uid());

-- public bucket: images are readable by URL; uploads only into your own folder, PNG, up to 5 MB
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('card-shares', 'card-shares', true, 5242880, array['image/png'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/png'];

drop policy if exists "card-shares: upload own" on storage.objects;
create policy "card-shares: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'card-shares' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "card-shares: delete own" on storage.objects;
create policy "card-shares: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'card-shares' and (storage.foldername(name))[1] = auth.uid()::text);

-- check:  select id, nickname, created_at from public.card_shares order by created_at desc limit 10;
