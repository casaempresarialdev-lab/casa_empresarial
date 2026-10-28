'use client'

import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createClient } from '@/lib/supabase/client'
import { codigo2faSchema, type Codigo2faData } from '@/lib/validations/perfil'
import { CodeInput } from '@/components/ui/code-input'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'

interface Props {
  /** Código confirmado: sessão já está no nível de 2 fatores */
  onVerified: () => void
  /** Conta sem 2FA (não deveria chegar aqui) */
  onSemFator: () => void
  onSair: () => void
}

// Segunda etapa do login: código de 6 números do app autenticador
export function Verificacao2faForm({ onVerified, onSemFator, onSair }: Props) {
  const [supabase] = useState(() => createClient())
  const [factorId, setFactorId] = useState<string | null>(null)

  const { control, handleSubmit, setError, formState: { errors, isSubmitting } } =
    useForm<Codigo2faData>({ resolver: zodResolver(codigo2faSchema), defaultValues: { code: '' } })

  useEffect(() => {
    supabase.auth.mfa.listFactors().then(({ data }) => {
      const id = data?.totp[0]?.id
      if (id) setFactorId(id)
      else onSemFator()
    })
  }, [supabase, onSemFator])

  async function onSubmit({ code }: Codigo2faData) {
    if (!factorId) return
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code })
    if (error) { setError('code', { message: 'Código inválido ou expirado. Confira o app e tente de novo.' }); return }
    onVerified()
  }

  return (
    <div>
      <span className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}>
        <Icon name="shield" size={22} />
      </span>
      <h1 className="text-xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
        Verificação em 2 etapas
      </h1>
      <p className="text-sm mt-1 mb-8" style={{ color: 'var(--color-text-muted)' }}>
        Abra o aplicativo de autenticação que você utiliza e digite o código de 6 números da Casa Empresarial.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Controller
          control={control}
          name="code"
          render={({ field }) => (
            <CodeInput label="Código" autoFocus value={field.value} onChange={field.onChange} error={errors.code?.message} />
          )}
        />
        <Button type="submit" loading={isSubmitting} disabled={!factorId} size="lg" className="w-full mt-2" style={{ backgroundColor: 'var(--color-brand)', color: '#fff' }}>
          Verificar
        </Button>
      </form>

      <p className="text-center text-sm mt-6" style={{ color: 'var(--color-text-muted)' }}>
        Não é você ou está sem o celular?{' '}
        <button type="button" onClick={onSair} className="font-medium hover:underline cursor-pointer" style={{ color: 'var(--color-brand)' }}>
          Sair
        </button>
      </p>
    </div>
  )
}
