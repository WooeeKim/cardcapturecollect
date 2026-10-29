import { useState } from 'react'
import type { Sticker } from '../lib/stickers'
import StickerFrame, { StickerChip, formatDate } from './StickerFrame'

// 저장된 찌부씰. flippable 이면 뒤집기 아이콘으로 뒷면(메모)을 본다.
export default function StickerCard({ sticker, flippable = false }: { sticker: Sticker; flippable?: boolean }) {
  const [back, setBack] = useState(false)
  const date = formatDate(sticker.createdAt)

  if (!flippable) {
    return (
      <StickerFrame
        chip={<StickerChip place={sticker.place} name={sticker.name} />}
        date={date}
      >
        <img src={sticker.imageUrl} alt={sticker.name} draggable={false} className="size-full object-contain" />
      </StickerFrame>
    )
  }

  return (
    <div className="perspective w-full">
      <div className={`flip-inner relative aspect-[361/451] w-full ${back ? 'flipped' : ''}`}>
        <div className="flip-face">
          <StickerFrame
            chip={<StickerChip place={sticker.place} name={sticker.name} />}
            date={date}
            onFlip={() => setBack(true)}
          >
            <img src={sticker.imageUrl} alt={sticker.name} draggable={false} className="size-full object-contain" />
          </StickerFrame>
        </div>
        <div className="flip-face flip-back">
          <StickerFrame chip={null} date={date} onFlip={() => setBack(false)}>
            <p className="p-[4cqw] text-center text-[5.54cqw] leading-normal font-medium break-words text-muted">
              {sticker.memo || 'No memo'}
            </p>
          </StickerFrame>
        </div>
      </div>
    </div>
  )
}
