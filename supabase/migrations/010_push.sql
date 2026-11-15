-- Web Push subscriptions: one row per phone/browser that allowed notifications.
-- Saved by the app (src/lib/push.ts), read by <site>/admin → Notify, sent by api/push.js.
-- Run once in Supabase → SQL Editor, after 009_app_events.sql.

create table if not exists public.push_subscriptions (
  endpoint text primary key,
  sub jsonb not null, -- PushSubscription.toJSON(): { endpoint, keys: { p256dh, auth } }
  device_id text not null,
  user_id uuid references auth.users (id) on delete cascade, -- null = guest
  email text,
  updated_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

-- the app writes only through these two functions (they stamp the current login on the row)
create or replace function public.save_push(sub jsonb, device text) returns void
language sql security definer set search_path = public as $$
  insert into public.push_subscriptions (endpoint, sub, device_id, user_id, email)
  values (sub ->> 'endpoint', sub, device, auth.uid(), lower(auth.jwt() ->> 'email'))
  on conflict (endpoint) do update
    set sub = excluded.sub, device_id = excluded.device_id, user_id = excluded.user_id, email = excluded.email, updated_at = now()
$$;

create or replace function public.drop_push(endpoint text) returns void
language sql security definer set search_path = public as $$
  delete from public.push_subscriptions p where p.endpoint = drop_push.endpoint
$$;

grant execute on function public.save_push(jsonb, text) to anon, authenticated;
grant execute on function public.drop_push(text) to anon, authenticated;

-- team admins (app_admins) see who can be reached and clear expired ones
drop policy if exists "admins: read subs" on public.push_subscriptions;
create policy "admins: read subs" on public.push_subscriptions for select using (public.is_admin());
drop policy if exists "admins: delete subs" on public.push_subscriptions;
create policy "admins: delete subs" on public.push_subscriptions for delete using (public.is_admin());
