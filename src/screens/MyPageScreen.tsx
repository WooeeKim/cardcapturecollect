import { useState } from 'react'
import backIcon from '../assets/proto/v2/back40.svg'
import boxSvg from '../assets/proto/v2/mp-box.svg'
import personSvg from '../assets/proto/v2/mp-person.svg'
import lineA from '../assets/proto/v2/mp-line-a.svg'
import lineB from '../assets/proto/v2/mp-line-b.svg'
import underline from '../assets/proto/v2/mp-underline.svg'
import toggleOn from '../assets/proto/v2/mp-toggle.svg'
import pill from '../assets/proto/v2/tl-edit.svg'
import { FeedbackSheet, LoginSheet, PasswordSheet } from '../components/LoginSheet'
import { ToggleIcon } from '../components/drawIcons'
import { Bottom, Popup, type PopupAction } from '../components/ui'
import { PillBack, PillFinish } from '../components/v2'
import { type User } from '../lib/auth'

// My Page (Figma mypage-login 830:814 / mypage-logout 838:2079 / edit 838:2365).
const NOTIFY = 'subwayseal.notify'
const readNotify = () => {
  try {
    return localStorage.getItem(NOTIFY) !== 'off'
  } catch {
    return true
  }
}

export default function MyPageScreen({
  user,
  cardCount,
  townCount,
  since,
  nickname,
  intro,
  onProfile,
  onBack,
  onInterview,
  onLogin,
  onLogout,
  onDeleteAccount,
  onReset,
}: {
  user: User | null
  cardCount: number
  townCount: number
  since: string // YY.MM.DD
  nickname: string
  intro: string
  onProfile: (nickname: string, intro: string) => void
  onBack: () => void
  onInterview: () => void
  onLogin: (user: User) => void
  onLogout: () => void
  onDeleteAccount: () => Promise<string | undefined>
  onReset: () => void
}) {
  const [sheet, setSheet] = useState<'login' | 'password' | 'feedback' | null>(null)
  const [popup, setPopup] = useState<{ message: string; actions: PopupAction[] } | null>(null)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(nickname)
  const [about, setAbout] = useState(intro)
  const [notify, setNotify] = useState(readNotify)

  const gotIt = (message: string) => setPopup({ message, actions: [{ label: 'Got it!', onClick: () => setPopup(null) }] })
  const startEdit = () => {
    setName(nickname)
    setAbout(intro)
    setEditing(true)
  }
  const toggleNotify = () => {
    const next = !notify
    setNotify(next)
    try {
      localStorage.setItem(NOTIFY, next ? 'on' : 'off')
    } catch {
      /* private mode */
    }
  }
  const askDelete = () =>
    setPopup({
      message: "Delete your account and all your towns and cards?\nThis can't be undone.",
      actions: [
        {
          label: 'Delete',
          onClick: async () => {
            setPopup(null)
            const note = await onDeleteAccount()
            if (note) gotIt(note)
          },
        },
        { label: 'Cancel', onClick: () => setPopup(null) },
      ],
    })

  // list rows: Figma pitch 59.8, first at 359
  const ROW0 = 359
  const PITCH = 59.8
  const rows: { label: string; tone?: string; soon?: boolean; right?: React.ReactNode; onClick?: () => void; disabled?: boolean }[] = [
    {
      label: 'Notification setting',
      onClick: toggleNotify,
      right: notify ? <img src={toggleOn} alt="" className="h-[25px] w-[48px]" /> : <span className="block h-[23px] w-[46px]"><ToggleIcon on={false} /></span>,
    },
    { label: 'Subway-TI', onClick: onInterview },
    { label: 'Notice', onClick: () => gotIt('Notices are coming soon.') },
    { label: 'FAQ', onClick: () => gotIt('FAQ is coming soon.') },
    { label: 'Feedback', onClick: () => setSheet('feedback') },
    {
      // testing helper: wipes towns, cards, nickname and intro on this device / account (guests too)
      label: 'Reset (test)',
      onClick: () =>
        setPopup({
          message: "Reset all your towns and cards?\nThis can't be undone.",
          actions: [
            { label: 'Reset', onClick: () => { setPopup(null); onReset() } },
            { label: 'Cancel', onClick: () => setPopup(null) },
          ],
        }),
    },
    { label: 'Neighbors', tone: 'text-[#7e7e7e]', soon: true },
    { label: 'Developers', tone: 'text-[#7e7e7e]', soon: true },
    { label: 'Delete Account', tone: 'text-[#b8b8b8]', onClick: user ? askDelete : undefined, disabled: !user },
  ]

  return (
    <div className="relative h-full overflow-hidden bg-[#f9f9f9] font-hand">
      <button aria-label="Back" onClick={onBack} className="absolute top-[85px] left-[24px] z-10 size-[40px]">
        <img src={backIcon} alt="" className="size-full" />
      </button>
      <p className="absolute top-[89px] left-1/2 -translate-x-1/2 text-[24px] leading-[normal]">My Page</p>

      {/* settings list (scrolls on short phones) */}
      <div className="absolute inset-x-0 overflow-y-auto [scrollbar-width:none]" style={{ top: 340, bottom: 99 }}>
        <div className="relative" style={{ height: ROW0 - 340 + rows.length * PITCH + 10 }}>
          {rows.map((r, i) => {
            const top = ROW0 - 340 + i * PITCH
            const Tag = r.onClick ? 'button' : 'div'
            return (
              <div key={r.label}>
                <Tag
                  onClick={r.onClick}
                  aria-disabled={r.disabled || undefined}
                  className={`absolute left-[37px] flex h-[44px] w-[328px] items-center justify-between text-left text-[24px] leading-[normal] ${r.tone ?? ''} ${r.disabled ? 'opacity-60' : ''}`}
                  style={{ top: top - 6 }}
                >
                  {r.label}
                  {r.soon && <span className="text-[14px]">Coming Soon</span>}
                  {r.right}
                </Tag>
                {i < rows.length - 1 && <img src={i % 2 ? lineB : lineA} alt="" className="pointer-events-none absolute left-[33px] h-[4.3px] w-[335px] max-w-none" style={{ top: top + 43 }} />}
              </div>
            )
          })}
        </div>
      </div>

      {/* bottom: log out / log in */}
      <Bottom>
        <button onClick={() => (user ? setPopup({ message: 'Log out?', actions: [{ label: 'Log out', onClick: () => { setPopup(null); onLogout() } }, { label: 'Cancel', onClick: () => setPopup(null) }] }) : setSheet('login'))} className="absolute top-[785px] left-1/2 -translate-x-1/2 px-[10px] pb-[8px] text-[24px] leading-[normal] whitespace-nowrap text-[#8e8e8e]">
          {user ? 'Log out' : 'Log in/Sign up'}
          <img src={underline} alt="" className="absolute bottom-[2px] left-1/2 h-[3px] w-[calc(100%-12px)] max-w-none -translate-x-1/2" />
        </button>
      </Bottom>

      {/* dim behind the box while editing */}
      {editing && <div className="animate-fade-in absolute inset-0 z-20 bg-black/35" />}

      {/* profile box */}
      <div className={`absolute top-[149px] left-[16px] w-[370px] transition-[height] duration-300 ${editing ? 'z-30 h-[318px]' : 'h-[171px]'}`}>
        <img src={boxSvg} alt="" className="absolute inset-0 size-full" />
        <span className="absolute top-[20px] left-[21px] flex size-[70px] items-end justify-center overflow-hidden rounded-full border-[2.33px] border-[#2e2e2e] bg-white">
          <img src={personSvg} alt="" className="mb-[-3px] h-[57.6px] w-[37.3px]" />
        </span>
        {editing ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            placeholder="Nickname"
            aria-label="Nickname"
            className="absolute top-[14px] left-[112px] w-[230px] rounded-[6px] border-2 border-dashed border-[#707070] bg-white/70 px-[6px] text-[24px] leading-[1.3] outline-none placeholder:text-[#9a9a9a]"
          />
        ) : (
          <p className={`absolute top-[17px] left-[112px] w-[240px] truncate text-[24px] leading-[normal] ${nickname ? '' : 'text-[#9a9a9a]'}`}>{nickname || 'No Profile'}</p>
        )}
        <p className="absolute top-[54px] left-[112px] text-[14px] leading-[normal] text-[#464646]">
          {cardCount} {cardCount === 1 ? 'Capture' : 'Captures'}
        </p>
        <p className="absolute top-[72px] left-[112px] text-[14px] leading-[normal] text-[#464646]">
          {townCount} {townCount === 1 ? 'Town' : 'Towns'}
        </p>
        {user && <p className="absolute top-[54px] right-[18px] max-w-[120px] truncate text-[12px] text-[#9a9a9a]">{user.username}</p>}
        {editing ? (
          <>
            <textarea
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              maxLength={120}
              rows={4}
              placeholder="Write your introduction..."
              aria-label="Introduction"
              className="absolute top-[103px] left-[21px] h-[110px] w-[328px] resize-none rounded-[8px] border-2 border-dashed border-[#707070] bg-white/70 px-[8px] py-[6px] text-[17px] leading-[1.2] outline-none placeholder:text-[#c9c9c9]"
            />
            {user && (
              <button onClick={() => setSheet('password')} className="absolute top-[222px] left-[23px] text-[15px] text-[#686868] underline underline-offset-2">
                Change password
              </button>
            )}
            <button
              onClick={() => setEditing(false)}
              className="absolute top-[290px] left-[30px] flex h-[52px] w-[108px] items-center justify-center"
            >
              <span className="absolute inset-0 rotate-[-178.73deg]">
                <PillFinish />
              </span>
              <span className="relative text-[22px] leading-[1.1] text-[#686868]">Discard</span>
            </button>
            <button
              onClick={() => {
                onProfile(name.trim(), about.trim())
                setEditing(false)
              }}
              className="absolute top-[289px] left-[244px] flex h-[54px] w-[110px] items-center justify-center"
            >
              <span className="absolute inset-0 rotate-[-177.79deg]">
                <PillBack />
              </span>
              <span className="relative text-[22px] leading-[1.1]">Save</span>
            </button>
          </>
        ) : (
          <>
            <p className={`absolute top-[105px] left-[21px] line-clamp-1 w-[283px] text-[17px] leading-[1.2] break-words ${intro ? 'text-[#3d3d3d]' : 'text-[#c9c9c9]'}`}>{intro || 'Write your introduction...'}</p>
            <p className="absolute top-[133px] left-[21px] text-[14px] leading-[1.1] text-[#8e8e8e]">Since {since}</p>
            <button onClick={startEdit} className="absolute top-[150px] left-[286px] flex h-[41px] w-[69px] items-center justify-center" aria-label="Edit profile">
              <img src={pill} alt="" className="absolute inset-[-2.5%_-1.5%] size-[calc(100%+3%)] max-w-none" />
              <span className="relative text-[20px] leading-[1.3]">Edit</span>
            </button>
          </>
        )}
      </div>

      {sheet === 'login' && (
        <LoginSheet
          onClose={() => setSheet(null)}
          onDone={(u) => {
            setSheet(null)
            onLogin(u)
          }}
        />
      )}
      {sheet === 'password' && user && <PasswordSheet user={user} onClose={() => setSheet(null)} />}
      {sheet === 'feedback' && <FeedbackSheet onClose={() => setSheet(null)} />}
      {popup && <Popup message={popup.message} actions={popup.actions} />}
    </div>
  )
}
