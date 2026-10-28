import { Icon, type IconName } from '@/components/ui/icon'

// Mesmas áreas e ícones do menu lateral (components/layout/sidebar.tsx)
const AREAS: { label: string; icon: IconName }[] = [
  { label: 'Administrativo', icon: 'file' },
  { label: 'Financeiro', icon: 'dollar' },
  { label: 'Pessoas', icon: 'users' },
  { label: 'Operacional', icon: 'briefcase' },
  { label: 'Marketing', icon: 'megaphone' },
]

// Layout das telas de acesso (login, convite…): painel de marca à esquerda, conteúdo à direita
export function AcessoShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex p-4 md:p-6 lg:p-8 overflow-x-clip" style={{ backgroundColor: 'var(--color-bg-default)' }}>
      {/* Painel de marca — oculto no mobile. Fica na frente: o conteúdo pode deslizar para trás dele */}
      <aside
        className="hidden md:flex md:w-1/2 rounded-3xl relative z-10 overflow-hidden flex-col items-center justify-center px-6 lg:px-10 py-12"
        style={{ background: 'linear-gradient(160deg, var(--color-brand) 0%, #8C7448 100%)' }}
      >
        <div aria-hidden className="absolute inset-0 pointer-events-none">
          <div className="login-light login-light-a" />
          <div className="login-light login-light-b" />
          <div className="login-light login-light-c" />
          <div className="login-light login-light-d" />
          <div className="login-beam" />
        </div>

        <div className="relative flex flex-col items-center text-center w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-casa-empresarial.svg" alt="Casa Empresarial" className="w-56 lg:w-72 h-auto" />
          <h2
            className="mt-10 font-bold text-white whitespace-nowrap text-[clamp(0.95rem,1.9vw,2.25rem)]"
            style={{ fontFamily: 'Manrope' }}
          >
            A gestão da sua empresa em um só lugar
          </h2>

          <ul className="mt-10 flex flex-wrap justify-center gap-3 max-w-lg">
            {AREAS.map((area, i) => (
              <li
                key={area.label}
                className="login-float flex items-center gap-2 rounded-full bg-white/15 border border-white/25 backdrop-blur-sm px-4 py-2 text-sm font-medium text-white shadow-sm"
                style={{ animationDelay: `${i * -1.2}s` }}
              >
                <Icon name={area.icon} size={16} />
                {area.label}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Conteúdo */}
      <main className="flex-1 flex items-center justify-center px-4 py-10 md:px-12">
        <div className="w-full max-w-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-casa-empresarial-completa.svg" alt="Casa Empresarial" className="w-44 h-auto mx-auto mb-10" />
          {children}
        </div>
      </main>
    </div>
  )
}
