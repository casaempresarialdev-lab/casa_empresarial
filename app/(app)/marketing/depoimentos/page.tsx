import { ComingSoon } from '@/components/layout/coming-soon'
import { exigirAcessoPagina } from '@/lib/auth/acesso'

export default async function Page() {
  await exigirAcessoPagina('marketing.depoimentos')

  return <ComingSoon title="Depoimentos" description="Depoimentos de clientes" />
}
