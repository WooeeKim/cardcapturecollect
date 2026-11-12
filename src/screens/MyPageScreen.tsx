import { useState } from 'react'
import personIcon from '../assets/proto/person.svg'
import { FeedbackSheet, LoginSheet, NicknameSheet, PasswordSheet } from '../components/LoginSheet'
import { Bottom, Header, Popup } from '../components/ui'
import { usingSupabase, type User } from '../lib/auth'

// My Page (no Figma frame yet): same look as Town List — white page, hand-written rows.
// Working: log in / sign up / log out, password change, card count, reset. The rest is listed only.
export default function MyPageScreen({
  user,
  cardCount,
  nickname,
  onNickname,
  onBack,
  onLogin,
  onLogout,
  onReset,
}: {
  user: User | null
  cardCount: number
  nickname: string
  onNickname: (name: string) => void
  onBack: () => void
  onLogin: (user: User) => void
  onLogout: () => void
  onReset: () => void
}) {
  const [sheet, setSheet] = useState<'login' | 'password' | 'feedback' | 'nickname' | null>(null)
  const [confirm, setConfirm] = useState<'reset' | 'logout' | null>(null)

  const row = 'flex h-[52px] items-center justify-between border-b border-[#e2e2e2] text-[20px]'
  const soon = (label: string) => (
    <div key={label} className={`${row} text-[#9a9a9a]`}>
      {label}
      <span className="text-[14px]">Coming soon</span>
    </div>
  )

  return (
    <div className="relative h-full overflow-hidden bg-white font-hand">
      <Header title="My Page" onBack={onBack} />

      {/* who */}
      <div className="absolute inset-x-[31px] top-[149px] flex items-center gap-[18px]">
        <span className="flex size-[70px] shrink-0 items-center justify-center rounded-full border-[9px] border-[#ccc] bg-white">
          <img src={personIcon} alt="" className="h-[32px] w-[20px]" />
        </span>
        <div className="min-w-0 flex-1">
          {/* nickname = the name used in the app; the email is only the login id */}
          <button onClick={() => setSheet('nickname')} className="flex max-w-full items-baseline gap-[8px] text-left" aria-label="Edit nickname">
            <span className={`truncate text-[24px] leading-[1.2] ${nickname ? '' : 'text-[#9a9a9a]'}`}>{nickname || 'Set a nickname'}</span>
            <span className="shrink-0 text-[14px] text-[#8a8a8a] underline underline-offset-2">Edit</span>
          </button>
          <p className="mt-[2px] truncate text-[14px] text-[#8a8a8a]">{user ? user.username : 'Guest'}</p>
          <p className="mt-[2px] text-[16px] text-[#8a8a8a]">Cards drawn {cardCount}</p>
        </div>
      </div>
      {!user && (
        <p className="absolute inset-x-[31px] top-[236px] text-[15px] leading-[1.35] text-[#8a8a8a]">
          You're drawing as a guest. Log in to keep your towns and cards in your account.
        </p>
      )}

      <div className="absolute inset-x-[31px] top-[290px]">
        {user ? (
          <button className={`${row} w-full`} onClick={() => setSheet('password')}>
            Edit my info
            <span className="text-[14px] text-[#8a8a8a]">Password</span>
          </button>
        ) : (
          <button className={`${row} w-full`} onClick={() => setSheet('login')}>
            Log in / Sign up
          </button>
        )}
        {soon('Friends')}
        <button className={`${row} w-full`} onClick={() => setConfirm('reset')}>
          Reset
        </button>
        <button className={`${row} w-full`} onClick={() => setSheet('feedback')}>
          Feedback
        </button>
        {soon('Developers')}
        {soon('Privacy Policy')}
        {user && (
          <button className={`${row} w-full`} onClick={() => setConfirm('logout')}>
            Log out
          </button>
        )}
      </div>

      <Bottom>
        <p className="absolute inset-x-0 top-[780px] text-center text-[12px] text-[#b0b0b0]">{usingSupabase ? 'Accounts: Supabase' : 'Accounts: this browser only (no Supabase key)'}</p>
      </Bottom>

      {sheet === 'login' && (
        <LoginSheet
          onClose={() => setSheet(null)}
          onDone={(u) => {
            setSheet(null)
            onLogin(u)
          }}
        />
      )}
      {sheet === 'feedback' && <FeedbackSheet onClose={() => setSheet(null)} />}
      {sheet === 'nickname' && (
        <NicknameSheet
          value={nickname}
          onSave={(name) => {
            onNickname(name)
            setSheet(null)
          }}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'password' && user && <PasswordSheet user={user} onClose={() => setSheet(null)} />}

      {confirm === 'reset' && (
        <Popup
          message="Reset all your towns and cards? This can't be undone."
          actions={[
            { label: 'Reset', onClick: () => { setConfirm(null); onReset() } },
            { label: 'Cancel', onClick: () => setConfirm(null) },
          ]}
        />
      )}
      {confirm === 'logout' && (
        <Popup
          message="Log out?"
          actions={[
            { label: 'Log out', onClick: () => { setConfirm(null); onLogout() } },
            { label: 'Cancel', onClick: () => setConfirm(null) },
          ]}
        />
      )}
    </div>
  )
}

