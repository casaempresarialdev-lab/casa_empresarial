import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCompany } from '../../empresa/queries'
import { CertificadoForm } from './components/certificado-form'

export const dynamic = 'force-dynamic'

export default async function CertificadoDigitalPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  const company = await getCompany(companyId)
  if (!company) redirect('/empresa')

  return <CertificadoForm companyId={companyId} hasCertificado={!!company.certificado_digital_url} />
}
