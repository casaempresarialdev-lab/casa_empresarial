'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

const diaFormat = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' })
const dataFormat = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
const horaFormat = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })

const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// Data e hora no menu lateral, acima do perfil. Retraído no desktop: só a hora.
export function SidebarClock({ compact }: { compact?: boolean }) {
  // Só no client: usa o fuso do usuário e evita divergência de hidratação
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  if (!now) return <div className="h-11" aria-hidden />

  return (
    <div className={cn('px-2 pb-3', compact && 'md:px-0 md:text-center')} aria-live="off">
      <div className={cn('flex items-end justify-between gap-2', compact && 'md:hidden')}>
        <div className="min-w-0">
          <p className="text-xs font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>{capitalizar(diaFormat.format(now))}</p>
          <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>{dataFormat.format(now)}</p>
        </div>
        <p className="text-xl font-extrabold leading-none shrink-0" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>
          {horaFormat.format(now)}
        </p>
      </div>
      {/* Menu retraído: só a hora */}
      {compact && (
        <p className="hidden md:block text-sm font-extrabold" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }} title={`${capitalizar(diaFormat.format(now))}, ${dataFormat.format(now)}`}>
          {horaFormat.format(now)}
        </p>
      )}
    </div>
  )
}
