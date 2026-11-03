import { useEffect, useRef, useState } from 'react'
import backIcon from '../assets/figma/back.svg'
import subwayImage from '../assets/figma/subway.png'
import StickerCard from '../components/StickerCard'
import { LABELS } from '../lib/labels'
import { updateSticker, type Sticker } from '../lib/stickers'

// Figma 프레임 874×402 (가로). 화면을 돌리지 않고 세로 화면 높이에 맞춰 확대한 뒤 가로로 스크롤해서 본다.
const W = 874
const H = 402
// 라벨 깃발 크기와 간격(화면 px). 좁은 화면에서는 간격을 줄여 한 줄에 다 들어가게 한다.
const FLAG_W = 43
const FLAG_GAP = 63
// 뒤로 버튼이 차지하는 왼쪽 폭 (left 12 + 60 + 여백)
const BACK_SPACE = 84

// 화면 대신 앱 틀(#root) 크기를 잰다. PC 에서는 틀이 폰 비율로 고정돼 있다.
function useFrameSize(ref: React.RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = ref.current!
    const read = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    read()
    const observer = new ResizeObserver(read)
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref])
  return size
}

// Figma: 04 지하철 꾸미기(132:1320)
// 위 라벨로 스티커북(권)을 고르면 그 책에 붙인 스티커만 보인다.
// 아래 줄에서 스티커를 고르고 지하철 칸 아무 데나 탭하면 그 자리에 붙는다.
// 지하철 칸만 확대·스크롤되고, 뒤로·라벨·스티커 줄은 화면에 고정돼 원래 크기로 보인다.
export default function SubwayDecoScreen({
  stickers,
  label,
  onLabel,
  onChange,
  onBack,
}: {
  stickers: Sticker[]
  label: number
  onLabel: (id: number) => void
  onChange: () => void
  onBack: () => void
}) {
  const frame = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const { w: vw, h: vh } = useFrameSize(frame)
  const [selected, setSelected] = useState<string | null>(null)

  const scale = vh / H
  const flagGap = Math.min(FLAG_GAP, (vw - BACK_SPACE - FLAG_W - 12) / (LABELS.length - 1))
  const inBook = stickers.filter((s) => s.bookLabel === label && s.bookPage !== null)
  const placed = inBook.filter((s) => s.decoX !== null && s.decoY !== null)

  // 처음 들어오면 칸 가운데(분홍 좌석)부터 보이게
  const centered = useRef(false)
  useEffect(() => {
    const el = scroller.current
    if (!el || !vw || centered.current) return
    el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2
    centered.current = true
  }, [vw, vh])

  async function placeAt(e: React.MouseEvent<HTMLDivElement>) {
    if (!selected || e.target !== e.currentTarget) return
    // offsetX/Y 는 확대를 되돌린 프레임 좌표
    await updateSticker(selected, { decoX: e.nativeEvent.offsetX / W, decoY: e.nativeEvent.offsetY / H })
    setSelected(null)
    onChange()
  }

  return (
    <div ref={frame} className="fixed inset-0 overflow-clip bg-paper">
      {/* 지하철 칸: 높이에 맞춰 확대, 가로 스크롤 */}
      <div ref={scroller} className="absolute inset-0 overflow-x-auto overflow-y-hidden [scrollbar-width:none]">
        <div className="relative overflow-clip" style={{ width: W * scale, height: vh }}>
          <div
            className="absolute top-0 left-0 origin-top-left"
            style={{ width: W, height: H, transform: `scale(${scale})` }}
            onClick={placeAt}
          >
            <img
              src={subwayImage}
              alt=""
              draggable={false}
              className="pointer-events-none absolute max-w-none opacity-80"
              style={{ left: -7, top: -30, width: 889, height: 501 }}
            />

            {placed.map((s) => (
              <div
                key={s.id}
                className="pointer-events-none absolute w-[80.044px] -translate-1/2 shadow-[0_3px_3px_0_rgba(0,0,0,0.2)]"
                style={{ left: s.decoX! * W, top: s.decoY! * H }}
              >
                <StickerCard sticker={s} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 라벨 깃발 (Figma 에셋은 오른쪽을 향해 있어 90° 돌려 아래로 늘어뜨린다). 6번이 왼쪽, 오른쪽으로 갈수록 번호가 작아진다 */}
      {LABELS.map((l) => (
        <button
          key={l.id}
          onClick={() => {
            onLabel(l.id)
            setSelected(null)
          }}
          aria-label={`라벨 ${l.id}`}
          aria-pressed={l.id === label}
          className="absolute h-[70.5px] w-[43px] transition-[top]"
          style={{ left: BACK_SPACE + (LABELS.length - l.id) * flagGap, top: l.id === label ? 0 : -30 }}
        >
          <span className="absolute top-1/2 left-1/2 h-[43px] w-[70.5px] -translate-1/2 rotate-90">
            <span className="absolute inset-[-2.33%_-4.26%_-6.98%_-1.42%]">
              <img src={l.src} alt="" className="block size-full max-w-none" />
            </span>
          </span>
        </button>
      ))}

      {/* 뒤로 */}
      <button
        onClick={onBack}
        aria-label="뒤로"
        className="absolute top-[calc(env(safe-area-inset-top)+17px)] left-[12px] size-[60px]"
      >
        <span className="absolute inset-0 rounded-[50px] blur-[16.2px]">
          <span className="absolute inset-0 rounded-[50px] bg-[rgba(185,181,169,0.5)] backdrop-blur-[5.9px]" />
        </span>
        <span className="absolute top-[17px] left-[12.43px] h-[26.408px] w-[35.572px]">
          <span className="absolute top-1/2 left-1/2 h-[35.572px] w-[26.408px] -translate-1/2 rotate-90">
            <span className="absolute inset-[-2.81%_-3.79%]">
              <img src={backIcon} alt="" className="block size-full max-w-none" />
            </span>
          </span>
        </span>
      </button>

      {/* 스티커 줄 */}
      <div className="absolute inset-x-0 bottom-[env(safe-area-inset-bottom)] flex h-[120px] items-end gap-[7.143px] overflow-x-auto px-[16px] pb-[10px]">
        {inBook.length === 0 && (
          <p className="self-center text-[13px] font-semibold text-muted">이 라벨 스티커북에 붙인 스티커가 없어요</p>
        )}
        {inBook.map((s) => (
          <button
            key={s.id}
            onClick={() => setSelected(s.id === selected ? null : s.id)}
            aria-label="스티커 고르기"
            className="w-[80.044px] shrink-0 shadow-[0_3px_3px_0_rgba(0,0,0,0.2)] transition-transform"
            style={{ transform: s.id === selected ? 'translateY(-12px)' : undefined }}
          >
            <StickerCard sticker={s} />
          </button>
        ))}
      </div>
    </div>
  )
}
