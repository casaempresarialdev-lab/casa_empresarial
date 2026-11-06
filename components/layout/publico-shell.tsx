import { Icon, type IconName } from '@/components/ui/icon'
import { textoSobreMarca, themeStyle } from '@/lib/theme'

interface ShellProps {
  titulo: string
  /** Empresa do processo; sem ela (link inválido), só a marca */
  empresa?: string
  cor: string | null
  /** Abaixo do título: para quem é, cargo, prazo… */
  destaques?: { icon: IconName; texto: string }[]
  /** Formulários: área mais larga. Sem ela, a largura confortável de leitura (ex.: a carta) */
  largo?: boolean
  children: React.ReactNode
}

// Páginas públicas do candidato (carta, auto-cadastro), no padrão das telas de acesso: painel com a logo, nas cores
// da empresa, e o conteúdo ao lado. No celular o painel vira uma faixa no topo, com o nome da empresa.
export function PublicoShell({ titulo, empresa, cor, destaques = [], largo, children }: ShellProps) {
  const texto = textoSobreMarca(cor)
  return (
    <div className="min-h-screen flex flex-col md:flex-row gap-4 md:gap-0 p-4 md:p-6 lg:p-8" style={{ ...themeStyle(cor), '--cor-sobre-marca': texto, backgroundColor: 'var(--color-bg-default)' } as React.CSSProperties}>
      <aside
        className="md:w-2/5 lg:w-1/3 md:sticky md:top-6 lg:top-8 md:h-[calc(100vh-3rem)] lg:h-[calc(100vh-4rem)] rounded-3xl relative overflow-hidden flex flex-col px-6 py-7 md:px-8 md:py-10 shrink-0"
        style={{ background: 'linear-gradient(160deg, var(--color-brand) 0%, var(--color-primary-darker) 100%)', color: texto }}
      >
        <div aria-hidden className="absolute inset-0 pointer-events-none">
          <div className="login-light login-light-a" />
          <div className="login-light login-light-b" />
        </div>

        {/* Mesma logo e posição do painel da tela de login */}
        <div className="relative flex flex-col items-center justify-center text-center flex-1 min-h-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-casa-empresarial.svg"
            alt="Casa Empresarial"
            className="w-36 md:w-44 lg:w-56 h-auto"
            style={texto === '#FFFFFF' ? undefined : { filter: 'brightness(0)' }}
          />
          <p className="text-sm font-medium opacity-80 mt-8 md:mt-10">{empresa ? `${empresa} · Processo de admissão` : 'Processo de admissão'}</p>
          <h1 className="text-3xl lg:text-4xl font-extrabold mt-1" style={{ fontFamily: 'Manrope', color: 'inherit' }}>
            {titulo}
          </h1>
          {destaques.length > 0 && (
            <ul className="mt-5 flex flex-col gap-2 items-center max-w-full">
              {destaques.map((d) => (
                <li key={d.texto} className="flex items-center gap-2 rounded-full bg-white/15 border border-white/25 backdrop-blur-sm px-3.5 py-1.5 text-sm font-medium max-w-full">
                  <span className="shrink-0"><Icon name={d.icon} size={15} /></span>
                  <span className="truncate">{d.texto}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      <main className={`flex-1 min-w-0 flex md:py-4 ${largo ? 'md:px-6 lg:px-10' : 'md:px-8 lg:px-14'}`}>
        <div className={`w-full mx-auto md:my-auto flex flex-col gap-5 ${largo ? 'max-w-5xl' : 'max-w-2xl'}`}>{children}</div>
      </main>
    </div>
  )
}

/** Situação quando não há mais o que fazer na página (aceita, expirada, já preenchido…) */
export function PublicoAviso({ icon, titulo, texto, tom = 'marca' }: { icon: IconName; titulo: string; texto: string; tom?: 'marca' | 'sucesso' }) {
  const cores = tom === 'sucesso'
    ? { backgroundColor: '#DCFCE7', color: '#15803D' }
    : { backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }
  return (
    <div className="app-card p-8 flex flex-col items-center text-center gap-3">
      <span className="w-14 h-14 rounded-full flex items-center justify-center" style={cores}>
        <Icon name={icon} size={26} />
      </span>
      <h2 className="text-xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>{titulo}</h2>
      <p className="text-sm max-w-sm" style={{ color: 'var(--color-text-muted)' }}>{texto}</p>
    </div>
  )
}
