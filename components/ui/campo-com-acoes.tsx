// Campo e botões na mesma linha (no celular os botões descem). Os botões se alinham com a caixa de digitação,
// abaixo do rótulo: 24px de rótulo no campo comum; no código em caixinhas (56px de altura), centralizados nelas.
export function CampoComAcoes({ children, acoes, codigo }: { children: React.ReactNode; acoes: React.ReactNode; codigo?: boolean }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-3">
      <div className="flex-1 min-w-0">{children}</div>
      <div className={`flex justify-end gap-2 shrink-0 ${codigo ? 'sm:pt-8' : 'sm:pt-6'}`}>{acoes}</div>
    </div>
  )
}
