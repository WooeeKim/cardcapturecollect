import { useMemo } from 'react'
import { wobblyCircle, wobblyPoly } from '../lib/sketch'

// 어느 화면에서든 바로 새 카드를 그리러 가는 연필 버튼 (오른쪽 아래에 떠 있다)
export default function DrawButton({ onClick }: { onClick: () => void }) {
  const art = useMemo(
    () => ({
      ring: wobblyCircle(30, 30, 30.5, 991, 0.04),
      body: wobblyPoly([[36, 14], [46, 24], [24, 46], [14, 36]], 992),
      tip: wobblyPoly([[14, 36], [24, 46], [11, 49]], 993),
    }),
    [],
  )
  return (
    <button
      aria-label="새로 그리기"
      onClick={onClick}
      className="absolute right-[20px] bottom-[calc(env(safe-area-inset-bottom)+24px)] z-20 size-[60px] rounded-full bg-pencil text-card shadow-sticker transition-transform ease-spring active:scale-90"
    >
      <svg viewBox="0 0 60 60" className="size-full overflow-visible" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={art.ring} className="text-pencil" stroke="currentColor" strokeWidth={1.5} />
        <path d={art.body} strokeWidth={1.6} />
        <path d={art.tip} fill="currentColor" strokeWidth={1.2} />
        <path d="M32 18 L42 28" strokeWidth={1.2} opacity={0.6} />
      </svg>
    </button>
  )
}
