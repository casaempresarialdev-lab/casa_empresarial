'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { aceitarConviteSchema, type AceitarConviteData } from '@/lib/validations/auth'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Button } from '@/components/ui/button'
import { aceitarConviteAction } from '../actions'

function formatCpf(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`
}

// Criação da conta pelo convite: e-mail fixo (é o do convite), nome, CPF e senha
export function ConviteForm({ token, email }: { token: string; email: string }) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<AceitarConviteData>({ resolver: zodResolver(aceitarConviteSchema) })

  async function onSubmit(data: AceitarConviteData) {
    setServerError(null)
    const result = await aceitarConviteAction(token, data)
    if ('error' in result) { setServerError(result.error ?? 'Não foi possível concluir.'); return }
    // Senha criada: segue para o login com o e-mail preenchido
    router.push(`/login?senha=criada&email=${encodeURIComponent(result.email ?? email)}`)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Input label="E-mail" value={email} readOnly className="bg-gray-50 cursor-not-allowed" />
      <Input label="Nome completo" placeholder="Seu nome" autoComplete="name" error={errors.name?.message} {...register('name')} />
      <Input
        label="CPF"
        placeholder="000.000.000-00"
        inputMode="numeric"
        error={errors.cpf?.message}
        {...register('cpf', { onChange: (e) => { e.target.value = formatCpf(e.target.value) } })}
      />
      <PasswordInput
        label="Crie sua senha"
        placeholder="••••••••"
        autoComplete="new-password"
        hint="Mínimo de 8 caracteres, com uma letra maiúscula e um número."
        error={errors.password?.message}
        {...register('password')}
      />
      <PasswordInput
        label="Confirme a senha"
        placeholder="••••••••"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...register('confirmPassword')}
      />

      {serverError && (
        <p className="text-sm text-center py-2 px-3 rounded-lg bg-red-50 border border-red-200" style={{ color: 'var(--color-error)' }}>
          {serverError}
        </p>
      )}

      <Button type="submit" loading={isSubmitting} size="lg" className="w-full mt-2" style={{ backgroundColor: 'var(--color-brand)', color: '#fff' }}>
        Cadastrar senha
      </Button>
    </form>
  )
}
