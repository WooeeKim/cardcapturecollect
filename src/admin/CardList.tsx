import { useMemo, useState } from 'react'
import { moodOf } from '../lib/moods'
import { when, who, type Item } from './data'

type Sort = 'new' | 'old' | 'person'

// 목록: every drawing as a searchable table, with a CSV download.
export function CardList({ items, onViewAs }: { items: Item[]; onViewAs: (userId: string) => void }) {
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<Sort>('new')
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const hit = (i: Item) =>
      !needle ||
      [i.card.serial, i.card.mood, i.card.place, i.card.nickname, i.card.memo, i.town?.name, i.owner.email, i.owner.state.nickname]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle))
    const list = items.filter(hit)
    if (sort === 'old') return [...list].reverse()
    if (sort === 'person') return [...list].sort((a, b) => who(a.owner).localeCompare(who(b.owner)) || b.card.createdAt.localeCompare(a.card.createdAt))
    return list
  }, [items, q, sort])

  const csv = () => {
    const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const head = ['created_at', 'serial', 'person_nickname', 'person_email', 'town', 'sent', 'mood', 'place', 'card_name', 'memo']
    const lines = shown.map((i) =>
      [i.card.createdAt, i.card.serial, i.owner.state.nickname, i.owner.email, i.town?.name, !i.pending, i.card.mood, i.card.place, i.card.nickname, i.card.memo].map(cell).join(','),
    )
    const blob = new Blob(['﻿' + [head.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `subwayseal-cards-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <input className="w-64 rounded border px-3 py-1.5" placeholder="Search name, memo, place, email…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="rounded border px-2 py-1.5" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="new">Newest first</option>
          <option value="old">Oldest first</option>
          <option value="person">By person</option>
        </select>
        <span className="text-neutral-500">
          {shown.length} of {items.length}
        </span>
        <span className="flex-1" />
        <button className="underline" onClick={csv}>
          Download CSV
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-neutral-500">
            <tr className="border-b">
              {['', 'Made', 'Serial', 'Person', 'Town', 'Mood', 'Place', 'Name', 'Memo'].map((h) => (
                <th key={h} className="py-2 pr-3 font-normal">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((i) => (
              <tr key={`${i.owner.user_id}:${i.card.id}`} className="border-b align-top">
                <td className="py-1.5 pr-3">
                  <img src={i.card.thumb || i.card.image} alt="" className="size-12 rounded bg-neutral-50 object-contain" loading="lazy" />
                </td>
                <td className="py-2 pr-3 whitespace-nowrap text-neutral-500">{when(i.card.createdAt)}</td>
                <td className="py-2 pr-3 whitespace-nowrap">{i.card.serial}</td>
                <td className="py-2 pr-3">
                  <button className="text-left hover:underline" onClick={() => onViewAs(i.owner.user_id)} title="View as this person">
                    <div>{i.owner.state.nickname || '—'}</div>
                    <div className="text-xs text-neutral-500">{i.owner.email ?? i.owner.user_id.slice(0, 8)}</div>
                  </button>
                </td>
                <td className="py-2 pr-3">{i.pending ? <span className="text-neutral-400">not sent</span> : (i.town?.name ?? '—')}</td>
                <td className="py-2 pr-3 whitespace-nowrap">
                  {i.card.mood ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="size-2.5 rounded-full" style={{ background: moodOf(i.card.mood).color }} />
                      {i.card.mood}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="py-2 pr-3">{i.card.place || '—'}</td>
                <td className="py-2 pr-3">{i.card.nickname || '—'}</td>
                <td className="max-w-[320px] py-2 pr-3 break-words">{i.card.memo || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && <p className="mt-4 text-neutral-500">Nothing matches.</p>}
      </div>
    </>
  )
}
