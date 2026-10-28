'use client'

import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { loginSchema, type LoginData } from '@/lib/validations/auth'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Button } from '@/components/ui/button'
import { AcessoShell } from '../components/acesso-shell'
import { INTRO_COOKIE } from '@/components/modules/dashboard/intro'
import { Verificacao2faForm } from '../components/verificacao-2fa-form'

const REMEMBER_EMAIL_KEY = 'login_email'

// Troca de etapa: o código entra pela direita e empurra o login para trás do painel de marca
const SLIDE = 'transform 700ms cubic-bezier(0.65, 0, 0.35, 1), opacity 350ms ease'

export default function LoginPage() {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [remember, setRemember] = useState(false)
  // Vindo do convite: "senha criada, agora entre"
  const [senhaCriada, setSenhaCriada] = useState(false)
  // Etapa do login: senha → código do app (contas com 2 fatores)
  const [step, setStep] = useState<'senha' | 'codigo'>('senha')
  const codigo = step === 'codigo'

  const {
    register,
    handleSubmit,
    setValue,
    resetField,
    formState: { errors, isSubmitting },
  } = useForm<LoginData>({ resolver: zodResolver(loginSchema) })

  const entrar = useCallback(() => {
    // Intro do dashboard (título digitado) só nesta primeira visita — ver components/modules/dashboard/intro.tsx
    document.cookie = `${INTRO_COOKIE}=1; path=/; max-age=60; SameSite=Lax`
    router.push('/dashboard')
    router.refresh()
  }, [router])

  // Desistiu na etapa do código: encerra a sessão parcial e volta para a senha
  const voltarParaSenha = useCallback(async () => {
    await createClient().auth.signOut()
    resetField('password')
    setStep('senha')
  }, [resetField])

  useEffect(() => {
    // Convite: e-mail vem na URL (?email=…&senha=criada) e tem prioridade sobre o lembrado
    const params = new URLSearchParams(window.location.search)
    const emailConvite = params.get('email')
    if (params.get('senha') === 'criada') setSenhaCriada(true)
    if (emailConvite) { setValue('email', emailConvite); return }
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
    // Conta com 2 fatores: falta o código do app autenticador
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (aal?.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
      setStep('codigo')
      return
    }
    entrar()
  }

  return (
    <AcessoShell>
      <div className="relative">
        {/* Etapa 1: e-mail e senha */}
        <div
          inert={codigo}
          aria-hidden={codigo}
          className="motion-reduce:transition-none"
          style={{
            // Ao sair, só some depois de já estar atrás do painel
            transition: codigo ? `${SLIDE} 350ms` : SLIDE,
            transform: codigo ? 'translateX(-50vw)' : 'none',
            opacity: codigo ? 0 : 1,
          }}
        >
          <h1 className="text-xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
            Acesse sua conta
          </h1>
          <p className="text-sm mt-1 mb-8" style={{ color: 'var(--color-text-muted)' }}>
            Entre para continuar na Casa Empresarial.
          </p>

          {senhaCriada && (
            <p className="text-sm -mt-4 mb-6 py-2 px-3 rounded-lg" style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-text-primary)' }}>
              Senha cadastrada com sucesso! Agora é só entrar com seu e-mail e a nova senha.
            </p>
          )}

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

        {/* Etapa 2: código do app autenticador (entra pela direita) */}
        <div
          inert={!codigo}
          aria-hidden={!codigo}
          className="absolute inset-x-0 top-0 motion-reduce:transition-none"
          style={{
            transition: SLIDE,
            transform: codigo ? 'none' : 'translateX(50vw)',
            opacity: codigo ? 1 : 0,
          }}
        >
          {codigo && <Verificacao2faForm onVerified={entrar} onSemFator={entrar} onSair={voltarParaSenha} />}
        </div>
      </div>
    </AcessoShell>
  )
}
