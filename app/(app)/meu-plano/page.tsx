import { ComingSoon } from '@/components/layout/coming-soon'
import { exigirAcessoPagina } from '@/lib/auth/acesso'

export default async function Page() {
  await exigirAcessoPagina('sistema.meu-plano')

  return <ComingSoon title="Meu Plano" description="Assinatura e cobrança" />
}
