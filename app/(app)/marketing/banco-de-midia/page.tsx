import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { exigirAcessoPagina } from '@/lib/auth/acesso'
import { getMediaAssets } from './queries'
import { BancoMidiaClient } from './components/banco-midia-client'

export const dynamic = 'force-dynamic'

export default async function BancoDeMidiaPage() {
  await exigirAcessoPagina('marketing.bancomidia')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const companyId = (await cookies()).get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  const midias = await getMediaAssets(companyId)

  return (
    <div className="w-full">
      <BancoMidiaClient midias={midias} companyId={companyId} />
    </div>
  )
}
