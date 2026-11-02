import type { ReactNode } from 'react'
import flipIcon from '../assets/figma/flip.svg'

// 찌부씰 카드 틀. Figma 캔버스 카드(361×451) 비율을 그대로 쓰고,
// 내부 치수는 카드 폭 기준 cqw 로 잡아 스티커북·꾸미기에서 작게 써도 모양이 같다.
// (값 = Figma px / 361 × 100)
export default function StickerFrame({
  chip,
  children,
  date,
  onFlip,
  footer,
  className = '',
}: {
  chip: ReactNode
  children: ReactNode
  date: string
  onFlip?: () => void
  footer?: ReactNode
  className?: string
}) {
  return (
    <div className={`@container w-full ${className}`}>
      <div className="relative flex aspect-[361/451] w-full flex-col gap-[4.155cqw] overflow-hidden rounded-[0.831cqw] bg-white p-[4.155cqw]">
        <div className="flex items-start">{chip}</div>
        <div className="relative min-h-0 w-full flex-1">{children}</div>
        <div className="flex items-center justify-between">
          {footer ?? <span />}
          <p className="text-[3.324cqw] leading-normal font-semibold text-muted">{date}</p>
        </div>
        {onFlip ? (
          <button
            type="button"
            onClick={onFlip}
            aria-label="뒤집기"
            className="absolute top-[5.54cqw] left-[87.53cqw] h-[5.54cqw] w-[6.856cqw]"
          >
            <FlipIcon />
          </button>
        ) : (
          <span className="absolute top-[5.54cqw] left-[87.53cqw] h-[5.54cqw] w-[6.856cqw]">
            <FlipIcon />
          </span>
        )}
      </div>
    </div>
  )
}

function FlipIcon() {
  return (
    <span className="absolute inset-[-5%_-4.04%]">
      <img src={flipIcon} alt="" className="block size-full max-w-none" />
    </span>
  )
}

// Place · Drawing Name 칩 (읽기 전용)
export function StickerChip({ place, name }: { place: string; name: string }) {
  return (
    <div className="flex items-center gap-[2.77cqw] overflow-hidden rounded-full border-[0.554cqw] border-chip-border bg-white pr-[4.155cqw] shadow-chip">
      <span className="rounded-full bg-line px-[2.45cqw] py-[1.75cqw] text-[4.155cqw] leading-normal font-semibold whitespace-nowrap text-white">
        {place || 'Place'}
      </span>
      <span className="font-inter text-[4.155cqw] leading-normal font-semibold whitespace-nowrap text-ink-soft">
        {name || 'Drawing Name'}
      </span>
    </div>
  )
}

export function formatDate(iso: string) {
  return iso.slice(0, 10).replaceAll('-', '.')
}
