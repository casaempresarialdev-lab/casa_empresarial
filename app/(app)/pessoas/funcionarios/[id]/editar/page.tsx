import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getViewerContext } from '@/lib/auth/viewer'
import { getEmployeeById } from '../../queries'
import { getActiveCompanyBenefits } from '../../../beneficios/queries'
import { getCompany } from '../../../../empresa/queries'
import { isSecaoId } from '../../components/ficha/ficha-config'
import { FuncionarioPage } from '../components/funcionario-page'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ aba?: string }>
}

// Edição da ficha: mesma tela da visualização, com os campos abertos
export default async function FuncionarioEditPage({ params, searchParams }: Props) {
  const [{ id }, { aba }] = await Promise.all([params, searchParams])

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  // Colaborador edita só os próprios dados de contato (Meus Dados, na ficha)
  const viewer = await getViewerContext(companyId)
  if (viewer?.isColaborador) notFound()

  const [employee, companyBenefits, company] = await Promise.all([
    getEmployeeById(id, companyId),
    getActiveCompanyBenefits(companyId),
    getCompany(companyId),
  ])
  if (!employee) notFound()

  let fotoUrl: string | null = null
  if (employee.foto_path) {
    const { data } = await createAdminClient().storage.from('documentos').createSignedUrl(employee.foto_path, 3600)
    fotoUrl = data?.signedUrl ?? null
  }

  return (
    <div className="w-full">
      <FuncionarioPage
        modo="editar"
        employee={employee}
        companyId={companyId}
        company={company}
        companyBenefits={companyBenefits}
        fotoUrl={fotoUrl}
        abaInicial={isSecaoId(aba) ? aba : undefined}
        isColaboradorSelf={false}
      />
    </div>
  )
}
