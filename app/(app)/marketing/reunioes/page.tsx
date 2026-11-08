import { ComingSoon } from '@/components/layout/coming-soon'
import { exigirAcessoPagina } from '@/lib/auth/acesso'

export default async function Page() {
  await exigirAcessoPagina('pessoas.reunioes')

  return <ComingSoon title="Reuniões" description="Reuniões de marketing" />
}
