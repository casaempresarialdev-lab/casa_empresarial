// Ícone da empresa pulsando (reduz e amplia) — usado no loading.tsx e na transição entre páginas.
// A imagem vem da variável CSS --brand-icon (definida no layout); sem ela, usa o símbolo padrão.
export function PageLoader() {
  return (
    <div className="page-loader flex items-center justify-center min-h-[70vh]" role="status" aria-label="Carregando">
      <div
        className="w-24 h-24 rounded-full bg-white border shadow-md flex items-center justify-center"
        style={{ borderColor: 'var(--color-card-border)' }}
      >
        <div className="page-loader-logo w-12 h-12" />
      </div>
    </div>
  )
}
