-- Lets a signed-in user delete their own account from My Page → Delete Account.
-- Run once in Supabase → SQL Editor. Their user_states row goes with it (on delete cascade).
create or replace function public.delete_my_account() returns void
language sql security definer set search_path = public, auth as $$
  delete from auth.users where id = auth.uid();
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
