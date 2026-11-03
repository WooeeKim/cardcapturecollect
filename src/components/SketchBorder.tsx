import { useMemo } from 'react'
import { wobblyRect } from '../lib/sketch'

// 부모를 덮는 손그림 테두리. 겹선이면 연필로 두 번 그은 느낌(두 번째 선은 가늘고 흐리게).
// w/h 는 테두리 경로를 만들 기준 크기라 실제 크기와 비슷하면 된다 (늘어나도 선 굵기는 그대로).
export default function SketchBorder({
  w,
  h,
  r = 6,
  seed = 1,
  weight = 1.3,
  double = true,
  className = '',
}: {
  w: number
  h: number
  r?: number
  seed?: number
  weight?: number
  double?: boolean
  className?: string
}) {
  const [first, second] = useMemo(() => [wobblyRect(w, h, r, seed), wobblyRect(w, h, r, seed + 97)], [w, h, r, seed])
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className={`pointer-events-none absolute inset-0 size-full overflow-visible text-pencil ${className}`}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={first} strokeWidth={weight} vectorEffect="non-scaling-stroke" />
      {double && <path d={second} strokeWidth={weight * 0.6} opacity={0.45} vectorEffect="non-scaling-stroke" />}
    </svg>
  )
}
