import Link from 'next/link'
import { ErrorScreen, BOTAO_ERRO_PRIMARIO, ESTILO_ERRO_PRIMARIO } from '@/components/ui/error-screen'
import { BotaoVoltar } from '@/components/ui/botao-voltar'

// 404 de endereço que não existe (fora da área logada): tela inteira
export default function NotFound() {
  return (
    <ErrorScreen
      telaCheia
      codigo="404"
      titulo="Página não encontrada"
      mensagem="O endereço que você tentou acessar não existe ou foi movido."
      acoes={
        <>
          <BotaoVoltar />
          <Link href="/dashboard" className={BOTAO_ERRO_PRIMARIO} style={ESTILO_ERRO_PRIMARIO}>Ir para o início</Link>
        </>
      }
    />
  )
}
