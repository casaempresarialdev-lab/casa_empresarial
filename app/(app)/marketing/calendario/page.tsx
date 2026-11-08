import { ComingSoon } from '@/components/layout/coming-soon'
import { exigirAcessoPagina } from '@/lib/auth/acesso'

export default async function Page() {
  await exigirAcessoPagina('marketing.calendario')

  return <ComingSoon title="Calendário Editorial" description="Planejamento das publicações" />
}
