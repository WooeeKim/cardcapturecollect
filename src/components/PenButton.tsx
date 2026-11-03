import type { ReactNode } from 'react'
import SketchBorder from './SketchBorder'

// Figma 나은 섹션 "Button": Primary = 연필로 칠한 알약, Ghost = 선만
export default function PenButton({
  children,
  onClick,
  ghost = false,
  small = false,
  disabled = false,
}: {
  children: ReactNode
  onClick: () => void
  ghost?: boolean
  small?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`relative rounded-[24px] font-pen leading-none transition-transform ease-spring active:scale-95 disabled:opacity-40 ${small ? 'px-[16px] py-[8px] text-[20px]' : 'px-[26px] py-[10px] text-[24px]'} ${ghost ? 'text-pencil' : 'bg-pencil text-card'}`}
    >
      {children}
      <SketchBorder w={180} h={44} r={22} seed={ghost ? 111 : 101} weight={1.4} double={ghost} />
    </button>
  )
}
