import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { exigirAcessoPagina } from '@/lib/auth/acesso'
import { getCampanhasMarketing } from './queries'
import { CampanhasClient } from './components/campanhas-client'

export const dynamic = 'force-dynamic'

export default async function CampanhasMarketingPage() {
  await exigirAcessoPagina('marketing.campanhas')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const companyId = (await cookies()).get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  const campanhas = await getCampanhasMarketing(companyId)

  return (
    <div className="w-full">
      <CampanhasClient campanhas={campanhas} companyId={companyId} />
    </div>
  )
}
