'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Icon } from '@/components/ui/icon'
import { DASHBOARD_CARD_CLASS } from './summary-card'

const DIA = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Sao_Paulo' })

// Data de Brasília (só no navegador, para não divergir do servidor)
function useHoje() {
  const [hoje, setHoje] = useState('')
  useEffect(() => setHoje(DIA.format(new Date())), [])
  return hoje
}

// Lançador: fundo na cor da empresa, com o ícone em marca d'água
function Lancador({ href, icone, titulo, legenda, delay }: {
  href: string
  icone: 'alarm' | 'calendar'
  titulo: string
  legenda: string
  delay: number
}) {
  return (
    <Link
      href={href}
      className={`${DASHBOARD_CARD_CLASS} group relative overflow-hidden flex items-center gap-4 min-h-28`}
      style={{
        animationDelay: `${delay}ms`,
        background: 'linear-gradient(135deg, var(--color-brand), color-mix(in srgb, var(--color-brand) 72%, #000))',
        borderColor: 'transparent',
      }}
    >
      <span aria-hidden className="absolute -right-6 -bottom-8 text-white opacity-10 transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110">
        <Icon name={icone} size={132} />
      </span>
      <span className="relative w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-white transition-transform duration-200 group-hover:scale-110" style={{ backgroundColor: 'rgba(255,255,255,0.18)' }}>
        <Icon name={icone} size={24} />
      </span>
      <span className="relative flex-1 min-w-0">
        <span className="block text-base font-bold text-white" style={{ fontFamily: 'Manrope' }}>{titulo}</span>
        <span className="block text-xs truncate first-letter:uppercase" style={{ color: 'rgba(255,255,255,0.82)' }}>{legenda || ' '}</span>
      </span>
      <span className="relative shrink-0 transition-transform duration-200 group-hover:translate-x-1" style={{ color: 'rgba(255,255,255,0.85)' }}>
        <Icon name="chevron-right" size={20} />
      </span>
    </Link>
  )
}

// Lançador de ferramentas da home: cada uma aparece conforme o perfil de acesso
export function Ferramentas({ baterPonto }: { baterPonto: boolean }) {
  const hoje = useHoje()
  if (!baterPonto) return null
  return (
    <section className="mb-12">
      <h2 className="animate-enter flex items-center gap-2 text-lg font-bold mb-4" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)', animationDelay: '100ms' }}>
        <Icon name="briefcase" />
        Ferramentas
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <Lancador href="/registrar-ponto" icone="alarm" titulo="Bater ponto" legenda={hoje} delay={160} />
        <Lancador href="/meu-ponto" icone="calendar" titulo="Meu ponto" legenda="Meus horários e pedidos de ajuste" delay={220} />
      </div>
    </section>
  )
}
