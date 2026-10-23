'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'

export const INTRO_COOKIE = 'play_intro'

const IntroContext = createContext<{ typing: boolean; finish: () => void }>({
  typing: false,
  finish: () => {},
})

export function useIntro() {
  return useContext(IntroContext)
}

/**
 * Primeira visita após o login: o título é digitado (Welcome) e o resto da
 * página fica em espera (.intro-wait) até a digitação terminar. Nas demais
 * visitas, só a entrada animada normal (.animate-enter).
 *
 * O login grava o cookie; aqui ele é consumido. O estado fica preso ao valor
 * inicial para que um router.refresh() logo em seguida não reinicie a intro.
 */
export function IntroProvider({ play, children }: { play: boolean; children: React.ReactNode }) {
  const [typing, setTyping] = useState(play)
  const finish = useCallback(() => setTyping(false), [])

  useEffect(() => {
    if (play) document.cookie = `${INTRO_COOKIE}=; path=/; max-age=0; SameSite=Lax`
  }, [play])

  return (
    <IntroContext.Provider value={{ typing, finish }}>
      <div className={typing ? 'intro-wait w-full' : 'w-full'}>{children}</div>
    </IntroContext.Provider>
  )
}
