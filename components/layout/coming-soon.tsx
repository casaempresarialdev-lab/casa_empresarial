import { PageTitle } from './page-title'

// Tela de área ainda não construída, no layout padrão
export function ComingSoon({ title, description }: { title: string; description?: string }) {
  return (
    <div className="w-full">
      <PageTitle title={title} description={description} />
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
