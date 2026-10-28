import { cn } from '@/lib/utils'

interface Props {
  /** Código grande no topo (ex.: 404, 500) */
  codigo: string
  titulo: string
  mensagem: React.ReactNode
  /** Botões/links de ação */
  acoes: React.ReactNode
  /** Detalhe técnico pequeno (ex.: código do erro para o suporte) */
  detalhe?: string
  /** Tela inteira, com a logo (fora da área logada); senão, dentro do layout com o menu */
  telaCheia?: boolean
}

// Visual das páginas de erro (404, 500…): código grande na cor da marca, título, mensagem e ações
export function ErrorScreen({ codigo, titulo, mensagem, acoes, detalhe, telaCheia }: Props) {
  return (
    <div
      className={cn('flex items-center justify-center px-4', telaCheia ? 'min-h-screen py-10' : 'min-h-[70vh] py-10')}
      style={telaCheia ? { backgroundColor: 'var(--color-bg-default)' } : undefined}
    >
      <div className="w-full max-w-md text-center flex flex-col items-center">
        {telaCheia && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/logo-casa-empresarial-completa.svg" alt="Casa Empresarial" className="w-40 h-auto mb-10" />
        )}
        <p
          className="text-7xl sm:text-8xl font-extrabold leading-none tracking-tight animate-enter"
          style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}
        >
          {codigo}
        </p>
        <h1 className="mt-4 text-2xl font-bold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)', animationDelay: '60ms' }}>
          {titulo}
        </h1>
        <div className="mt-2 text-sm animate-enter" style={{ color: 'var(--color-text-muted)', animationDelay: '120ms' }}>
          {mensagem}
        </div>
        <div className="mt-8 w-full flex flex-col sm:flex-row gap-2 justify-center animate-enter" style={{ animationDelay: '180ms' }}>
          {acoes}
        </div>
        {detalhe && (
          <p className="mt-6 text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>{detalhe}</p>
        )}
      </div>
    </div>
  )
}

// Estilos dos botões das páginas de erro (links ou botões)
export const BOTAO_ERRO_PRIMARIO = 'inline-flex items-center justify-center h-11 px-5 rounded-xl text-sm font-semibold text-white cursor-pointer transition-opacity hover:opacity-90'
export const BOTAO_ERRO_SECUNDARIO = 'inline-flex items-center justify-center h-11 px-5 rounded-xl text-sm font-semibold border cursor-pointer transition-colors hover:bg-[var(--color-brand-light)]'
export const ESTILO_ERRO_PRIMARIO = { backgroundColor: 'var(--color-brand)' }
export const ESTILO_ERRO_SECUNDARIO = { borderColor: 'var(--color-brand)', color: 'var(--color-brand)' }
