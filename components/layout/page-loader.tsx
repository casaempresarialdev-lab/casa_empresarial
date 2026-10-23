// Logo reduzida pulsando (reduz e amplia) — usada no loading.tsx e na transição entre páginas
export function PageLoader() {
  return (
    <div className="page-loader flex items-center justify-center min-h-[70vh]" role="status" aria-label="Carregando">
      <div
        className="w-24 h-24 rounded-full bg-white border shadow-md flex items-center justify-center"
        style={{ borderColor: 'var(--color-card-border)' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-casa-empresarial-reduzida.svg" alt="" className="page-loader-logo w-12 h-12" />
      </div>
    </div>
  )
}
