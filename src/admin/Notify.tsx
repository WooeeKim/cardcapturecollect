import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/auth'
import { when, type Row } from './data'

// Send a push notification to the phones that allowed it (push_subscriptions, supabase/migrations/010_push.sql).
// One line per phone/browser; pick who gets it, write it, send via api/push.js.
type Sub = { endpoint: string; device_id: string; user_id: string | null; email: string | null; updated_at: string }

export function Notify({ rows }: { rows: Row[] }) {
  const [subs, setSubs] = useState<Sub[] | null>(null)
  const [error, setError] = useState('')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState('')
  const [filter, setFilter] = useState('')

  async function load() {
    const { data, error } = await supabase!.from('push_subscriptions').select('endpoint, device_id, user_id, email, updated_at').order('updated_at', { ascending: false })
    if (error) return setError(`${error.message} — run supabase/migrations/010_push.sql`)
    setError('')
    setSubs(data as Sub[])
    setPicked((p) => new Set([...p].filter((e) => data.some((s) => s.endpoint === e))))
  }
  useEffect(() => {
    load()
  }, [])

  const nick = (s: Sub) => (s.user_id ? rows.find((r) => r.user_id === s.user_id)?.state.nickname : undefined)
  const label = (s: Sub) => nick(s) || s.email || `guest · ${s.device_id.slice(0, 8)}`
  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return (subs ?? []).filter((s) => !q || `${label(s)} ${s.email ?? ''}`.toLowerCase().includes(q))
  }, [subs, filter, rows])
  const allShown = shown.length > 0 && shown.every((s) => picked.has(s.endpoint))
  const toggle = (e: string) =>
    setPicked((p) => {
      const n = new Set(p)
      if (!n.delete(e)) n.add(e)
      return n
    })
  const toggleAll = () =>
    setPicked((p) => {
      const n = new Set(p)
      for (const s of shown) if (allShown) n.delete(s.endpoint)
      else n.add(s.endpoint)
      return n
    })

  async function send() {
    if (!title.trim() || !picked.size) return
    if (!confirm(`Send “${title.trim()}” to ${picked.size} phone(s)? This can't be taken back.`)) return
    setSending(true)
    setResult('')
    try {
      const { data } = await supabase!.auth.getSession()
      const res = await fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` },
        body: JSON.stringify({ title, body, endpoints: [...picked] }),
      })
      if (res.status === 404) throw new Error('/api/push not found — it runs on Vercel (deploy, or `npx vercel dev` locally)')
      const out = await res.json()
      if (!res.ok) throw new Error(out.error)
      setResult(`Sent ${out.sent}` + (out.gone ? ` · ${out.gone} expired (removed)` : '') + (out.failed.length ? ` · ${out.failed.length} failed: ${out.failed.join('; ')}` : ''))
      if (out.gone) load()
    } catch (e) {
      setResult(`Error: ${(e as Error).message}`)
    }
    setSending(false)
  }

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_340px]">
      <section>
        <div className="mb-2 flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={allShown} onChange={toggleAll} disabled={!shown.length} />
            All{filter && ' shown'} ({shown.length})
          </label>
          <input className="rounded border px-2 py-1" placeholder="Filter by name / email" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <span className="text-neutral-500">{picked.size} picked</span>
          <span className="flex-1" />
          <button className="underline" onClick={load}>
            Refresh
          </button>
        </div>
        {!import.meta.env.VITE_VAPID_PUBLIC_KEY && (
          <p className="mb-2 text-red-700">Push is off: VITE_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are not set in Vercel → Settings → Environment Variables (then redeploy). Until then no phone can subscribe.</p>
        )}
        {error && <p className="mb-2 text-red-700">{error}</p>}
        <table className="w-full text-left text-sm">
          <thead className="text-neutral-500">
            <tr className="border-b">
              <th className="w-8 py-2" />
              <th className="py-2 pr-3 font-normal">Who</th>
              <th className="py-2 pr-3 font-normal">Phone</th>
              <th className="py-2 pr-3 font-normal">Subscribed</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((s) => (
              <tr key={s.endpoint} className="cursor-pointer border-b hover:bg-neutral-50" onClick={() => toggle(s.endpoint)}>
                <td className="py-2">
                  <input type="checkbox" checked={picked.has(s.endpoint)} readOnly />
                </td>
                <td className="py-2 pr-3">
                  <div>{label(s)}</div>
                  {s.email && nick(s) && <div className="text-xs text-neutral-500">{s.email}</div>}
                </td>
                <td className="py-2 pr-3 text-neutral-500">{new URL(s.endpoint).host}</td>
                <td className="py-2 pr-3 whitespace-nowrap text-neutral-500">{when(s.updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {subs && !subs.length && <p className="mt-4 text-neutral-500">No one has allowed notifications yet (only phones that tapped Allow show up here).</p>}
      </section>

      <form
        className="flex flex-col gap-3 self-start rounded border p-4"
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
      >
        <h2 className="text-lg">Message</h2>
        <input className="rounded border px-3 py-2" placeholder="Title" maxLength={60} value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea className="min-h-24 rounded border px-3 py-2" placeholder="Body (optional)" maxLength={200} value={body} onChange={(e) => setBody(e.target.value)} />
        <button className="rounded bg-black py-2 text-white disabled:opacity-40" disabled={sending || !title.trim() || !picked.size}>
          {sending ? 'Sending…' : `Send to ${picked.size}`}
        </button>
        {result && <p className={result.startsWith('Error') ? 'text-red-700' : 'text-green-700'}>{result}</p>}
      </form>
    </div>
  )
}
