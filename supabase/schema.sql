-- 찌부씰 와이어프레임용 스키마. Supabase 대시보드 → SQL Editor 에 붙여넣고 실행.
-- 로그인이 없는 팀 내부 테스트용이라 anon 에게 읽기/쓰기를 열어 둔다.

create table if not exists public.stickers (
  id uuid primary key default gen_random_uuid(),
  place text not null default '',
  name text not null default '',
  memo text not null default '',
  -- 캐릭터 카드 분위기(하나)·성격(두 개까지)
  mood text not null default '',
  traits text[] not null default '{}',
  image_path text not null,
  created_at timestamptz not null default now(),
  -- 스티커북에 붙인 위치 (null 이면 아직 안 붙임). book_label = 라벨(책) 1~6
  book_label int,
  book_page int,
  book_slot int,
  -- 지하철 꾸미기 위치 (0~1 비율, null 이면 안 붙임)
  deco_x real,
  deco_y real
);

alter table public.stickers enable row level security;

create policy "anon read stickers" on public.stickers for select to anon using (true);
create policy "anon insert stickers" on public.stickers for insert to anon with check (true);
create policy "anon update stickers" on public.stickers for update to anon using (true);

-- 그림 PNG 저장용 공개 버킷
insert into storage.buckets (id, name, public)
values ('stickers', 'stickers', true)
on conflict (id) do nothing;

create policy "anon upload sticker images" on storage.objects
  for insert to anon with check (bucket_id = 'stickers');
create policy "anon read sticker images" on storage.objects
  for select to anon using (bucket_id = 'stickers');
