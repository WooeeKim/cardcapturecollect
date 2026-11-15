import { useState } from 'react'
import { LoginForm } from '../components/LoginSheet'
import { APP_NAME } from '../components/Splash'
import { Bottom, LangButton } from '../components/ui'
import type { User } from '../lib/auth'
import { tr } from '../lib/i18n'
import { Pill } from './GilbtiScreen'

// Onboarding (App.tsx): log in / sign up → nickname → 길BTI → draw yourself (DrawScreen tutorial) → pick a town.

// 1. First screen: new people sign up, people who already have an account log in.
export function WelcomeScreen({ onLogin }: { onLogin: (u: User) => void }) {
  return (
    <div className="animate-fade-in relative h-full overflow-hidden bg-[#f9f9f9] font-hand">
      <LangButton className="top-[90px] left-[324px] z-10" />
      <div className="absolute inset-x-[36px] top-[170px]">
        <p className="text-[18px] text-[#7a7a7a]">{tr('Welcome to')}</p>
        <h1 className="mt-[6px] text-[40px] leading-[1.05]">{APP_NAME}</h1>
        <p className="mt-[18px] text-[21px] leading-[1.35] text-[#3d3d3d]">{tr('Draw the people you notice on the subway, and invite them to your town.')}</p>
        <p className="mt-[28px] text-[17px] leading-[1.35] text-[#6b6b6b]">{tr('New here? Sign up. Already have an account? Log in.')}</p>
        <div className="mt-[12px]">
          <LoginForm onDone={onLogin} />
        </div>
      </div>
    </div>
  )
}

// 2. Nickname: the name shown in the app (separate from the login email).
export function NicknameScreen({ initial, onDone }: { initial: string; onDone: (name: string) => void }) {
  const [name, setName] = useState(initial)
  const ok = !!name.trim()
  const go = () => ok && onDone(name.trim())
  return (
    <div className="animate-fade-in relative h-full overflow-hidden bg-[#f9f9f9] font-hand">
      <div className="absolute inset-x-[30px] top-[150px]">
        <p className="text-[28px] leading-[1.2]">{tr('What should we call you?')}</p>
        <p className="mt-[8px] text-[16px] leading-[1.35] text-[#8a8a8a]">{tr('Shown in your towns and on My Page. You can change it later.')}</p>
        <input
          autoFocus
          maxLength={20}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && go()}
          placeholder={tr('Nickname')}
          aria-label={tr('Nickname')}
          className="mt-[24px] h-[50px] w-full rounded-[8px] border-[2px] border-dashed border-[#555] bg-white px-[12px] text-[20px] outline-none placeholder:text-[#9a9a9a]"
        />
      </div>
      <Bottom>
        <div className="absolute top-[760px] inset-x-[30px] flex justify-end">
          <Pill label={tr('Next')} off={!ok} onClick={go} />
        </div>
      </Bottom>
    </div>
  )
}
