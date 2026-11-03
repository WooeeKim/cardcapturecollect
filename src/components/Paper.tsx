import { useMemo } from 'react'
import { wobblyLine } from '../lib/sketch'

// Figma 나은 섹션 "Paper Background": 따뜻한 종이 + 아주 옅은 연필 격자
export function PaperBackground() {
  return (
    <div
      className="pointer-events-none absolute inset-0 bg-card"
      style={{
        backgroundImage:
          'linear-gradient(to right, rgb(58 50 43 / 0.05) 0.6px, transparent 0.6px), linear-gradient(to bottom, rgb(58 50 43 / 0.05) 0.6px, transparent 0.6px)',
        backgroundSize: '48px 48px',
        backgroundPosition: '33px 40px',
      }}
      aria-hidden
    />
  )
}

// Figma 나은 섹션 "Top Bar": 왼쪽 · 제목(손그림 밑줄) · 오른쪽
export function TopBar({
  left,
  title,
  right,
  onLeft,
  onRight,
  rightDisabled = false,
}: {
  left: string
  title: string
  right: string
  onLeft: () => void
  onRight: () => void
  rightDisabled?: boolean
}) {
  const underline = useMemo(() => wobblyLine(90, 7), [])
  return (
    <div className="absolute inset-x-0 top-[calc(env(safe-area-inset-top)+28px)] z-10 flex h-[52px] items-center justify-between px-[20px] text-pencil">
      <button onClick={onLeft} className="font-pen text-[24px] leading-none">
        {left}
      </button>
      <h1 className="relative font-hand text-[22px] leading-none font-bold">
        {title}
        <svg viewBox="-2 -3 94 6" className="absolute -bottom-[7px] left-1/2 h-[6px] w-[94px] -translate-x-1/2 overflow-visible" aria-hidden>
          <path d={underline} fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" opacity={0.8} />
        </svg>
      </h1>
      <button onClick={onRight} disabled={rightDisabled} className="font-pen text-[24px] leading-none disabled:opacity-40">
        {right}
      </button>
    </div>
  )
}
