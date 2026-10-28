'use client'

import { useRouter } from 'next/navigation'
import { BOTAO_ERRO_SECUNDARIO, ESTILO_ERRO_SECUNDARIO } from './error-screen'

// "Voltar" para a página anterior (sem histórico, vai para o início)
export function BotaoVoltar() {
  const router = useRouter()
  return (
    <button
      type="button"
      onClick={() => (window.history.length > 1 ? router.back() : router.push('/dashboard'))}
      className={BOTAO_ERRO_SECUNDARIO}
      style={ESTILO_ERRO_SECUNDARIO}
    >
      ← Voltar
    </button>
  )
}
