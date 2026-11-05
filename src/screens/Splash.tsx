import GridBackground from '../components/GridBackground'

// Figma: 00 인트로(132:313) — 노선 띠 위의 역명판
export default function Splash({ onStart }: { onStart: () => void }) {
  return (
    <button onClick={onStart} aria-label="Start" className="relative block h-full w-full overflow-hidden">
      <GridBackground lineColor="var(--color-grid-intro)" />
      <div className="absolute top-[calc(50%-14px)] left-0 h-[44px] w-full -translate-y-1/2 bg-line shadow-band" />
      <div className="absolute top-[calc(50%-20.5px)] left-[calc(50%-0.5px)] flex h-[87px] -translate-1/2 items-center gap-[10px] overflow-hidden rounded-full border-7 border-line bg-white py-[7px] pr-[20px] pl-[7px] shadow-sign">
        <div className="flex aspect-square h-full items-center justify-center rounded-full bg-line">
          <span className="text-[23px] leading-normal font-semibold tracking-[-0.46px] text-white">001</span>
        </div>
        <div className="flex w-[149px] flex-col items-center justify-center gap-[3px] leading-normal font-semibold">
          <span className="text-[23px] whitespace-nowrap text-black">Subway Seal</span>
          <span className="text-[11px] whitespace-pre text-[#333]">{'Card   Capture   Collect'}</span>
        </div>
      </div>
    </button>
  )
}
