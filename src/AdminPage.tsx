import { useEffect, useState } from 'react'
import { CardView } from './components/ui'
import { currentUser, logIn, logOut, supabase, type User } from './lib/auth'
import type { State } from './lib/store'

// Card gallery for the team: open <site>/#/admin and log in with an admin email
// (supabase/migrations/005_admin_gallery.sql). Reads every tester's saved towns + cards.
type Row = { user_id: string; email: string | null; state: State; updated_at: string }

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')

  async function load() {
    setError('')
    const { data, error } = await supabase!.from('user_states').select('user_id, email, state, updated_at').order('updated_at', { ascending: false })
    if (error) return setError(error.message)
    setRows(data as Row[])
  }

  useEffect(() => {
    if (!supabase) return
    currentUser().then((u) => {
      setUser(u)
      if (u) load()
    })
  }, [])

  if (!supabase) return <p className="p-8">No Supabase key: the gallery reads cards from Supabase.</p>

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
        <h1 className="text-2xl">Card gallery</h1>
        <input className="rounded border px-3 py-2" type="email" placeholder="Admin email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="rounded border px-3 py-2" type="password" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} />
        <button className="rounded bg-black py-2 text-white">Log in</button>
        <p className="text-red-700">{error}</p>
      </form>
    )

  const testers = (rows ?? []).filter((r) => r.user_id !== user.id || Object.keys(r.state.cards).length)
  const total = testers.reduce((n, r) => n + Object.keys(r.state.cards).length, 0)

  return (
    <div className="mx-auto max-w-6xl p-6">
      <header className="mb-6 flex items-baseline gap-4">
        <h1 className="text-3xl">Card gallery</h1>
        <span className="text-neutral-500">
          {testers.length} testers · {total} cards
        </span>
        <span className="flex-1" />
        <button className="underline" onClick={load}>
          Refresh
        </button>
        <button className="underline" onClick={() => logOut().then(() => setUser(null))}>
          Log out ({user.username})
        </button>
      </header>
      {error && <p className="mb-4 text-red-700">{error}</p>}
      {rows && testers.length <= 1 && rows.length <= 1 && (
        <p className="mb-4 text-neutral-500">Only your own row is visible? Add your email to app_admins (see 005_admin_gallery.sql).</p>
      )}
      {testers.map((r) => (
        <section key={r.user_id} className="mb-10">
          <h2 className="mb-1 text-xl">
            {r.state.nickname ? `${r.state.nickname} · ` : ''}
            {r.email ?? r.user_id}
          </h2>
          <p className="mb-3 text-sm text-neutral-500">last saved {new Date(r.updated_at).toLocaleString()}</p>
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
                        {c.serial} · {new Date(c.createdAt).toLocaleString()}
                      </figcaption>
                    </figure>
                  ) : null
                })}
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}
