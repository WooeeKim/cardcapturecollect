import { useMemo, useState } from 'react'
import CardSheet from '../components/CardSheet'
import CharacterCard from '../components/CharacterCard'
import Chip from '../components/Chip'
import { PaperBackground, TopBar } from '../components/Paper'
import SketchBorder from '../components/SketchBorder'
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
}: {
  stickers: Sticker[]
  onVillage: () => void
  onDraw: () => void
  onFind: (id: string) => void
}) {
  const [filter, setFilter] = useState(ALL)
  const [openId, setOpenId] = useState<string | null>(null)
  // 번호는 만든 순서, 목록은 최근 것부터
  const numbered = useMemo(() => stickers.map((s, i) => ({ s, n: i + 1 })).reverse(), [stickers])
  const moods = useMemo(() => [ALL, ...new Set(stickers.map((s) => s.mood).filter(Boolean))], [stickers])
  const shown = filter === ALL ? numbered : numbered.filter(({ s }) => s.mood === filter)
  const open = numbered.find(({ s }) => s.id === openId)

  return (
    <div className="relative h-full overflow-hidden text-pencil">
      <PaperBackground />
      <TopBar left="마을" title="내 카드" right={`${stickers.length}장`} onLeft={onVillage} />

      <div className="absolute inset-x-0 top-[calc(env(safe-area-inset-top)+88px)] bottom-0 overflow-y-auto px-[24px] pb-[40px]">
        {moods.length > 1 && (
          <div className="flex flex-wrap gap-[8px] pb-[18px]">
            {moods.map((m, i) => (
              <Chip key={m} label={m} seed={180 + i} on={filter === m} onClick={() => setFilter(m)} />
            ))}
          </div>
        )}
        <div className="grid grid-cols-3 gap-x-[12px] gap-y-[14px]">
          <button onClick={onDraw} className="relative flex aspect-[250/350] flex-col items-center justify-center gap-[8px] text-muted">
            <SketchBorder w={110} h={154} r={8} seed={960} weight={1.2} double={false} className="opacity-60 [&_path]:[stroke-dasharray:5_4]" />
            <svg viewBox="0 0 24 24" className="size-[24px] opacity-70" aria-hidden>
              <path d="M0 12 L24 12 M12 0 L12 24" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
            </svg>
            <span className="font-pen text-[17px] leading-none">새로 그리기</span>
          </button>
          {shown.map(({ s, n }, i) => (
            <button key={s.id} onClick={() => setOpenId(s.id)} style={{ rotate: `${TILT[i % TILT.length]}deg` }} className="transition-transform ease-spring active:scale-95">
              <CharacterCard sticker={s} number={n} />
            </button>
          ))}
        </div>
      </div>

      {open && (
        <CardSheet
          sticker={open.s}
          number={open.n}
          action="마을에서 찾기"
          onAction={() => onFind(open.s.id)}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  )
}
