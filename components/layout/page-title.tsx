import { Breadcrumb } from './breadcrumb'

interface PageTitleProps {
  title: string
  actions?: React.ReactNode
}

// Cabeçalho padrão das telas — mesmo estilo da saudação do dashboard, com o breadcrumb à direita, abaixo da barra de ferramentas
export function PageTitle({ title, actions }: PageTitleProps) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>
            {title}
          </h1>
          <Breadcrumb />
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
