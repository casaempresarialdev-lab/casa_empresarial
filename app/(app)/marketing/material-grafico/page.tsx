import { ComingSoon } from '@/components/layout/coming-soon'
import { exigirAcessoPagina } from '@/lib/auth/acesso'

export default async function Page() {
  await exigirAcessoPagina('marketing.material-grafico')

  return <ComingSoon title="Material Gráfico" description="Peças e materiais de divulgação" />
}
