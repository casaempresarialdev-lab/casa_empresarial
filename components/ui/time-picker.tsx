'use client'

import { forwardRef, useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { escreverNoCampo, usePosicaoFlutuante } from './date-picker'
import { Icon } from './icon'

// Seletor de hora em relógio (como o ClockPicker), na cor da empresa, no lugar do seletor nativo do navegador.
// O <input type="time"> continua no lugar, então digitar, o register do react-hook-form e o disabled seguem
// funcionando. Horas: 1 a 12 no anel de dentro, 13 a 00 no de fora. Ao soltar a hora, passa para os minutos;
// ao soltar os minutos, preenche o campo e fecha.

const LARGURA = 264
const ALTURA = 372
const TAMANHO = 232
const CENTRO = TAMANHO / 2
const RAIO_EXTERNO = 96
const RAIO_INTERNO = 62
const RAIO_MARCA = 17
/** Tempo para ver o minuto marcado antes de fechar; também evita que o toque atinja o que está embaixo */
const ESPERA_FECHAR_MS = 180

const VOLTA = 2 * Math.PI
const pad = (n: number) => String(n).padStart(2, '0')

export type ModoRelogio = 'horas' | 'minutos'

/** Valor do relógio em um ponto (x e y relativos ao centro) */
export function valorDoPonto(modo: ModoRelogio, x: number, y: number): number {
  const fracao = ((Math.atan2(x, -y) + VOLTA) % VOLTA) / VOLTA
  if (modo === 'minutos') return Math.round(fracao * 60) % 60
  const posicao = Math.round(fracao * 12) % 12
  const interno = Math.hypot(x, y) < (RAIO_INTERNO + RAIO_EXTERNO) / 2
  if (interno) return posicao || 12
  return posicao === 0 ? 0 : posicao + 12
}

/** Onde cada valor fica no mostrador (x e y relativos ao centro) */
export function pontoDoValor(modo: ModoRelogio, valor: number) {
  const fracao = modo === 'minutos' ? valor / 60 : (valor % 12) / 12
  const raio = modo === 'horas' && valor >= 1 && valor <= 12 ? RAIO_INTERNO : RAIO_EXTERNO
  const angulo = fracao * VOLTA
  return { x: Math.sin(angulo) * raio, y: -Math.cos(angulo) * raio, raio }
}

const MARCAS: Record<ModoRelogio, number[]> = {
  horas: Array.from({ length: 24 }, (_, i) => i),
  minutos: Array.from({ length: 12 }, (_, i) => i * 5),
}

export function Mostrador({ modo, valor, onMudar, onSoltar }: {
  modo: ModoRelogio
  valor: number
  onMudar: (v: number) => void
  onSoltar: (v: number) => void
}) {
  const arrastando = useRef(false)

  function ler(e: React.PointerEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    const escala = TAMANHO / r.width
    return valorDoPonto(modo, (e.clientX - r.left) * escala - CENTRO, (e.clientY - r.top) * escala - CENTRO)
  }

  const ponteiro = pontoDoValor(modo, valor)
  const entreMarcas = modo === 'minutos' && valor % 5 !== 0

  return (
    <svg
      width={TAMANHO}
      height={TAMANHO}
      viewBox={`0 0 ${TAMANHO} ${TAMANHO}`}
      className="mx-auto block cursor-pointer select-none touch-none"
      aria-hidden
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); arrastando.current = true; onMudar(ler(e)) }}
      onPointerMove={(e) => { if (arrastando.current) onMudar(ler(e)) }}
      onPointerUp={(e) => { if (arrastando.current) { arrastando.current = false; onSoltar(ler(e)) } }}
      onPointerCancel={() => { arrastando.current = false }}
    >
      <circle cx={CENTRO} cy={CENTRO} r={CENTRO} style={{ fill: 'var(--color-brand-light)' }} />
      <line x1={CENTRO} y1={CENTRO} x2={CENTRO + ponteiro.x} y2={CENTRO + ponteiro.y} strokeWidth={2} style={{ stroke: 'var(--color-brand)' }} />
      <circle cx={CENTRO} cy={CENTRO} r={4} style={{ fill: 'var(--color-brand)' }} />
      <circle cx={CENTRO + ponteiro.x} cy={CENTRO + ponteiro.y} r={RAIO_MARCA} style={{ fill: 'var(--color-brand)' }} />
      {entreMarcas && <circle cx={CENTRO + ponteiro.x} cy={CENTRO + ponteiro.y} r={3} fill="#fff" />}
      {MARCAS[modo].map((m) => {
        const p = pontoDoValor(modo, m)
        const rotulo = modo === 'minutos' || m === 0 ? pad(m) : String(m)
        return (
          <text
            key={m}
            x={CENTRO + p.x}
            y={CENTRO + p.y}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={13}
            fontWeight={m === valor ? 700 : 500}
            pointerEvents="none"
            style={{ fill: m === valor ? '#fff' : 'var(--color-text-primary)' }}
          >
            {rotulo}
          </text>
        )
      })}
    </svg>
  )
}

