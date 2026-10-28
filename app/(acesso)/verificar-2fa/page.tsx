'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { INTRO_COOKIE } from '@/components/modules/dashboard/intro'
import { Verificacao2faForm } from '../components/verificacao-2fa-form'

// Código do 2FA fora da tela de login (ex.: recarregou a página no meio do login — o middleware manda para cá)
export default function Verificar2faPage() {
  const router = useRouter()
  const semFator = useCallback(() => router.replace('/dashboard'), [router])

  async function sair() {
    await createClient().auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10" style={{ backgroundColor: 'var(--color-bg-default)' }}>
      <div className="w-full max-w-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-casa-empresarial-completa.svg" alt="Casa Empresarial" className="w-44 h-auto mx-auto mb-10" />
        <Verificacao2faForm
          onVerified={() => {
            document.cookie = `${INTRO_COOKIE}=1; path=/; max-age=60; SameSite=Lax`
            router.push('/dashboard')
            router.refresh()
          }}
          onSemFator={semFator}
          onSair={sair}
        />
      </div>
    </div>
  )
}
