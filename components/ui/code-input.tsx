'use client'

import { useId, useRef } from 'react'
import { cn } from '@/lib/utils'

interface CodeInputProps {
  value: string
  onChange: (value: string) => void
  /** Quantidade de dígitos (padrão 6) */
  length?: number
  label?: React.ReactNode
  error?: string
  hint?: string
  /** Esconde os dígitos (ex.: PIN) */
  mask?: boolean
  autoFocus?: boolean
  disabled?: boolean
}

// Código numérico em caixinhas, uma por dígito: digita e avança, apagar volta, setas navegam e colar preenche tudo
export function CodeInput({ value, onChange, length = 6, label, error, hint, mask, autoFocus, disabled }: CodeInputProps) {
  const id = useId()
  const refs = useRef<(HTMLInputElement | null)[]>([])
  // Caixa vazia vira espaço no valor, para cada dígito ficar na sua posição (código incompleto não passa na validação)
  const digits = Array.from({ length }, (_, i) => (value[i] ?? '').trim())
  const emit = (arr: string[]) => onChange(arr.map((c) => c || ' ').join('').trimEnd())

  const focus = (i: number) => refs.current[Math.max(0, Math.min(length - 1, i))]?.focus()

  // Grava os dígitos a partir da posição i (digitação de 1 dígito ou colagem de vários)
  function fill(i: number, raw: string) {
    const novos = raw.replace(/\D/g, '')
    if (!novos) return
    const arr = [...digits]
    for (let k = 0; k < novos.length && i + k < length; k++) arr[i + k] = novos[k]
    emit(arr)
    focus(i + novos.length)
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      e.preventDefault()
      const arr = [...digits]
      // Caixa vazia: apaga a anterior e volta para ela
      const alvo = arr[i] ? i : i - 1
      if (alvo < 0) return
      arr[alvo] = ''
      emit(arr)
      focus(alvo)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault(); focus(i - 1)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault(); focus(i + 1)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={`${id}-0`} className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
          {label}
        </label>
      )}
      <div className="flex gap-2" role="group" aria-label={typeof label === 'string' ? label : 'Código'}>
        {digits.map((d, i) => (
          <input
            key={i}
            id={`${id}-${i}`}
            ref={(el) => { refs.current[i] = el }}
            type={mask ? 'password' : 'text'}
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            maxLength={length} // aceita colar o código inteiro em qualquer caixa
            autoFocus={autoFocus && i === 0}
            disabled={disabled}
            value={d}
            aria-label={`Dígito ${i + 1} de ${length}`}
            onChange={(e) => {
              const v = e.target.value
              // Ao digitar sobre um dígito, fica só o novo
              fill(i, v.length > 1 && d && v.includes(d) ? v.replace(d, '') : v)
            }}
            onPaste={(e) => { e.preventDefault(); fill(i, e.clipboardData.getData('text')) }}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onFocus={(e) => e.target.select()}
            className={cn(
              'w-11 h-12 sm:w-12 sm:h-14 rounded-xl border text-center text-xl font-bold transition-colors',
              'focus:outline-none focus:ring-2 disabled:opacity-50',
              error ? 'border-red-400 focus:ring-red-300' : 'focus:ring-[var(--color-brand)]',
            )}
            style={{
              // Borda na cor principal em todas as caixinhas (vermelha quando há erro)
              borderColor: error ? undefined : 'var(--color-brand)',
              backgroundColor: '#fff',
              color: 'var(--color-text-primary)',
            }}
          />
        ))}
      </div>
      {error && <p className="text-xs" style={{ color: 'var(--color-error)' }}>{error}</p>}
      {hint && !error && <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{hint}</p>}
    </div>
  )
}
