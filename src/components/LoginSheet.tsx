import { useState } from 'react'
import { track } from '../lib/analytics'
import { MIN_PASSWORD, changePassword, logIn, signUp, type User } from '../lib/auth'
import { TextButton } from './ui'

const field = 'h-[44px] w-full rounded-[6px] border-[2px] border-dashed border-[#555] bg-white px-[10px] text-[19px] outline-none placeholder:text-[#999]'

export function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="animate-fade-in absolute inset-0 z-50 flex items-center bg-black/35 px-[24px]" onClick={onClose}>
      <div role="dialog" className="animate-pop-in w-full rounded-[14px] bg-[#f0f0f0] px-[22px] pt-[26px] pb-[20px] font-hand" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

// Email + password (Supabase rules). `prompt` = shown right after the first card moves in (closable with "Later").
export function LoginSheet({ prompt = false, onDone, onClose }: { prompt?: boolean; onDone: (user: User) => void; onClose: () => void }) {
  const [id, setId] = useState('')
  const [pw, setPw] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function run(kind: 'login' | 'signup') {
    setBusy(true)
    setError('')
    const res = kind === 'login' ? await logIn(id, pw) : await signUp(id, pw)
    setBusy(false)
    track(kind === 'login' ? 'log_in' : 'sign_up', { ok: res.ok })
    if (res.ok) onDone(res.user)
    else setError(res.error)
  }

  return (
    <Sheet onClose={onClose}>
      <p className="text-center text-[24px] leading-[1.2]">{prompt ? 'Keep your town' : 'Log in'}</p>
      {prompt && <p className="mt-[6px] text-center text-[16px] leading-[1.3] text-[#555]">Log in to save your town and cards to your account.</p>}
      <form
        className="mt-[18px] flex flex-col gap-[10px]"
        onSubmit={(e) => {
          e.preventDefault()
          run('login')
        }}
      >
        <input value={id} onChange={(e) => setId(e.target.value)} type="email" inputMode="email" placeholder="Email" autoComplete="email" aria-label="Email" className={field} />
        <input
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          type="password"
          placeholder={`Password (${MIN_PASSWORD}+ characters)`}
          autoComplete="current-password"
          aria-label="Password"
          className={field}
        />
        <p className="min-h-[20px] text-[15px] text-[#c0392b]" role="alert">
          {error}
        </p>
        <div className="flex justify-around text-[20px]">
          <TextButton onClick={() => run('login')} className={busy ? 'opacity-40' : ''}>
            Log in
          </TextButton>
          <TextButton onClick={() => run('signup')} className={busy ? 'opacity-40' : ''}>
            Sign up
          </TextButton>
        </div>
        <button type="submit" className="hidden" />
      </form>
      <div className="mt-[16px] text-center text-[17px]">
        <TextButton dim onClick={onClose}>
          {prompt ? 'Later' : 'Cancel'}
        </TextButton>
      </div>
    </Sheet>
  )
}

export function PasswordSheet({ user, onClose }: { user: User; onClose: () => void }) {
  const [pw, setPw] = useState('')
  const [again, setAgain] = useState('')
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  async function save() {
    if (pw !== again) return setMsg({ text: 'The two passwords are different.', ok: false })
    const res = await changePassword(user, pw)
    setMsg(res.ok ? { text: 'Password changed.', ok: true } : { text: res.error ?? 'Could not change password.', ok: false })
    if (res.ok) {
      setPw('')
      setAgain('')
    }
  }

  return (
    <Sheet onClose={onClose}>
      <p className="text-center text-[24px] leading-[1.2]">Edit my info</p>
      <p className="mt-[6px] text-center text-[16px] text-[#555]">{user.username}</p>
      <div className="mt-[18px] flex flex-col gap-[10px]">
        <input value={pw} onChange={(e) => setPw(e.target.value)} type="password" placeholder="New password" autoComplete="new-password" aria-label="New password" className={field} />
        <input value={again} onChange={(e) => setAgain(e.target.value)} type="password" placeholder="New password again" autoComplete="new-password" aria-label="New password again" className={field} />
        <p className={`min-h-[20px] text-[15px] ${msg?.ok ? 'text-[#469015]' : 'text-[#c0392b]'}`} role="alert">
          {msg?.text}
        </p>
        <div className="flex justify-around text-[20px]">
          <TextButton dim onClick={onClose}>
            Close
          </TextButton>
          <TextButton onClick={save}>Save</TextButton>
        </div>
      </div>
    </Sheet>
  )
}

// Free-text feedback from testers → PostHog event "feedback" (with the screen it was sent from).
export function FeedbackSheet({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState('')
  const [sent, setSent] = useState(false)
  return (
    <Sheet onClose={onClose}>
      <p className="text-center text-[24px] leading-[1.2]">Feedback</p>
      {sent ? (
        <p className="mt-[18px] text-center text-[18px]">Thanks! We read every note.</p>
      ) : (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What was confusing, fun, or missing?"
          aria-label="Feedback"
          rows={5}
          className="mt-[18px] w-full resize-none rounded-[6px] border-[2px] border-dashed border-[#555] bg-white px-[10px] py-[8px] text-[17px] leading-[1.3] outline-none placeholder:text-[#999]"
        />
      )}
      <div className="mt-[16px] flex justify-around text-[20px]">
        <TextButton dim onClick={onClose}>
          Close
        </TextButton>
        {!sent && (
          <TextButton
            className={text.trim() ? '' : 'opacity-40'}
            onClick={() => {
              if (!text.trim()) return
              track('feedback', { text: text.trim() })
              setSent(true)
            }}
          >
            Send
          </TextButton>
        )}
      </div>
    </Sheet>
  )
}

// Nickname used inside the app (towns, gallery …); separate from the login email.
export function NicknameSheet({ value, onSave, onClose }: { value: string; onSave: (name: string) => void; onClose: () => void }) {
  const [name, setName] = useState(value)
  return (
    <Sheet onClose={onClose}>
      <p className="text-center text-[24px] leading-[1.2]">Nickname</p>
      <p className="mt-[6px] text-center text-[16px] text-[#555]">The name you go by in the app.</p>
      <form
        className="mt-[18px] flex flex-col gap-[10px]"
        onSubmit={(e) => {
          e.preventDefault()
          onSave(name)
        }}
      >
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder="Nickname" aria-label="Nickname" className={field} />
        <p className="text-right text-[13px] text-[#8a8a8a]">{name.trim().length}/20</p>
        <div className="flex justify-around text-[20px]">
          <TextButton dim onClick={onClose}>
            Close
          </TextButton>
          <TextButton onClick={() => onSave(name)}>Save</TextButton>
        </div>
        <button type="submit" className="hidden" />
      </form>
    </Sheet>
  )
}
