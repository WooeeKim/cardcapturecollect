import { PaperBackground, TopBar } from '../components/Paper'
import SketchBorder from '../components/SketchBorder'
import type { Sticker } from '../lib/stickers'

// 마을 번호별 사람 수와 대표 얼굴(가장 먼저 온 사람)
export function summarizeVillages(stickers: Sticker[]) {
  const map = new Map<number, { village: number; count: number; face: string }>()
  for (const s of stickers) {
    if (s.village == null) continue
    const v = map.get(s.village)
    if (v) v.count++
    else map.set(s.village, { village: s.village, count: 1, face: s.imageUrl })
  }
  return [...map.values()].sort((a, b) => a.village - b.village)
}

// Figma: 04 마을 | 이정표 선택. 세로 선로(이정표)를 따라 마을 카드가 놓이고, 하나를 고르면 그 마을에서 내린다.
export default function VillageSelectScreen({
  sticker,
  stickers,
  onPick,
  onBack,
}: {
  sticker: Sticker
  stickers: Sticker[]
  onPick: (village: number) => void
  onBack: () => void
}) {
  const villages = summarizeVillages(stickers.filter((s) => s.id !== sticker.id))
  const next = (villages.at(-1)?.village ?? 0) + 1
  // 아직 마을이 없으면 첫 마을을 만들 수 있게 "새 마을"만 보인다
  return (
    <div className="absolute inset-0 z-30 overflow-hidden text-pencil">
      <PaperBackground />
      <TopBar left="Back" title="Choose Village" right="" onLeft={onBack} />

      <p className="absolute inset-x-0 top-[calc(env(safe-area-inset-top)+96px)] text-center font-pen text-[22px] leading-none">
        Where will <span className="underline decoration-1 underline-offset-[6px]">{sticker.name || 'this person'}</span> get off?
      </p>

      <div className="absolute inset-x-0 top-[calc(env(safe-area-inset-top)+132px)] bottom-0 overflow-y-auto px-[32px] pb-[calc(env(safe-area-inset-bottom)+32px)]">
        {/* 이정표 선로 */}
        <div className="pointer-events-none absolute inset-y-0 left-1/2 w-[18px] -translate-x-1/2 bg-pencil" aria-hidden />
        <ul className="relative flex flex-col gap-[28px]">
          {villages.map(({ village, count, face }, i) => (
            <li key={village}>
              <button onClick={() => onPick(village)} className="relative flex w-full items-center gap-[14px] rounded-[10px] bg-card px-[12px] py-[12px] text-left transition-transform ease-spring active:scale-[0.98]">
                <span className="relative size-[62px] shrink-0 overflow-hidden rounded-full bg-wash">
                  <img src={face} alt="" draggable={false} className="size-full object-cover object-top" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-[4px]">
                  <span className="font-hand text-[20px] leading-none font-bold">Village {String(village).padStart(2, '0')}</span>
                  <span className="font-pen text-[17px] leading-none text-muted">{count} residents</span>
                </span>
                <span className="relative size-[24px] shrink-0 rounded-full border border-pencil/40" aria-hidden />
                <SketchBorder w={300} h={88} r={8} seed={1200 + i} weight={1.4} />
              </button>
            </li>
          ))}
          <li>
            <button onClick={() => onPick(next)} className="relative w-full rounded-[10px] bg-card py-[12px] font-pen text-[20px] leading-none transition-transform ease-spring active:scale-[0.98]">
              + New Village
              <SketchBorder w={300} h={44} r={8} seed={1300} weight={1.4} />
            </button>
          </li>
        </ul>
      </div>
    </div>
  )
}
