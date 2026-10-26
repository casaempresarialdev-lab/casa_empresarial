'use client'

import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode
  error?: string
  hint?: string
  /** Destaca o campo com borda vermelha, sem mensagem (ex.: obrigatório não preenchido, aviso via toast) */
  invalid?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, invalid, id, ...props }, ref) => {
    const inputId = id ?? (typeof label === 'string' ? label.toLowerCase().replace(/\s+/g, '-') : undefined)
    const hasError = !!error || !!invalid

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'h-10 w-full rounded-lg border px-3 text-sm transition-colors',
            'focus:outline-none focus:ring-2',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'placeholder:text-gray-400',
            hasError
              ? 'border-red-400 focus:ring-red-300'
              : 'focus:ring-[var(--color-brand)]',
            className
          )}
          aria-invalid={hasError || undefined}
          style={{
            borderColor: hasError ? undefined : 'var(--color-bg-surface)',
            backgroundColor: '#fff',
            color: 'var(--color-text-primary)',
          }}
          {...props}
        />
        {error && (
          <p className="text-xs" style={{ color: 'var(--color-error)' }}>
            {error}
          </p>
        )}
        {hint && !error && (
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {hint}
          </p>
        )}
      </div>
    )
  }
)
Input.displayName = 'Input'