function agora() {
  const d = new Date()
  return { hora: d.getHours(), minuto: d.getMinutes() }
}

function Relogio({ valor, ancora, onEscolher, onFechar }: {
  valor: string
  ancora: HTMLElement
  onEscolher: (v: string) => void
  onFechar: () => void
}) {
  const caixaRef = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pos = usePosicaoFlutuante({ ancora, caixaRef, largura: LARGURA, altura: ALTURA, onFechar })

  const [inicial] = useState(() => /^\d{2}:\d{2}/.test(valor) ? { hora: Number(valor.slice(0, 2)), minuto: Number(valor.slice(3, 5)) } : agora())
  const [hora, setHora] = useState(inicial.hora)
  const [minuto, setMinuto] = useState(inicial.minuto)
  const [modo, setModo] = useState<ModoRelogio>('horas')

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  function soltar(v: number) {
    if (modo === 'horas') { setHora(v); setModo('minutos'); return }
    setMinuto(v)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => onEscolher(`${pad(hora)}:${pad(v)}`), ESPERA_FECHAR_MS)
  }

  function usarAgora() {
    const a = agora()
    onEscolher(`${pad(a.hora)}:${pad(a.minuto)}`)
  }

  const digito = (m: ModoRelogio, texto: string, rotulo: string) => (
    <button
      type="button"
      onClick={() => setModo(m)}
      aria-pressed={modo === m}
      aria-label={rotulo}
      className="px-1.5 rounded-lg cursor-pointer tabular-nums hover:bg-[var(--color-brand-light)]"
      style={{ color: modo === m ? 'var(--color-brand)' : 'var(--color-text-muted)' }}
    >
      {texto}
    </button>
  )

  return createPortal(
    <div
      ref={caixaRef}
      role="dialog"
      aria-label="Escolher hora"
      className="fixed z-[80] rounded-2xl border bg-white shadow-xl p-3 animate-enter"
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: LARGURA, borderColor: 'var(--color-bg-surface)' }}
    >
      <div className="flex items-center justify-center mb-3 text-3xl font-extrabold" style={{ fontFamily: 'Manrope' }}>
        {digito('horas', pad(hora), 'Escolher as horas')}
        <span style={{ color: 'var(--color-text-muted)' }}>:</span>
        {digito('minutos', pad(minuto), 'Escolher os minutos')}
      </div>

      <Mostrador
        modo={modo}
        valor={modo === 'horas' ? hora : minuto}
        onMudar={modo === 'horas' ? setHora : setMinuto}
        onSoltar={soltar}
      />

      <div className="flex items-center justify-between mt-3 pt-2 border-t" style={{ borderColor: 'var(--color-bg-surface)' }}>
        <button type="button" onClick={() => onEscolher('')} className="h-8 px-3 rounded-lg text-sm font-semibold cursor-pointer hover:bg-gray-50" style={{ color: 'var(--color-text-muted)' }}>
          Limpar
        </button>
        <button type="button" onClick={usarAgora} className="h-8 px-3 rounded-lg text-sm font-semibold cursor-pointer hover:bg-[var(--color-brand-light)]" style={{ color: 'var(--color-brand)' }}>
          Agora
        </button>
      </div>
    </div>,
    document.body,
  )
}

type CampoHoraProps = React.InputHTMLAttributes<HTMLInputElement>

/** Campo de hora com o relógio da empresa (mesmas props de um <input type="time">) */
export const CampoHora = forwardRef<HTMLInputElement, CampoHoraProps>(({ className, style, onClick, onKeyDown, ...props }, ref) => {
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
        type="time"
        className={cn('campo-data pr-10', className)}
        style={style}
        onClick={(e) => { onClick?.(e); abrir() }}
        onKeyDown={(e) => {
          onKeyDown?.(e)
          // Alt+↓ ou Enter/Espaço abrem o relógio pelo teclado; os números continuam digitando a hora
          if ((e.altKey && e.key === 'ArrowDown') || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir() }
        }}
        {...props}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => (aberto ? fechar() : abrir())}
        disabled={props.disabled}
        aria-label="Abrir relógio"
        className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-md flex items-center justify-center cursor-pointer hover:bg-[var(--color-brand-light)] disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ color: 'var(--color-brand)' }}
      >
        <Icon name="alarm" size={17} />
      </button>
      {aberto && caixaRef.current && <Relogio valor={valor} ancora={caixaRef.current} onEscolher={escolher} onFechar={fechar} />}
    </div>
  )
})
CampoHora.displayName = 'CampoHora'
