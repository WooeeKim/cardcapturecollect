import { useMemo, useState } from 'react'
import { wobblyRect } from '../lib/sketch'
import type { Sticker } from '../lib/stickers'
import CharacterCard from './CharacterCard'
import Chip from './Chip'
import PenButton from './PenButton'

// Figma: 나은 섹션 06 카드 디테일. 아래에서 올라오는 시트에 카드 + 이름·장소·분위기·성격, 카드 뒤집기.
export default function CardSheet({
  sticker,
  number,
  action,
  onAction,
  onClose,
}: {
  sticker: Sticker
  number: number
  action: string
  onAction: () => void
  onClose: () => void
}) {
  const [flipped, setFlipped] = useState(false)
  const edge = useMemo(() => wobblyRect(402, 470, 24, 980), [])
  const tags = [sticker.mood, ...sticker.traits].filter(Boolean)

  return (
    <div className="absolute inset-0 z-30">
      <button aria-label="닫기" onClick={onClose} className="absolute inset-0 bg-pencil/25" />
      <div className="absolute inset-x-0 bottom-0 animate-sheet-up rounded-t-[24px] bg-card px-[18px] pt-[30px] pb-[calc(env(safe-area-inset-bottom)+28px)] text-pencil">
        <svg viewBox="0 0 402 470" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full overflow-visible" aria-hidden>
          <path d={edge} fill="none" stroke="currentColor" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        </svg>
        <span className="absolute top-[12px] left-1/2 h-[3px] w-[40px] -translate-x-1/2 rounded-full bg-pencil/50" />
        <div className="flex gap-[16px]">
          <button aria-label="카드 뒤집기" onClick={() => setFlipped(!flipped)} className="w-[min(196px,48%)] shrink-0 -rotate-[1.5deg]">
            <CharacterCard sticker={sticker} number={number} flipped={flipped} />
          </button>
          <div className="flex min-w-0 flex-1 flex-col gap-[10px] pt-[8px]">
            <h2 className="font-hand text-[22px] leading-tight font-bold break-keep">{sticker.name || '이름 없는 사람'}</h2>
            {sticker.place && <p className="font-pen text-[18px] leading-none text-muted">{sticker.place}</p>}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-[6px]">
                {tags.map((t, i) => (
                  <Chip key={t} label={t} seed={160 + i} on={i === 0 && t === sticker.mood} />
                ))}
              </div>
            )}
            <div className="mt-auto flex flex-col items-start gap-[10px]">
              <PenButton small onClick={onAction}>
                {action}
              </PenButton>
              <PenButton small ghost onClick={() => setFlipped(!flipped)}>
                카드 뒤집기
              </PenButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
