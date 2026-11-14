import { useEffect, useState } from 'react'
import { CardView } from './components/ui'
import { currentUser, logIn, logOut, supabase, type User } from './lib/auth'
import { QUESTIONS, TYPES, type Answers, type TypeId } from './lib/gilbti'
import type { State } from './lib/store'

// Team admin: open <site>/admin and log in with an email listed in app_admins
// (supabase/migrations/005_admin_gallery.sql, 007_gilbti.sql). Two tabs:
// - Cards: every tester's saved towns + cards (user_states)
// - Subway-TI: every 길BTI answer (gilbti_responses), guests included
type Row = { user_id: string; email: string | null; state: State; updated_at: string }
type Gil = {
  id: string
  device_id: string
  user_id: string | null
  email: string | null
  nickname: string | null
  type: TypeId
  observe: number
  record: number
  answers: Answers
  created_at: string
}

const TYPE_ORDER: TypeId[] = ['both', 'record', 'observe', 'neither']
const when = (iso: string) => new Date(iso).toLocaleString()
const show = (a: Answers[string] | undefined) => (a === undefined || a === '' ? '—' : Array.isArray(a) ? a.join(', ') || '—' : String(a))

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null)
  const [tab, setTab] = useState<'cards' | 'gilbti'>(() => (location.hash === '#gilbti' ? 'gilbti' : 'cards'))
  const [rows, setRows] = useState<Row[] | null>(null)
  const [gil, setGil] = useState<Gil[] | null>(null)
  const [error, setError] = useState('')
  const [gilError, setGilError] = useState('')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [allAnswers, setAllAnswers] = useState(false)

  async function load() {
    setError('')
    setGilError('')
    const [cards, answers] = await Promise.all([
      supabase!.from('user_states').select('user_id, email, state, updated_at').order('updated_at', { ascending: false }),
      supabase!.from('gilbti_responses').select('*').order('created_at', { ascending: false }),
    ])
    if (cards.error) setError(cards.error.message)
    else setRows(cards.data as Row[])
    if (answers.error) setGilError(`${answers.error.message} — run supabase/migrations/007_gilbti.sql`)
    else setGil(answers.data as Gil[])
  }

  useEffect(() => {
    if (!supabase) return
    currentUser().then((u) => {
      setUser(u)
      if (u) load()
    })
  }, [])

  const pick = (t: 'cards' | 'gilbti') => {
    setTab(t)
    history.replaceState(null, '', t === 'gilbti' ? '#gilbti' : location.pathname)
  }

  if (!supabase) return <p className="p-8">No Supabase key: the admin reads everything from Supabase.</p>

  if (!user)
    return (
      <form
        className="mx-auto mt-24 flex max-w-xs flex-col gap-3 p-4"
        onSubmit={async (e) => {
          e.preventDefault()
          const res = await logIn(email, pw)
          if (!res.ok) return setError(res.error)
          setUser(res.user)
          load()
        }}
      >
        <h1 className="text-2xl">Admin</h1>
        <input className="rounded border px-3 py-2" type="email" placeholder="Admin email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="rounded border px-3 py-2" type="password" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} />
        <button className="rounded bg-black py-2 text-white">Log in</button>
        <p className="text-red-700">{error}</p>
      </form>
    )

  const testers = (rows ?? []).filter((r) => r.user_id !== user.id || Object.keys(r.state.cards).length)
  const total = testers.reduce((n, r) => n + Object.keys(r.state.cards).length, 0)
  const notAdmin = rows && rows.length <= 1 && (gil ?? []).length === 0

  // one row per person (account, or device for guests): their latest answers
  const latest: Gil[] = []
  const seen = new Set<string>()
  for (const g of gil ?? []) {
    const who = g.user_id ?? `device:${g.device_id}`
    if (seen.has(who)) continue
    seen.add(who)
    latest.push(g)
  }
  const shown = allAnswers ? (gil ?? []) : latest
  const count = (t: TypeId) => latest.filter((g) => g.type === t).length
  // what the account's cards say next to the answers (user_states by account)
  const cardsOf = (g: Gil) => {
    const r = g.user_id ? rows?.find((x) => x.user_id === g.user_id) : undefined
    return r ? Object.keys(r.state.cards).length : null
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <header className="mb-4 flex flex-wrap items-baseline gap-4">
        <h1 className="text-3xl">Admin</h1>
        <nav className="flex gap-1">
          {(
            [
              ['cards', `Cards (${testers.length})`],
              ['gilbti', `Subway-TI (${latest.length})`],
            ] as const
          ).map(([id, label]) => (
            <button key={id} onClick={() => pick(id)} className={`rounded-full px-3 py-1 ${tab === id ? 'bg-black text-white' : 'bg-neutral-100'}`}>
              {label}
            </button>
          ))}
        </nav>
        <span className="flex-1" />
        <button className="underline" onClick={load}>
          Refresh
        </button>
        <button className="underline" onClick={() => logOut().then(() => setUser(null))}>
          Log out ({user.username})
        </button>
      </header>
      {notAdmin && <p className="mb-4 text-neutral-500">Only your own data is visible? Add your email to app_admins (see 007_gilbti.sql).</p>}

      {tab === 'cards' && (
        <>
          <p className="mb-6 text-neutral-500">
            {testers.length} testers · {total} cards
          </p>
          {error && <p className="mb-4 text-red-700">{error}</p>}
          {testers.map((r) => (
            <section key={r.user_id} className="mb-10">
              <h2 className="mb-1 text-xl">
                {r.state.nickname ? `${r.state.nickname} · ` : ''}
                {r.email ?? r.user_id}
              </h2>
              <p className="mb-3 text-sm text-neutral-500">last saved {when(r.updated_at)}</p>
              {r.state.towns.map((t) => (
                <div key={t.id} className="mb-4">
                  <h3 className="mb-2 text-neutral-600">
                    {t.name} · {t.residents.length}
                  </h3>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
                    {t.residents.map((id) => {
                      const c = r.state.cards[id]
                      return c ? (
                        <figure key={id}>
                          <CardView card={c} />
                          <figcaption className="mt-1 text-xs text-neutral-500">
                            {c.serial} · {when(c.createdAt)}
                          </figcaption>
                        </figure>
                      ) : null
                    })}
                  </div>
                </div>
              ))}
            </section>
          ))}
        </>
      )}

      {tab === 'gilbti' && (
        <>
          {gilError && <p className="mb-4 text-red-700">{gilError}</p>}
          {/* the 2×2 from the pre-interview slide, one count per person */}
          <div className="mb-6 grid max-w-md grid-cols-[110px_1fr_1fr] gap-1 text-sm">
            <span />
            <span className="text-center text-neutral-500">Likes observing</span>
            <span className="text-center text-neutral-500">Not into observing</span>
            {TYPE_ORDER.map((t, i) => (
              <div key={t} className="contents">
                {i % 2 === 0 && <span className="self-center text-right text-neutral-500">{i === 0 ? 'Likes recording' : 'Not into recording'}</span>}
                <div className="rounded bg-neutral-100 p-3 text-center">
                  <div className="text-2xl">{count(t)}</div>
                  <div className="text-neutral-600">{TYPES[t].name}</div>
                </div>
              </div>
            ))}
          </div>

          <label className="mb-3 flex items-center gap-2 text-sm text-neutral-600">
            <input type="checkbox" checked={allAnswers} onChange={(e) => setAllAnswers(e.target.checked)} />
            Show retakes too ({(gil ?? []).length} answers in all; otherwise each person's latest)
          </label>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-neutral-500">
                <tr className="border-b">
                  <th className="py-2 pr-3 font-normal">When</th>
                  <th className="py-2 pr-3 font-normal">Who</th>
                  <th className="py-2 pr-3 font-normal">Type</th>
                  <th className="py-2 pr-3 font-normal">Obs / Rec</th>
                  <th className="py-2 pr-3 font-normal">Cards</th>
                  {QUESTIONS.filter((q) => q.id !== 'name' && q.kind !== 'scale').map((q) => (
                    <th key={q.id} className="min-w-[140px] py-2 pr-3 font-normal">
                      {q.prompt}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((g) => (
                  <tr key={g.id} className="border-b align-top">
                    <td className="py-2 pr-3 whitespace-nowrap text-neutral-500">{when(g.created_at)}</td>
                    <td className="py-2 pr-3">
                      <div>{g.nickname ?? '—'}</div>
                      <div className="text-xs text-neutral-500">{g.email ?? `guest · ${g.device_id.slice(0, 8)}`}</div>
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">{TYPES[g.type].name}</td>
                    <td className="py-2 pr-3">
                      {g.observe} / {g.record}
                    </td>
                    <td className="py-2 pr-3">{cardsOf(g) ?? '—'}</td>
                    {QUESTIONS.filter((q) => q.id !== 'name' && q.kind !== 'scale').map((q) => (
                      <td key={q.id} className="py-2 pr-3">
                        {show(g.answers[q.id])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {gil && shown.length === 0 && <p className="mt-4 text-neutral-500">No answers yet.</p>}
          </div>
        </>
      )}
    </div>
  )
}
