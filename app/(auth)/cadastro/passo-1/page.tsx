'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { cadastroPasso1Schema, type CadastroPasso1Data } from '@/lib/validations/auth'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { saveCpfAction } from './actions'

function maskCpf(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

export default function CadastroPasso1Page() {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CadastroPasso1Data>({ resolver: zodResolver(cadastroPasso1Schema) })

  async function onSubmit(data: CadastroPasso1Data) {
    setServerError(null)
    const supabase = createClient()

    const { error, data: signUpData } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: { data: { name: data.name, cpf: data.cpf.replace(/\D/g, '') } },
    })

    if (error) {
      if (error.message.includes('already')) {
        setServerError('Este e-mail já está cadastrado. Faça login.')
      } else {
        setServerError(`Erro ao criar conta: ${error.message}`)
      }
      return
    }

    if (signUpData.user) {
      await saveCpfAction(signUpData.user.id, data.cpf)
    }

    router.push('/cadastro/passo-2')
  }

  return (
    <div className="w-full">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-primary-darker)' }}>
          Casa Empresarial
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
          Crie sua conta gratuitamente
        </p>
      </div>

      {/* Progress */}
      <div className="flex gap-2 mb-2">
        <div className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: 'var(--color-primary-dark)' }} />
        <div className="flex-1 h-1.5 rounded-full" style={{ backgroundColor: 'var(--color-bg-surface)' }} />
      </div>
      <p className="text-xs mb-6 text-center" style={{ color: 'var(--color-text-muted)' }}>
        Passo 1 de 2 — Seus dados
      </p>

      <div className="bg-white rounded-2xl shadow-sm border p-8" style={{ borderColor: 'var(--color-bg-surface)' }}>
        <h2 className="text-lg font-semibold mb-6" style={{ color: 'var(--color-text-primary)' }}>
          Dados pessoais
        </h2>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Input
            label="Nome completo"
            type="text"
            placeholder="Seu nome"
            autoComplete="name"
            error={errors.name?.message}
            {...register('name')}
          />

          <Input
            label="CPF"
            type="text"
            placeholder="000.000.000-00"
            inputMode="numeric"
            maxLength={14}
            error={errors.cpf?.message}
            {...register('cpf', {
              onChange: (e) => {
                const masked = maskCpf(e.target.value)
                e.target.value = masked
                setValue('cpf', masked, { shouldValidate: false })
              },
            })}
          />

          <Input
            label="E-mail"
            type="email"
            placeholder="seu@email.com"
            autoComplete="email"
            error={errors.email?.message}
            {...register('email')}
          />

          <Input
            label="Senha"
            type="password"
            placeholder="Mínimo 8 caracteres"
            autoComplete="new-password"
            hint="Pelo menos 8 caracteres, uma maiúscula e um número"
            error={errors.password?.message}
            {...register('password')}
          />

          <Input
            label="Confirmar senha"
            type="password"
            placeholder="Repita a senha"
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />

          <div className="flex items-start gap-2 mt-1">
            <input
              type="checkbox"
              id="acceptTerms"
              className="mt-0.5 h-4 w-4 rounded"
              style={{ accentColor: 'var(--color-primary-dark)' }}
              {...register('acceptTerms')}
            />
            <label htmlFor="acceptTerms" className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Li e concordo com os{' '}
              <Link href="/cadastro/termos" target="_blank" className="font-medium hover:underline" style={{ color: 'var(--color-primary-dark)' }}>
                Termos de Uso
              </Link>
            </label>
          </div>
          {errors.acceptTerms && (
            <p className="text-xs -mt-2" style={{ color: 'var(--color-error)' }}>
              {errors.acceptTerms.message}
            </p>
          )}

          {serverError && (
            <p className="text-sm text-center py-2 px-3 rounded-lg bg-red-50 border border-red-200" style={{ color: 'var(--color-error)' }}>
              {serverError}
            </p>
          )}

          <Button type="submit" loading={isSubmitting} size="lg" className="w-full mt-2">
            Continuar →
          </Button>
        </form>

        <p className="text-center text-sm mt-6" style={{ color: 'var(--color-text-muted)' }}>
          Já tem conta?{' '}
          <Link href="/login" className="font-medium hover:underline" style={{ color: 'var(--color-primary-dark)' }}>
            Entrar
          </Link>
        </p>
      </div>
    </div>
  )
}
