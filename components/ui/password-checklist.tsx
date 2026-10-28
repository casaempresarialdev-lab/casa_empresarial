'use client'

import { REGRAS_SENHA } from '@/lib/validations/auth'

// Lista das regras da senha segura, marcadas em tempo real conforme o usuário digita
export function PasswordChecklist({ senha }: { senha: string }) {
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5" aria-label="Requisitos da senha">
      {REGRAS_SENHA.map((r) => {
        const ok = r.test(senha)
        return (
          <li key={r.id} className="flex items-center gap-2 text-xs transition-colors" style={{ color: ok ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
            <span
              className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-colors"
              style={ok
                ? { backgroundColor: 'var(--color-brand)', color: '#fff' }
                : { border: '1.5px solid #D4D4D4' }}
              aria-hidden
            >
              {ok && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </span>
            <span>{r.label}</span>
            <span className="sr-only">{ok ? '(atendido)' : '(pendente)'}</span>
          </li>
        )
      })}
    </ul>
  )
}
