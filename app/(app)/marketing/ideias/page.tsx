import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { exigirAcessoPagina } from '@/lib/auth/acesso'
import { getIdeiasMarketing } from './queries'
import { IdeiasClient } from './components/ideias-client'

export const dynamic = 'force-dynamic'

export default async function IdeiasMarketingPage() {
  await exigirAcessoPagina('marketing.ideias')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const companyId = (await cookies()).get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  const ideias = await getIdeiasMarketing(companyId)

  return (
    <div className="w-full">
      <IdeiasClient ideias={ideias} companyId={companyId} />
    </div>
  )
}
