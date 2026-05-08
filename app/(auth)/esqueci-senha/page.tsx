'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { esqueciSenhaSchema, type EsqueciSenhaData } from '@/lib/validations/auth'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function EsqueciSenhaPage() {
  const [sent, setSent] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EsqueciSenhaData>({ resolver: zodResolver(esqueciSenhaSchema) })

  async function onSubmit(data: EsqueciSenhaData) {
    const supabase = createClient()
    await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/nova-senha`,
    })
    // Sempre mostra sucesso para não revelar se o e-mail existe
    setSent(true)
  }

  if (sent) {
    return (
      <div className="w-full">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-primary-darker)' }}>
            Casa Empresarial
          </h1>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border p-8 text-center" style={{ borderColor: 'var(--color-bg-surface)' }}>
          <div className="text-4xl mb-4">✉️</div>
          <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
            E-mail enviado!
          </h2>
          <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
            Se este e-mail estiver cadastrado, você receberá um link para redefinir sua senha em breve. Verifique também a pasta de spam.
          </p>
          <Link href="/login" className="text-sm font-medium hover:underline" style={{ color: 'var(--color-primary-dark)' }}>
            Voltar ao login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-primary-darker)' }}>
          Casa Empresarial
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
          Recuperar acesso à conta
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border p-8" style={{ borderColor: 'var(--color-bg-surface)' }}>
        <h2 className="text-lg font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
          Esqueceu sua senha?
        </h2>
        <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
          Informe seu e-mail e enviaremos um link para criar uma nova senha.
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

          <Button type="submit" loading={isSubmitting} size="lg" className="w-full mt-2">
            Enviar link de recuperação
          </Button>
        </form>

        <p className="text-center text-sm mt-6" style={{ color: 'var(--color-text-muted)' }}>
          <Link href="/login" className="font-medium hover:underline" style={{ color: 'var(--color-primary-dark)' }}>
            ← Voltar ao login
          </Link>
        </p>
      </div>
    </div>
  )
}
