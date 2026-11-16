-- ⚠️ 지금은 실행하지 말 것 (2026-11-16)
-- 테스트 기간 동안 계정 삭제는 일부러 막아둠: 마이페이지 버튼을 비활성화했고(PR #26), DB에서도 이 함수를 drop 함.
-- 앱은 더 이상 delete_my_account 를 호출하지 않는다. 탈퇴를 다시 열 때 버튼 연결과 함께 실행할 것.

-- Lets a signed-in user delete their own account from My Page → Delete Account.
-- Run once in Supabase → SQL Editor. Their user_states row goes with it (on delete cascade).
create or replace function public.delete_my_account() returns void
language sql security definer set search_path = public, auth as $$
  delete from auth.users where id = auth.uid();
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
