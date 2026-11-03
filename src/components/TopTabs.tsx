import { useState, type CSSProperties } from 'react'

export type Tab = 'deco' | 'canvas' | 'book'

// 탭은 순환한다: Subway Deco → Canvas → Sticker Book → (Subway Deco)
// 현재 탭이 가운데, 이전 탭이 왼쪽, 다음 탭이 오른쪽.
const ORDER: Tab[] = ['deco', 'canvas', 'book']
const LABEL: Record<Tab, string> = { deco: 'Subway Deco', canvas: 'Canvas', book: 'Sticker Book' }

export default function TopTabs({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  const i = ORDER.indexOf(tab)
  const prev = ORDER[(i + 2) % 3]
  const next = ORDER[(i + 1) % 3]

  // 어느 쪽으로 넘어왔는지: 오른쪽(다음) 탭으로 가면 1, 왼쪽(이전)이면 -1. 첫 화면은 0이라 움직이지 않는다.
  const [last, setLast] = useState(tab)
  const [dir, setDir] = useState(0)
  if (tab !== last) {
    setLast(tab)
    setDir(ORDER[(ORDER.indexOf(last) + 1) % 3] === tab ? 1 : -1)
  }

  return (
    <nav
      key={tab}
      className={`flex items-end justify-center gap-[15px] leading-normal ${dir ? 'animate-tab-slide' : ''}`}
      style={{ '--dir': dir } as CSSProperties}
    >
      <button
        onClick={() => onChange(prev)}
        className="w-[110px] text-right text-[17px] font-medium text-muted transition-transform active:scale-90"
      >
        {LABEL[prev]}
      </button>
      <span className="relative text-center text-[22px] font-semibold whitespace-nowrap text-ink">
        {LABEL[tab]}
        {/* 밑줄: 지나온 탭 쪽에서 늘어난 채 미끄러져 와서 스프링으로 자리 잡는다 */}
        <span className={`absolute inset-x-0 bottom-[4px] h-[2px] bg-ink ${dir ? 'animate-underline-stretch' : ''}`} />
      </span>
      <button
        onClick={() => onChange(next)}
        className="w-[110px] text-left text-[17px] font-medium text-muted transition-transform active:scale-90"
      >
        {LABEL[next]}
      </button>
    </nav>
  )
}
