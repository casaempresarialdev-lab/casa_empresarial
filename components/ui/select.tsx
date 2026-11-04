'use client'

import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: { value: string; label: string }[]
  placeholder?: string
  /** Destaca o campo com borda vermelha, sem mensagem (aviso via toast) */
  invalid?: boolean
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error: errorMsg, invalid, options, placeholder, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    const error = errorMsg || invalid

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
        <select
          ref={ref}
          id={inputId}
          className={cn(
            'h-10 w-full rounded-lg border px-3 text-sm transition-colors bg-white',
            'focus:outline-none focus:ring-2',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error ? 'border-red-400 focus:ring-red-300' : 'focus:ring-[var(--color-brand)]',
            className
          )}
          style={{
            borderColor: error ? undefined : 'var(--color-bg-surface)',
            color: 'var(--color-text-primary)',
          }}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {errorMsg && (
          <p className="text-xs" style={{ color: 'var(--color-error)' }}>
            {errorMsg}
          </p>
        )}
      </div>
    )
  }
)
Select.displayName = 'Select'
