import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getEmployeeById } from '../queries'
import { getActiveCompanyBenefits } from '../../beneficios/queries'
import { ViewFuncionarioPage } from './components/view-funcionario-page'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function FuncionarioViewPage({ params }: Props) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  const admin = createAdminClient()
  const [employee, companyBenefits, { data: membership }] = await Promise.all([
    getEmployeeById(id, companyId),
    getActiveCompanyBenefits(companyId),
    admin.from('company_members').select('role').eq('company_id', companyId).eq('profile_id', user.id).eq('status', 'active').single(),
  ])

  if (!employee) notFound()

  const viewerRole = membership?.role ?? 'member'

  // Signed URL para foto (bucket privado)
  let fotoUrl: string | null = null
  if (employee.foto_path) {
    const { data } = await admin.storage
      .from('documentos')
      .createSignedUrl(employee.foto_path, 3600)
    fotoUrl = data?.signedUrl ?? null
  }

  return (
    <div className="max-w-3xl mx-auto">
      <ViewFuncionarioPage
        employee={employee}
        companyId={companyId}
        companyBenefits={companyBenefits}
        fotoUrl={fotoUrl}
        viewerRole={viewerRole}
      />
    </div>
  )
}
