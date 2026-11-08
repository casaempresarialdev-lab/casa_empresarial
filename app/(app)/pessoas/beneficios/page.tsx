import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getViewerContext } from '@/lib/auth/viewer'
import { getCompanyBenefits, getEmployeesWithBenefits } from './queries'
import { BeneficiosClient } from './components/beneficios-client'
import { MeusBeneficios } from './components/meus-beneficios'
import { exigirAcessoPagina } from '@/lib/auth/acesso'

export const dynamic = 'force-dynamic'

export default async function BeneficiosPage() {
  await exigirAcessoPagina('pessoas.beneficios')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  const viewer = await getViewerContext(companyId)

  const [benefits, employees] = await Promise.all([
    getCompanyBenefits(companyId),
    getEmployeesWithBenefits(companyId),
  ])

  if (viewer?.isColaborador) {
    const me = employees.find(e => e.id === viewer.myEmployeeId)
    if (!me) notFound()
    return (
      <div className="w-full">
        <MeusBeneficios employee={me} benefits={benefits} />
      </div>
    )
  }

  // Fotos em bucket privado: links temporários (1h)
  const admin = createAdminClient()
  const photoUrls: Record<string, string> = {}
  await Promise.all(employees.filter((e) => e.foto_path).map(async (e) => {
    const { data } = await admin.storage.from('documentos').createSignedUrl(e.foto_path!, 3600)
    if (data?.signedUrl) photoUrls[e.id] = data.signedUrl
  }))

  return (
    <div className="w-full">
      <BeneficiosClient companyId={companyId} benefits={benefits} employees={employees} photoUrls={photoUrls} />
    </div>
  )
}
