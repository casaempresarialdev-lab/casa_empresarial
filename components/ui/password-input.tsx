'use client'

import { forwardRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface PasswordInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
  error?: string
  hint?: string
  /**
   * Evita o preenchimento e a caixa de sugestões do navegador/gerenciador de senhas (ex.: confirmar identidade, nova senha).
   * Onde há suporte (Chrome, Edge, Safari…), o campo vira texto comum mascarado por CSS (-webkit-text-security):
   * sem type="password" o navegador não o trata como senha e não abre a caixa de sugestões.
   * Sem suporte, continua senha com proteções: só leitura até a 1ª interação, autocomplete "new-password"/"off"
   * e marcadores que os gerenciadores (1Password, LastPass, Bitwarden, Dashlane) respeitam.
   * (O name não é trocado: o react-hook-form precisa dele para ler o campo.)
   */
  semAutocompletar?: boolean
}

// Máscara por CSS disponível? (os modais só montam no navegador, então dá para checar na hora)
const suportaMascaraCss = () =>
  typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('-webkit-text-security', 'disc')

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, label, error, hint, id, semAutocompletar, autoComplete, name, onFocus, readOnly, ...props }, ref) => {
    const [show, setShow] = useState(false)
    const [liberado, setLiberado] = useState(false)
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    const [mascaraCss] = useState(() => !!semAutocompletar && suportaMascaraCss())

    const marcadores = { 'data-lpignore': 'true', 'data-1p-ignore': 'true', 'data-bwignore': 'true', 'data-form-type': 'other' }
    const antiAutofill = !semAutocompletar
      ? { autoComplete, readOnly }
      : mascaraCss
        // Texto comum mascarado: sem sugestões de senha, sem correção/maiúscula automática do teclado
        ? { autoComplete: 'off', readOnly, autoCapitalize: 'off', autoCorrect: 'off', spellCheck: false, ...marcadores }
        : { autoComplete: autoComplete === 'new-password' ? 'new-password' : 'off', readOnly: readOnly || !liberado, ...marcadores }
    // Só a versão "senha de verdade" precisa liberar o campo na 1ª interação
    const travaAteInteragir = !!semAutocompletar && !mascaraCss && !liberado
    const liberar = (el: HTMLInputElement) => { el.readOnly = false; setLiberado(true) }

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={show || mascaraCss ? 'text' : 'password'}
            className={cn(
              'h-10 w-full rounded-lg border px-3 pr-10 text-sm transition-colors',
              'focus:outline-none focus:ring-2',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'placeholder:text-gray-400',
              error ? 'border-red-400 focus:ring-red-300' : 'focus:ring-[var(--color-brand)]',
              className
            )}
            style={{
              borderColor: error ? undefined : 'var(--color-bg-surface)',
              backgroundColor: '#fff',
              color: 'var(--color-text-primary)',
              ...(mascaraCss && { WebkitTextSecurity: show ? 'none' : 'disc' }),
            }}
            {...props}
            {...antiAutofill}
            name={name}
            onFocus={onFocus}
            // Libera na primeira interação de verdade (tecla, clique, colar) — não no foco, que o autoFocus dispara sozinho.
            // Tira o readOnly direto no elemento para a própria tecla/colagem já valer.
            onKeyDown={(e) => { if (travaAteInteragir) liberar(e.currentTarget); props.onKeyDown?.(e) }}
            onPointerDown={(e) => { if (travaAteInteragir) liberar(e.currentTarget); props.onPointerDown?.(e) }}
            onPaste={(e) => { if (travaAteInteragir) liberar(e.currentTarget); props.onPaste?.(e) }}
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            tabIndex={-1}
            aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
            className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {show ? (
              /* Olho fechado */
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              /* Olho aberto */
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
        {error && <p className="text-xs" style={{ color: 'var(--color-error)' }}>{error}</p>}
        {hint && !error && <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{hint}</p>}
      </div>
    )
  }
)
PasswordInput.displayName = 'PasswordInput'
