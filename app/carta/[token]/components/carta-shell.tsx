import { PublicoAviso, PublicoShell } from '@/components/layout/publico-shell'

export const CartaAviso = PublicoAviso

// Página pública da carta: o painel padrão das páginas do candidato
export function CartaShell(props: Omit<React.ComponentProps<typeof PublicoShell>, 'titulo'>) {
  return <PublicoShell titulo="Carta proposta" {...props} />
}
