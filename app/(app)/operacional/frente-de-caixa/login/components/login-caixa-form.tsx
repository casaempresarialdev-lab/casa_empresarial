'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Button } from '@/components/ui/button'
import { openCashSessionAction } from '../../actions'

export function LoginCaixaForm({ companyId }: { companyId: string }) {
  const router = useRouter()
  const [senha, setSenha] = useState('')
  const [saldoAbertura, setSaldoAbertura] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const fd = new FormData()
    fd.set('senha', senha)
    fd.set('saldo_abertura', saldoAbertura)

    const result = await openCashSessionAction(companyId, fd)

    setLoading(false)
    if ('error' in result) { setError(result.error ?? 'Erro ao abrir o caixa.'); return }
    router.push('/operacional/frente-de-caixa')
    router.refresh()
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border p-8" style={{ borderColor: 'var(--color-bg-surface)' }}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <PasswordInput
          label="Confirme sua senha"
          placeholder="••••••••"
          autoComplete="current-password"
          value={senha}
          onChange={e => setSenha(e.target.value)}
          autoFocus
        />

        <div>
          <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            Saldo inicial (opcional)
          </label>
          <Input
            value={saldoAbertura}
            onChange={e => setSaldoAbertura(e.target.value)}
            placeholder="0,00"
            inputMode="decimal"
            className="mt-1"
          />
        </div>

        {error && (
          <p className="text-sm text-center py-2 px-3 rounded-lg bg-red-50 border border-red-200" style={{ color: 'var(--color-error)' }}>
            {error}
          </p>
        )}

        <Button type="submit" loading={loading} size="lg" className="w-full mt-2" disabled={!senha}>
          Abrir Caixa
        </Button>
      </form>
    </div>
  )
}
