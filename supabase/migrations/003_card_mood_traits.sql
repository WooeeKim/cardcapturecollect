-- 캐릭터 카드 상세: 분위기(하나)와 성격(두 개까지). 02 상세 입력 화면에서 받는다.
alter table public.stickers add column if not exists mood text not null default '';
alter table public.stickers add column if not exists traits text[] not null default '{}';
