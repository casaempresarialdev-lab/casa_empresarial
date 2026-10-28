'use client' // Error boundaries precisam ser Client Components

import './globals.css'
import { useEffect } from 'react'
import { ErrorScreen, BOTAO_ERRO_PRIMARIO, BOTAO_ERRO_SECUNDARIO, ESTILO_ERRO_PRIMARIO, ESTILO_ERRO_SECUNDARIO } from '@/components/ui/error-screen'

// Erro no próprio layout raiz (raro): substitui a página inteira, por isso define <html> e <body>
export default function GlobalError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  useEffect(() => { console.error(error) }, [error])

  return (
    <html lang="pt-BR" className="h-full">
      <body className="min-h-full flex flex-col antialiased">
        <title>Erro · Casa Empresarial</title>
        <ErrorScreen
          telaCheia
          codigo="500"
          titulo="O sistema está com um problema"
          mensagem="Não foi possível carregar a Casa Empresarial agora. Tente de novo em instantes."
          detalhe={error.digest ? `Código do erro: ${error.digest}` : undefined}
          acoes={
            <>
              <a href="/login" className={BOTAO_ERRO_SECUNDARIO} style={ESTILO_ERRO_SECUNDARIO}>Ir para o login</a>
              <button type="button" onClick={() => unstable_retry()} className={BOTAO_ERRO_PRIMARIO} style={ESTILO_ERRO_PRIMARIO}>Tentar de novo</button>
            </>
          }
        />
      </body>
    </html>
  )
}
