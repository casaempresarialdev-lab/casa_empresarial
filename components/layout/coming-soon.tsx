import { PageTitle } from './page-title'

// Tela de área ainda não construída, no layout padrão
// (description fica só como referência da área; o cabeçalho não mostra subtítulo)
export function ComingSoon({ title }: { title: string; description?: string }) {
  return (
    <div className="w-full">
      <PageTitle title={title} />
      <div className="app-card p-10 text-center">
        <p className="text-base font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-sidebar-text)' }}>
          Em breve
        </p>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
          Esta área está em construção e estará disponível em breve.
        </p>
      </div>
    </div>
  )
}
