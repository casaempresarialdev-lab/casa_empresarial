import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCertificates } from './queries'
import { temPinCadastrado } from '@/lib/security-pin'
import { CertificadosClient } from './components/certificados-client'

export const dynamic = 'force-dynamic'

export default async function CertificadoDigitalPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  const [{ certificates, error }, temPin] = await Promise.all([getCertificates(companyId), temPinCadastrado(user.id)])

  return (
    <div className="w-full">
      <CertificadosClient certificates={certificates} loadError={error} companyId={companyId} temPin={temPin} />
    </div>
  )
}
