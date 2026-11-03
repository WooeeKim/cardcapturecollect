import SketchBorder from './SketchBorder'

// Figma 나은 섹션 "Chip": 분위기·성격 고르기. 고르면 연한 칠 + 진한 겹선, 아니면 흐린 선 하나.
export default function Chip({ label, on, onClick, seed }: { label: string; on: boolean; onClick: () => void; seed: number }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`relative rounded-[16px] px-[14px] pt-[3px] pb-[4px] font-pen text-[21px] leading-[1.1] text-pencil transition-transform ease-spring active:scale-95 ${on ? 'bg-wash' : ''}`}
    >
      {label}
      <SketchBorder w={80} h={32} r={15} seed={seed} weight={on ? 1.5 : 1} double={on} className={on ? '' : 'opacity-45'} />
    </button>
  )
}
