import Link from 'next/link'
import { ErrorScreen, BOTAO_ERRO_PRIMARIO, ESTILO_ERRO_PRIMARIO } from '@/components/ui/error-screen'
import { BotaoVoltar } from '@/components/ui/botao-voltar'

// 404 dentro da área logada (ex.: registro que não existe ou é de outra empresa): mantém o menu
export default function NotFoundArea() {
  return (
    <ErrorScreen
      codigo="404"
      titulo="Não encontramos o que você procura"
      mensagem="Este registro não existe, foi removido ou pertence a outra empresa. Confira se a empresa ativa no menu do usuário é a certa."
      acoes={
        <>
          <BotaoVoltar />
          <Link href="/dashboard" className={BOTAO_ERRO_PRIMARIO} style={ESTILO_ERRO_PRIMARIO}>Ir para o início</Link>
        </>
      }
    />
  )
}
