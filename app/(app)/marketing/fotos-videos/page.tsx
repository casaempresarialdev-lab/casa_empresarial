import { ComingSoon } from '@/components/layout/coming-soon'
import { exigirAcessoPagina } from '@/lib/auth/acesso'

export default async function Page() {
  await exigirAcessoPagina('marketing.fotos-videos')

  return <ComingSoon title="Fotos e Vídeos" description="Banco de imagens e vídeos da empresa" />
}
