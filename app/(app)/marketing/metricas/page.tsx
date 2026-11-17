import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { exigirAcessoPagina } from '@/lib/auth/acesso'
import { getMetricasRedesSociais } from './queries'
import { MetricasClient } from './components/metricas-client'

export const dynamic = 'force-dynamic'

export default async function MetricasRedesSociaisPage() {
  await exigirAcessoPagina('marketing.metricas')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const companyId = (await cookies()).get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  const metricas = await getMetricasRedesSociais(companyId)

  return (
    <div className="w-full">
      <MetricasClient metricas={metricas} companyId={companyId} />
    </div>
  )
}
