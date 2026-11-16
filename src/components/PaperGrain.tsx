// Watercolor-paper look drawn by code (no image): fractal noise as a height map, lit from the upper left,
// squeezed into a narrow light-grey band. It is an SVG filter, so it is computed at the size it shows —
// zooming the paper keeps it sharp, unlike a photo. Tuned to match the watercolor photo
// (assets/paper/watercolor.avif): mean #f3f3f3, very low contrast.
export function PaperGrain() {
  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 block size-full">
      <filter id="paper-grain" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves={4} seed={7} result="bumps" />
        <feDiffuseLighting in="bumps" surfaceScale={2} diffuseConstant={1} lightingColor="#fff" result="lit">
          <feDistantLight azimuth={235} elevation={55} />
        </feDiffuseLighting>
        <feComponentTransfer in="lit">
          <feFuncR type="linear" slope={0.1073} intercept={0.8667} />
          <feFuncG type="linear" slope={0.1073} intercept={0.8667} />
          <feFuncB type="linear" slope={0.1073} intercept={0.8667} />
        </feComponentTransfer>
      </filter>
      <rect width="100%" height="100%" filter="url(#paper-grain)" />
    </svg>
  )
}
