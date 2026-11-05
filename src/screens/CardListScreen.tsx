import { useMemo, useState } from 'react'
import CardModal from '../components/CardModal'
import CharacterCard from '../components/CharacterCard'
import Chip from '../components/Chip'
import PenButton from '../components/PenButton'
import { PaperBackground, TopBar } from '../components/Paper'
import type { Sticker } from '../lib/stickers'

// 카드마다 살짝 다르게 기울인다 (손으로 늘어놓은 느낌)
const TILT = [1, -1.5, 0.5, -0.5, 1.5, -1, 0.8, -1.2]
const ALL = '전체'

// Figma: 나은 섹션 05 카드 목록. 모은 카드를 3열로, 분위기로 거르기, 누르면 카드 디테일.
export default function CardListScreen({
  stickers,
  onVillage,
  onDraw,
  onFind,
  onTicket,
  onDelete,
}: {
  stickers: Sticker[]
  onVillage: () => void
  onDraw: () => void
  onFind: (id: string) => void
  // 마을 입장권(마을 고르기)으로 / 카드 삭제
  onTicket: (sticker: Sticker, number: number) => void
  onDelete: (sticker: Sticker) => void
}) {
  const [filter, setFilter] = useState(ALL)
  const [openId, setOpenId] = useState<string | null>(null)
  // 열어 본 카드는 "New" 표시가 사라진다
  const [seen, setSeen] = useState<Set<string>>(new Set())
  // 번호는 만든 순서, 목록은 최근 것부터
  const numbered = useMemo(() => stickers.map((s, i) => ({ s, n: i + 1 })).reverse(), [stickers])
  const moods = useMemo(() => [ALL, ...new Set(stickers.map((s) => s.mood).filter(Boolean))], [stickers])
  const shown = filter === ALL ? numbered : numbered.filter(({ s }) => s.mood === filter)
  const open = numbered.find(({ s }) => s.id === openId)
  // 하루 안에 만든 카드 중 아직 안 열어 본 것
  const isNew = (s: Sticker) => !seen.has(s.id) && Date.now() - new Date(s.createdAt).getTime() < 24 * 3600 * 1000

  return (
    <div className="relative h-full overflow-hidden text-pencil">
      <PaperBackground />
      <TopBar left="마을" title="내 카드" right={`${stickers.length}장`} onLeft={onVillage} />

      <div className="absolute inset-x-0 top-[calc(env(safe-area-inset-top)+88px)] bottom-0 overflow-y-auto px-[24px] pb-[130px]">
        {moods.length > 1 && (
          <div className="flex flex-wrap gap-[8px] pb-[18px]">
            {moods.map((m, i) => (
              <Chip key={m} label={m} seed={180 + i} on={filter === m} onClick={() => setFilter(m)} />
            ))}
          </div>
        )}
        <div className="grid grid-cols-3 gap-x-[12px] gap-y-[14px]">
          {shown.map(({ s, n }, i) => (
            <button
              key={s.id}
              onClick={() => {
                setOpenId(s.id)
                setSeen(new Set(seen).add(s.id))
              }}
              style={{ rotate: `${TILT[i % TILT.length]}deg` }}
              className="relative transition-transform ease-spring active:scale-95"
            >
              <CharacterCard sticker={s} number={n} />
              {isNew(s) && <span className="absolute -top-[8px] left-[4px] rounded-full bg-pencil px-[9px] pt-[2px] pb-[1px] font-pen text-[17px] leading-[1.1] text-card">New</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Figma: 아래 가운데 넓은 "그리기 시작" 버튼 (목록은 흰 바탕으로 흐려진다) */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-card from-60% to-transparent px-[24px] pt-[40px] pb-[calc(env(safe-area-inset-bottom)+24px)] [&>button]:pointer-events-auto [&>button]:w-full">
        <PenButton onClick={onDraw}>그리기 시작</PenButton>
      </div>

      {open && (
        <CardModal
          sticker={open.s}
          number={open.n}
          onTicket={() => onTicket(open.s, open.n)}
          onFind={() => onFind(open.s.id)}
          onDelete={() => {
            onDelete(open.s)
            setOpenId(null)
          }}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  )
}
