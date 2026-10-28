'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { useIntro } from './intro'

const TYPE_START_MS = 300 // pausa antes de começar a digitar
const TYPE_CHAR_MS  = 55  // intervalo entre letras
const TYPE_END_MS   = 250 // pausa entre terminar de digitar e liberar o resto

export function Welcome({ firstName }: { firstName?: string | null }) {
  const TITLE = firstName ? `Olá, ${firstName}! Bem-vindo(a) à sua casa.` : 'Olá! Bem-vindo(a) à sua casa.'
  const { typing, finish } = useIntro()
  // Valor inicial: esta visita é a intro pós-login? (não muda quando a digitação termina)
  const [intro] = useState(typing)

  // Digitação do título (só na intro pós-login)
  const [typed, setTyped] = useState(typing ? 0 : TITLE.length)

  useEffect(() => {
    if (!typing) return
    let i = 0
    let interval: ReturnType<typeof setInterval> | undefined
    let endTimer: ReturnType<typeof setTimeout> | undefined
    const startTimer = setTimeout(() => {
      interval = setInterval(() => {
        i += 1
        setTyped(i)
        if (i >= TITLE.length) {
          clearInterval(interval)
          endTimer = setTimeout(finish, TYPE_END_MS)
        }
      }, TYPE_CHAR_MS)
    }, TYPE_START_MS)
    return () => {
      clearTimeout(startTimer)
      clearInterval(interval)
      clearTimeout(endTimer)
    }
  }, [typing, finish, TITLE])

  return (
    // Na intro o bloco não "entra": o título é digitado. A data/hora fica na barra de ferramentas (components/layout/toolbar.tsx).
    <div className={cn('mb-6', !intro && 'animate-enter')}>
      <h1
        className="relative text-3xl font-extrabold"
        style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}
        aria-label={TITLE}
      >
        {/* Texto completo invisível reserva o espaço; o digitado fica por cima */}
        <span className="invisible" aria-hidden="true">{TITLE}</span>
        <span className="absolute inset-0" aria-hidden="true">
          {TITLE.slice(0, typed)}
          {typing && <span className="typing-caret" />}
        </span>
      </h1>
    </div>
  )
}
