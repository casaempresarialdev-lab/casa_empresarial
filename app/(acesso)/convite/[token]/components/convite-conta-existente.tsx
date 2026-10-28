'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { aceitarComContaExistenteAction } from '../actions'

// O e-mail do convite já tem conta: aceita e segue para o login com a senha de sempre
export function ConviteContaExistente({ token, email }: { token: string; email: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function aceitar() {
    setLoading(true)
    setError(null)
    const result = await aceitarComContaExistenteAction(token)
    setLoading(false)
    if ('error' in result) { setError(result.error ?? 'Não foi possível concluir.'); return }
    router.push(`/login?email=${encodeURIComponent(email)}`)
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        O e-mail <strong>{email}</strong> já tem uma conta na Casa Empresarial. Aceite o convite e entre com a senha que você já usa.
      </p>
      {error && (
        <p className="text-sm text-center py-2 px-3 rounded-lg bg-red-50 border border-red-200" style={{ color: 'var(--color-error)' }}>
          {error}
        </p>
      )}
      <Button type="button" onClick={aceitar} loading={loading} size="lg" className="w-full" style={{ backgroundColor: 'var(--color-brand)', color: '#fff' }}>
        Aceitar convite
      </Button>
    </div>
  )
}
