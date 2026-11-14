-- 길BTI: let each account see whether it has answered already (run after 007_gilbti.sql).
-- Logging in on a new device then skips the interview instead of asking again.
drop policy if exists "own answers: select" on public.gilbti_responses;
create policy "own answers: select" on public.gilbti_responses for select to authenticated using (user_id = auth.uid());
