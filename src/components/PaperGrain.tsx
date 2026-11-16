// Watercolor-paper look drawn by code (no image): fractal noise as a height map, lit from the upper left,
// squeezed into a narrow band just under white. It is an SVG filter, so it is computed at the size it shows —
// zooming the paper keeps it sharp, unlike a photo. Shown as "paper" in the admin canvas dropdown (DrawScreen).
//
// `grain` = how visible the texture is: the brightness spread (std. dev., 0–255 levels). 2.2 matches a
// watercolor-paper photo; lower = fainter. The paper stays about as bright as plain white: the average sits
// 2.5 spreads below 255, so only the brightest bumps touch pure white (grain 1.1 → avg 252, 3.5 → avg 246).
// The lit noise measures mean ≈205, sd ≈20.7 before the squeeze, so slope = grain / 20.7.
export function PaperGrain({ grain = 2.2 }: { grain?: number }) {
  const slope = grain / 20.7
  const average = 255 - 2.5 * grain
  const intercept = (average - slope * 205) / 255
  const id = `paper-grain-${grain}`
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 block size-full">
      <filter id={id} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves={4} seed={7} result="bumps" />
        <feDiffuseLighting in="bumps" surfaceScale={2} diffuseConstant={1} lightingColor="#fff" result="lit">
          <feDistantLight azimuth={235} elevation={55} />
        </feDiffuseLighting>
        <feComponentTransfer in="lit">
          <feFuncR type="linear" slope={slope} intercept={intercept} />
          <feFuncG type="linear" slope={slope} intercept={intercept} />
          <feFuncB type="linear" slope={slope} intercept={intercept} />
        </feComponentTransfer>
      </filter>
      <rect width="100%" height="100%" filter={`url(#${id})`} />
    </svg>
  )
}
