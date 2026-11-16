// Watercolor-paper look drawn by code (no image): fractal noise as a height map, lit from the upper left,
// squeezed into a narrow light-grey band. It is an SVG filter, so it is computed at the size it shows —
// zooming the paper keeps it sharp, unlike a photo. Shown as "paper" in the admin canvas dropdown (DrawScreen).
//
// `grain` = how visible the texture is: the brightness spread (std. dev., 0–255 levels) around an average of
// #f3f3f3. 2.2 matches a watercolor-paper photo; lower = fainter. The lit noise measures mean ≈205, sd ≈20.7
// before the squeeze, so slope = grain / 20.7 and the intercept keeps the average at 243.
export function PaperGrain({ grain = 2.2 }: { grain?: number }) {
  const slope = grain / 20.7
  const intercept = (243 - slope * 205) / 255
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
