-- 마을 번호. null 이면 컬렉션에만 있고 마을엔 없다. 카드를 만든 뒤 "이정표 선택"에서 정해진다.
alter table public.stickers add column if not exists village int;

-- 마을 개념 이전에 만든 카드는 첫 마을(1번)에 둔다
update public.stickers set village = 1 where village is null;
