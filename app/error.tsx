'use client' // Error boundaries precisam ser Client Components

import { useEffect } from 'react'
import { ErrorScreen, BOTAO_ERRO_PRIMARIO, BOTAO_ERRO_SECUNDARIO, ESTILO_ERRO_PRIMARIO, ESTILO_ERRO_SECUNDARIO } from '@/components/ui/error-screen'

// Erro inesperado fora da área logada (login, convite, cadastro…): tela inteira
export default function Erro({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  useEffect(() => { console.error(error) }, [error])

  return (
    <ErrorScreen
      telaCheia
      codigo="500"
      titulo="Algo deu errado"
      mensagem="Tivemos um problema ao carregar esta página. Tente de novo em instantes."
      detalhe={error.digest ? `Código do erro: ${error.digest}` : undefined}
      acoes={
        <>
          <a href="/login" className={BOTAO_ERRO_SECUNDARIO} style={ESTILO_ERRO_SECUNDARIO}>Ir para o login</a>
          <button type="button" onClick={() => unstable_retry()} className={BOTAO_ERRO_PRIMARIO} style={ESTILO_ERRO_PRIMARIO}>Tentar de novo</button>
        </>
      }
    />
  )
}
