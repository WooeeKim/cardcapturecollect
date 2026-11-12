// Every icon/illustration and the handwriting font are fetched and decoded once at startup.
// Without this each screen fetched its own images the first time it opened (and the font swapped in late),
// so icons and text popped in a moment after every screen change.
const urls = Object.values(
  // big drawings no screen uses yet are left out (they'd only slow the start)
  import.meta.glob(['../assets/**/*.{svg,png}', '!**/v2/guide.svg', '!**/v2/size-bubble-hl.svg'], { eager: true, query: '?url', import: 'default' }),
) as string[]

// Load (download) is what matters; decode() can stall in a background tab, so it only gets a short head start.
export function loadImage(img: HTMLImageElement, src: string): Promise<void> {
  return new Promise<void>((resolve) => {
    img.onload = img.onerror = () => resolve()
    img.src = src
    if (img.complete) resolve()
  }).then(() => Promise.race([img.decode().catch(() => {}), new Promise((r) => setTimeout(r, 800))]).then(() => {}))
}

// kept referenced so the decoded images stay in memory
const keep: HTMLImageElement[] = []

// Waits until the handwriting font and every image are really ready, so the first screen shows complete.
// The safety cap is long (a very slow / broken network shouldn't trap the user on the splash forever).
export function preloadAssets(timeout = 30000): Promise<unknown> {
  const font = (document.fonts?.load('20px "Griun Myoeun Heullim"', '가A').catch(() => {}) ?? Promise.resolve()).then(() => document.fonts?.ready)
  const images = urls.map((src) => {
    const img = new Image()
    keep.push(img)
    return loadImage(img, src)
  })
  // slow network: don't hold the app forever, the rest keeps loading in the background
  return Promise.race([Promise.all([font, ...images]), new Promise((r) => setTimeout(r, timeout))])
}
