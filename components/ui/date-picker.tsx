'use client'

import { forwardRef, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { Icon } from './icon'

// Seletor de data na cor da empresa, no lugar do calendário nativo do navegador.
// O <input type="date"> continua no lugar (digitação, register do react-hook-form, min/max e disabled seguem
// funcionando); o calendário nativo fica escondido e, ao clicar, abre este. A data escolhida é escrita no
// campo e dispara o evento de input, então o onChange dos formulários recebe o valor normalmente.

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const LARGURA = 296
const ALTURA = 352

const pad = (n: number) => String(n).padStart(2, '0')
const paraIso = (a: number, m: number, d: number) => `${a}-${pad(m + 1)}-${pad(d)}`
const hojeIso = () => { const h = new Date(); return paraIso(h.getFullYear(), h.getMonth(), h.getDate()) }
const valido = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v)

/** Escreve o valor no campo como se o usuário tivesse digitado (o React e o react-hook-form recebem o onChange) */
function escreverNoCampo(el: HTMLInputElement, valor: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  setter?.call(el, valor)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

type Visao = 'dias' | 'meses' | 'anos'

function Calendario({ valor, min, max, ancora, onEscolher, onFechar }: {
  valor: string
  min?: string
  max?: string
  ancora: HTMLElement
  onEscolher: (v: string) => void
  onFechar: () => void
}) {
  const caixaRef = useRef<HTMLDivElement>(null)
  const inicial = valido(valor) ? valor : hojeIso()
  const [ano, setAno] = useState(Number(inicial.slice(0, 4)))
  const [mes, setMes] = useState(Number(inicial.slice(5, 7)) - 1)
  const [visao, setVisao] = useState<Visao>('dias')
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const hoje = hojeIso()

  // Abaixo do campo; sem espaço, acima. Acompanha a rolagem (inclusive dentro de modais)
  const posicionar = useCallback(() => {
    const r = ancora.getBoundingClientRect()
    const abaixo = r.bottom + 6
    const top = abaixo + ALTURA > window.innerHeight && r.top - 6 - ALTURA > 0 ? r.top - 6 - ALTURA : abaixo
    const left = Math.min(Math.max(8, r.left), window.innerWidth - LARGURA - 8)
    setPos({ top, left })
  }, [ancora])

  useLayoutEffect(() => { posicionar() }, [posicionar])
  useEffect(() => {
    window.addEventListener('resize', posicionar)
    window.addEventListener('scroll', posicionar, true)
    const fora = (ev: MouseEvent) => {
      const alvo = ev.target as Node
      if (!caixaRef.current?.contains(alvo) && !ancora.contains(alvo)) onFechar()
    }
    const tecla = (ev: KeyboardEvent) => { if (ev.key === 'Escape') { ev.stopPropagation(); onFechar() } }
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', tecla, true)
    return () => {
      window.removeEventListener('resize', posicionar)
      window.removeEventListener('scroll', posicionar, true)
      document.removeEventListener('mousedown', fora)
      document.removeEventListener('keydown', tecla, true)
    }
  }, [posicionar, ancora, onFechar])

  const foraDoLimite = (iso: string) => (!!min && iso < min) || (!!max && iso > max)

  function navegar(delta: number) {
    if (visao === 'dias') {
      const d = new Date(ano, mes + delta, 1)
      setAno(d.getFullYear()); setMes(d.getMonth())
    } else setAno((a) => a + delta * (visao === 'anos' ? 12 : 1))
  }

  // Grade do mês: começa no domingo, sempre 6 semanas
  const primeiro = new Date(ano, mes, 1)
  const dias = Array.from({ length: 42 }, (_, i) => new Date(ano, mes, 1 - primeiro.getDay() + i))
  const inicioAnos = ano - (ano % 12)

  const titulo = visao === 'dias' ? `${MESES[mes]} ${ano}` : visao === 'meses' ? String(ano) : `${inicioAnos} – ${inicioAnos + 11}`
  const botaoNav = 'w-8 h-8 rounded-full flex items-center justify-center hover:bg-[var(--color-brand-light)] cursor-pointer'
  const marcado = { backgroundColor: 'var(--color-brand)', color: '#fff' }

  return createPortal(
    <div
      ref={caixaRef}
      role="dialog"
      aria-label="Escolher data"
      className="fixed z-[80] rounded-2xl border bg-white shadow-xl p-3 animate-enter"
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: LARGURA, borderColor: 'var(--color-bg-surface)' }}
    >
      {/* Cabeçalho: setas e título (clique alterna dias → meses → anos) */}
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={() => navegar(-1)} aria-label="Anterior" className={botaoNav} style={{ color: 'var(--color-brand)' }}>
          <Icon name="chevron-left" size={18} />
        </button>
        <button
          type="button"
          onClick={() => setVisao(visao === 'dias' ? 'meses' : visao === 'meses' ? 'anos' : 'dias')}
          className="h-8 px-3 rounded-lg text-sm font-bold cursor-pointer hover:bg-[var(--color-brand-light)]"
          style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}
        >
          {titulo}
        </button>
        <button type="button" onClick={() => navegar(1)} aria-label="Próximo" className={botaoNav} style={{ color: 'var(--color-brand)' }}>
          <Icon name="chevron-right" size={18} />
        </button>
      </div>

      {visao === 'dias' && (
        <>
          <div className="grid grid-cols-7 mb-1">
            {SEMANA.map((s, i) => (
              <span key={i} className="h-8 flex items-center justify-center text-[11px] font-bold" style={{ color: 'var(--color-text-muted)' }}>{s}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-0.5">
            {dias.map((d) => {
              const iso = paraIso(d.getFullYear(), d.getMonth(), d.getDate())
              const doMes = d.getMonth() === mes
              const selecionado = iso === valor
              const ehHoje = iso === hoje
              const bloqueado = foraDoLimite(iso)
              return (
                <button
                  key={iso}
                  type="button"
                  disabled={bloqueado}
                  onClick={() => onEscolher(iso)}
                  aria-pressed={selecionado}
                  aria-label={`${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`}
                  className={cn(
                    'mx-auto w-9 h-9 rounded-full text-sm flex items-center justify-center transition-colors',
                    bloqueado ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer',
                    !selecionado && !bloqueado && 'hover:bg-[var(--color-brand-light)]',
                    (selecionado || ehHoje) && 'font-bold',
                  )}
                  style={selecionado
                    ? marcado
                    : ehHoje
                      ? { color: 'var(--color-brand)', boxShadow: 'inset 0 0 0 1.5px var(--color-brand)' }
                      : { color: doMes ? 'var(--color-text-primary)' : '#C4C4C4' }}
                >
                  {d.getDate()}
                </button>
              )
            })}
          </div>
        </>
      )}

      {visao === 'meses' && (
        <div className="grid grid-cols-3 gap-2 py-2">
          {MESES_CURTOS.map((m, i) => {
            const atual = valido(valor) && Number(valor.slice(0, 4)) === ano && Number(valor.slice(5, 7)) - 1 === i
            return (
              <button
                key={m}
                type="button"
                onClick={() => { setMes(i); setVisao('dias') }}
                className={cn('h-12 rounded-xl text-sm font-semibold capitalize cursor-pointer transition-colors', !atual && 'hover:bg-[var(--color-brand-light)]')}
                style={atual ? marcado : { color: 'var(--color-text-primary)' }}
              >
                {m}
              </button>
            )
          })}
        </div>
      )}

      {visao === 'anos' && (
        <div className="grid grid-cols-3 gap-2 py-2">
          {Array.from({ length: 12 }, (_, i) => inicioAnos + i).map((a) => {
            const atual = valido(valor) && Number(valor.slice(0, 4)) === a
            return (
              <button
                key={a}
                type="button"
                onClick={() => { setAno(a); setVisao('meses') }}
                className={cn('h-12 rounded-xl text-sm font-semibold cursor-pointer transition-colors', !atual && 'hover:bg-[var(--color-brand-light)]')}
                style={atual ? marcado : { color: 'var(--color-text-primary)' }}
              >
                {a}
              </button>
            )
          })}
        </div>
      )}

      {/* Rodapé: limpar e hoje */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t" style={{ borderColor: 'var(--color-bg-surface)' }}>
        <button type="button" onClick={() => onEscolher('')} className="h-8 px-3 rounded-lg text-sm font-semibold cursor-pointer hover:bg-gray-50" style={{ color: 'var(--color-text-muted)' }}>
          Limpar
        </button>
        <button
          type="button"
          onClick={() => onEscolher(hoje)}
          disabled={foraDoLimite(hoje)}
          className="h-8 px-3 rounded-lg text-sm font-semibold cursor-pointer hover:bg-[var(--color-brand-light)] disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ color: 'var(--color-brand)' }}
        >
          Hoje
        </button>
      </div>
    </div>,
    document.body,
  )
}

type CampoDataProps = React.InputHTMLAttributes<HTMLInputElement>

/** Campo de data com o seletor da empresa (mesmas props de um <input type="date">) */
export const CampoData = forwardRef<HTMLInputElement, CampoDataProps>(({ className, style, onClick, onKeyDown, ...props }, ref) => {
  const caixaRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [aberto, setAberto] = useState(false)
  const [valor, setValor] = useState('')

  const juntarRef = (el: HTMLInputElement | null) => {
    inputRef.current = el
    if (typeof ref === 'function') ref(el)
    else if (ref) ref.current = el
  }

  function abrir() {
    const el = inputRef.current
    if (!el || el.disabled || el.readOnly) return
    setValor(el.value)
    setAberto(true)
  }

  const fechar = useCallback(() => setAberto(false), [])

  function escolher(v: string) {
    if (inputRef.current) escreverNoCampo(inputRef.current, v)
    setAberto(false)
    inputRef.current?.focus()
  }

  return (
    <div ref={caixaRef} className="relative">
      <input
        ref={juntarRef}
        type="date"
        className={cn('campo-data pr-10', className)}
        style={style}
        onClick={(e) => { onClick?.(e); abrir() }}
        onKeyDown={(e) => {
          onKeyDown?.(e)
          // Alt+↓ ou Enter/Espaço abrem o calendário pelo teclado
          if ((e.altKey && e.key === 'ArrowDown') || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir() }
        }}
        {...props}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => (aberto ? fechar() : abrir())}
        disabled={props.disabled}
        aria-label="Abrir calendário"
        className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-md flex items-center justify-center cursor-pointer hover:bg-[var(--color-brand-light)] disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ color: 'var(--color-brand)' }}
      >
        <Icon name="calendar" size={17} />
      </button>
      {aberto && caixaRef.current && (
        <Calendario
          valor={valor}
          min={typeof props.min === 'string' ? props.min : undefined}
          max={typeof props.max === 'string' ? props.max : undefined}
          ancora={caixaRef.current}
          onEscolher={escolher}
          onFechar={fechar}
        />
      )}
    </div>
  )
})
CampoData.displayName = 'CampoData'
