'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { loginSchema, type LoginData } from '@/lib/validations/auth'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Button } from '@/components/ui/button'

const REMEMBER_EMAIL_KEY = 'login_email'

export default function LoginPage() {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [remember, setRemember] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginData>({ resolver: zodResolver(loginSchema) })

  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_EMAIL_KEY)
      if (saved) {
        setValue('email', saved)
        setRemember(true)
      }
    } catch {}
  }, [setValue])

  async function onSubmit(data: LoginData) {
    setServerError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })
    if (error) {
      setServerError(
        error.message.includes('Invalid login credentials')
          ? 'E-mail ou senha incorretos'
          : 'Erro ao entrar. Tente novamente.'
      )
      return
    }
    try {
      if (remember) localStorage.setItem(REMEMBER_EMAIL_KEY, data.email)
      else localStorage.removeItem(REMEMBER_EMAIL_KEY)
    } catch {}
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div
      className="w-full max-w-5xl mx-auto flex flex-col md:flex-row bg-white rounded-2xl shadow-lg border overflow-hidden"
      style={{ borderColor: 'var(--color-bg-surface)' }}
    >
      <div
        className="md:w-1/2 flex items-center justify-center px-8 py-10 md:py-16"
        style={{ backgroundColor: 'var(--color-brand)' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-casa-empresarial.svg" alt="Casa Empresarial" className="w-48 md:w-72 h-auto" />
      </div>

      <div className="md:w-1/2 px-8 py-10 md:px-12 md:py-16">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>
          Bem-vindo de volta!
        </h1>
        <p className="text-sm mt-1 mb-8" style={{ color: 'var(--color-text-muted)' }}>
          Entre para continuar na Casa Empresarial.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Input
            label="E-mail"
            type="email"
            placeholder="seu@email.com"
            autoComplete="email"
            error={errors.email?.message}
            {...register('email')}
          />

          <div className="flex flex-col gap-1">
            <PasswordInput
              label="Senha"
              placeholder="••••••••"
              autoComplete="current-password"
              error={errors.password?.message}
              {...register('password')}
            />
            <div className="flex items-center justify-between mt-2">
              <label className="flex items-center gap-2 text-xs cursor-pointer select-none" style={{ color: 'var(--color-text-muted)' }}>
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 cursor-pointer"
                  style={{ accentColor: 'var(--color-brand)' }}
                />
                Lembrar de mim
              </label>
              <Link href="/esqueci-senha" className="text-xs hover:underline" style={{ color: 'var(--color-brand)' }}>
                Esqueci minha senha
              </Link>
            </div>
          </div>

          {serverError && (
            <p className="text-sm text-center py-2 px-3 rounded-lg bg-red-50 border border-red-200" style={{ color: 'var(--color-error)' }}>
              {serverError}
            </p>
          )}

          <Button type="submit" loading={isSubmitting} size="lg" className="w-full mt-2" style={{ backgroundColor: 'var(--color-brand)', color: '#fff' }}>
            Entrar
          </Button>
        </form>

        <p className="text-center text-sm mt-6" style={{ color: 'var(--color-text-muted)' }}>
          Não tem conta?{' '}
          <Link href="/cadastro/passo-1" className="font-medium hover:underline" style={{ color: 'var(--color-brand)' }}>
            Criar conta grátis
          </Link>
        </p>
      </div>
    </div>
  )
}
