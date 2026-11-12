// Every icon/illustration and the handwriting font are fetched and decoded once at startup.
// Without this each screen fetched its own images the first time it opened (and the font swapped in late),
// so icons and text popped in a moment after every screen change.
const urls = Object.values(
  // big drawings no screen uses yet are left out (they'd only slow the start)
  import.meta.glob(['../assets/**/*.{svg,png}', '!**/v2/guide.svg', '!**/v2/size-bubble-hl.svg'], { eager: true, query: '?url', import: 'default' }),
) as string[]

// kept referenced so the decoded images stay in memory
const keep: HTMLImageElement[] = []

export function preloadAssets(timeout = 4000): Promise<unknown> {
  const font = document.fonts?.load('20px "Griun Myoeun Heullim"', '가A').catch(() => {}) ?? Promise.resolve()
  const images = urls.map((src) => {
    const img = new Image()
    img.src = src
    keep.push(img)
    return img.decode().catch(() => {})
  })
  // slow network: don't hold the app forever, the rest keeps loading in the background
  return Promise.race([Promise.all([font, ...images]), new Promise((r) => setTimeout(r, timeout))])
}
