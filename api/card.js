// GET /c/<id> → this function (vercel.json rewrite): a shared card's public page.
// Reads card_shares (supabase/migrations/015_card_shares.sql) with the public anon key, so only what the
// owner chose to share is shown. Messengers (KakaoTalk, iMessage, Instagram…) show the og:image preview.
// Env: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (already set for the app).

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

export function page({ title, description, image, url, body }) {
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="card capture collect" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
${image ? `<meta property="og:image" content="${esc(image)}" />\n<meta name="twitter:card" content="summary_large_image" />\n<meta name="twitter:image" content="${esc(image)}" />` : ''}
<meta property="og:url" content="${esc(url)}" />
<link rel="icon" href="/icons/icon-192.png" />
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
<style>
  @font-face { font-family: "Griun Myoeun Heullim"; src: url("/fonts/Griun_MyoeunHeullim-Rg.woff2") format("woff2"); font-display: swap; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; background: #f0f0f0; color: #000; font-family: "Griun Myoeun Heullim", -apple-system, sans-serif;
         display: flex; flex-direction: column; align-items: center; padding: 28px 16px 40px; }
  .card { width: 100%; max-width: 420px; height: auto; display: block; border-radius: 14px; }
  .line { margin: 18px 0 0; font-size: 19px; text-align: center; color: #555; }
  .cta { margin-top: 16px; display: inline-block; padding: 12px 28px; border: 2.5px solid #000; border-radius: 999px; background: #fff;
         color: #000; text-decoration: none; font-size: 22px; transform: rotate(-1.5deg); }
  .missing { margin-top: 30vh; font-size: 24px; text-align: center; }
</style>
</head>
<body>
${body}
</body>
</html>`
}

export default async function handler(req, res) {
  const id = String(req.query.id || '')
  const origin = `https://${req.headers.host}`
  const url = `${origin}/c/${id}`
  const env = process.env
  res.setHeader('Content-Type', 'text/html; charset=utf-8')

  const missing = (status) => {
    res.status(status).send(
      page({
        title: 'card capture collect',
        description: '지하철에서 눈에 띈 사람을 카드로 수집해요.',
        url: origin,
        body: `<p class="missing">이 카드를 찾을 수 없어요.</p><a class="cta" href="/">card capture collect 열기</a>`,
      }),
    )
  }

  if (!/^[A-Za-z0-9]{10,32}$/.test(id) || !env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) return missing(404)

  const r = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/card_shares?id=eq.${id}&select=nickname,memo,mood,place,serial,by_name,image_path`, {
    headers: { apikey: env.VITE_SUPABASE_ANON_KEY, Authorization: `Bearer ${env.VITE_SUPABASE_ANON_KEY}` },
  }).catch(() => null)
  const row = r && r.ok ? (await r.json())[0] : null
  if (!row) return missing(404)

  const image = `${env.VITE_SUPABASE_URL}/storage/v1/object/public/card-shares/${row.image_path}`
  const name = row.nickname || '이름 없는 주민'
  const title = row.by_name ? `${name} by ${row.by_name} · card capture collect` : `${name} · card capture collect`
  const description = row.memo || (row.place ? `${row.place}에서 수집한 카드` : '지하철에서 수집한 카드')

  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400')
  res.status(200).send(
    page({
      title,
      description,
      image,
      url,
      body: `<img class="card" src="${esc(image)}" alt="${esc(name)}" />
<p class="line">지하철에서 수집한 카드예요</p>
<a class="cta" href="/">나도 수집하러 가기</a>`,
    }),
  )
}
