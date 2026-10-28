'use client' // Error boundaries precisam ser Client Components

import { useEffect } from 'react'
import Link from 'next/link'
import { ErrorScreen, BOTAO_ERRO_PRIMARIO, BOTAO_ERRO_SECUNDARIO, ESTILO_ERRO_PRIMARIO, ESTILO_ERRO_SECUNDARIO } from '@/components/ui/error-screen'

// Erro inesperado numa tela da área logada (500): mantém o menu e permite tentar de novo
export default function ErroArea({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  useEffect(() => { console.error(error) }, [error])

  return (
    <ErrorScreen
      codigo="500"
      titulo="Algo deu errado"
      mensagem="Tivemos um problema ao carregar esta tela. Tente de novo; se continuar, fale com o suporte informando o código abaixo."
      detalhe={error.digest ? `Código do erro: ${error.digest}` : undefined}
      acoes={
        <>
          <Link href="/dashboard" className={BOTAO_ERRO_SECUNDARIO} style={ESTILO_ERRO_SECUNDARIO}>Ir para o início</Link>
          <button type="button" onClick={() => unstable_retry()} className={BOTAO_ERRO_PRIMARIO} style={ESTILO_ERRO_PRIMARIO}>Tentar de novo</button>
        </>
      }
    />
  )
}
