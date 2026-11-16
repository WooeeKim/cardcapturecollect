import { useEffect, useState, useSyncExternalStore } from 'react'
import { useLang, type Lang } from '../lib/i18n'

// Loading cover (Figma "mypage-logout" 1011:3764): grey shade over the screen, a hand-drawn ring whose white
// tail spins clockwise, and a silly line underneath that changes every 10 s. App start keeps the Splash instead.
// Any wait in the app: `await waiting(promise)` — the cover shows while at least one is running.

const LINES: Record<Lang, string[]> = {
  ko: ['주변을 관찰해봐요!', '감기 조심하세요 *^-^*', '연필 깎는 중...', '지우개똥 치우는 중...', '종이를 카드 크기로 재단하는 중...', '물감 배달 기다리는 중...', '스트레칭 한 번 어때요?'],
  en: [
    'Take a look around you!',
    "Don't catch a cold *^-^*",
    'Sharpening pencils...',
    'Sweeping up eraser crumbs...',
    'Cutting paper to card size...',
    'Waiting for the paint delivery...',
    'How about a little stretch?',
  ],
  ja: [
    'まわりを観察してみて！',
    '風邪に気をつけてね *^-^*',
    '鉛筆けずり中...',
    '消しカスおそうじ中...',
    '紙をカードの大きさに切ってるところ...',
    '絵の具の配達を待ってるところ...',
    'ちょっとストレッチしませんか？',
  ],
}

let count = 0
const listeners = new Set<() => void>()
const bump = (d: number) => {
  count += d
  listeners.forEach((f) => f())
}

export async function waiting<T>(p: Promise<T>): Promise<T> {
  bump(1)
  try {
    return await p
  } finally {
    bump(-1)
  }
}

const pick = (n: number, not = -1) => {
  const i = Math.floor(Math.random() * (n - 1))
  return not < 0 ? Math.floor(Math.random() * n) : i >= not ? i + 1 : i
}

// mounted once in App
export function LoadingLayer() {
  const busy = useSyncExternalStore(
    (f) => (listeners.add(f), () => listeners.delete(f)),
    () => count > 0,
  )
  return busy ? <Loading /> : null
}

function Loading() {
  const lines = LINES[useLang()]
  const [i, setI] = useState(() => pick(lines.length))
  useEffect(() => {
    const t = setInterval(() => setI((cur) => pick(lines.length, cur)), 10000)
    return () => clearInterval(t)
  }, [lines.length])

  return (
    // the short delay keeps quick waits from flashing the cover; it also swallows taps while waiting
    <div role="status" aria-live="polite" className="loading-cover absolute inset-0 z-[95] bg-black/30 font-hand">
      <svg
        aria-hidden
        viewBox="0 0 62.563 58.9728"
        className="absolute left-[calc(50%+0.28px)] top-[calc(50%-24.51px)] h-[58.97px] w-[62.56px] -translate-x-1/2 -translate-y-1/2"
        fill="none"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <defs>
          <linearGradient id="loading-tail" gradientUnits="userSpaceOnUse" x1="4" y1="31" x2="29.4" y2="4">
            <stop offset="0.1" stopColor="#777" />
            <stop offset="0.85" stopColor="#fff" />
          </linearGradient>
        </defs>
        <path
          stroke="#777"
          d="M37.8031 54.9728C32.6839 54.9728 21.0686 54.7278 17.1927 53.2792C11.9756 51.3294 7.23856 47.0356 5.05587 43.825C3.54508 41.6027 4.27173 38.2595 4.06992 33.6737C3.78321 27.1585 4.42393 21.903 5.15964 19.939C7.00344 15.0169 13.3707 9.94263 17.057 6.92238C19.6543 4.7943 23.3067 4.12905 36.8519 4.0007C41.9175 3.95269 46.3766 6.37838 49.3942 8.19059C51.6475 9.54383 54.2983 15.1123 56.613 20.053C58.4743 24.0259 58.5268 27.1659 58.5629 36.3717C58.578 40.1977 56.3218 43.775 54.414 46.6926C52.7155 49.2903 48.5359 51.151 46.1164 52.6188C44.9061 53.0997 44.0516 53.9827 42.7505 54.1641C42.0286 54.226 39.2325 54.8162 37.8031 54.9728Z"
        />
        <path
          className="loading-spin"
          stroke="url(#loading-tail)"
          d="M4 31.0775C4 31.0646 4 29.473 4.07089 26.7519C4.11746 24.9644 5.0657 22.4244 6.0761 19.4519C6.71671 17.5672 7.42201 16.2407 8.44578 14.6056C9.15355 13.4752 9.76829 12.4683 11.0033 10.6102C11.6577 9.62573 12.3299 9.13257 13.0614 8.48337C13.8219 7.80828 14.7623 7.62018 15.5941 7.33221C16.9777 6.85326 18.9353 5.91477 19.9135 5.63019C20.96 5.32576 22.5169 4.89322 23.7118 4.57439C24.692 4.43659 26.1711 4.41017 27.8548 4.35401C28.5064 4.31491 28.7462 4.25427 29.4277 4.00109"
        />
      </svg>
      {/* hand-drawn bubble (Figma 1011:4659) behind the line so it reads on the shade; it stretches to the text */}
      <div key={i} className="animate-fade-in absolute top-[calc(50%+22px)] left-1/2 w-max max-w-[362px] -translate-x-1/2 px-[34px] py-[19px]">
        <svg aria-hidden viewBox="0 0 301 70" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
          <path
            vectorEffect="non-scaling-stroke"
            fill="#D9D9D9"
            stroke="black"
            strokeWidth="2"
            strokeLinejoin="round"
            d="M170.121 67.5296C196.063 67.5599 196.137 67.5599 196.211 67.5599C204.804 68.1632 234.388 69.8353 241.839 68.4892C250.209 67.4714 258.779 65.8773 263.761 65.0263C268.313 64.2487 276.347 63.4742 284.641 59.0154C289.334 56.4921 299.627 51.4488 299.909 42.4439C300.142 35.0049 300.006 28.4768 298.551 25.4475C297.459 23.1735 296.2 21.3148 294.324 20.2081C292.454 19.1046 283.675 16.3707 270.628 14.135C256.64 11.7379 247.043 10.421 240.098 9.2408C237.14 8.73816 220.1 7.86156 196.477 6.17074C186.418 5.45074 175.587 2.10103 149.049 1.23964C131.615 0.673754 106.527 1.25401 93.3711 1.50956C79.0287 1.78816 75.0246 1.71947 62.4228 4.8676C58.325 5.8913 41.6244 8.07342 19.1007 14.1206C9.28651 16.7556 6.15737 17.9022 4.8445 19.8798C2.4522 23.4833 -1.38736 34.2715 3.01098 41.3778C5.66879 45.672 8.59834 50.5371 22.7269 59.9961C27.7585 63.3647 32.7445 66.3466 64.1277 66.9214C92.3712 67.4387 144.179 67.4993 170.121 67.5296Z"
          />
        </svg>
        <p className="relative text-center text-[24px] leading-[1.25] text-black">{lines[i]}</p>
      </div>
    </div>
  )
}
