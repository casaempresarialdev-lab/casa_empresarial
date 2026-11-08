import { ComingSoon } from '@/components/layout/coming-soon'
import { exigirAcessoPagina } from '@/lib/auth/acesso'

export default async function Page() {
  await exigirAcessoPagina('marketing.manual-da-marca')

  return <ComingSoon title="Manual da Marca" description="Identidade e padrões da marca" />
}
