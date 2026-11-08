import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getViewerContext } from '@/lib/auth/viewer'
import { getEmployeeById } from '../queries'
import { getActiveCompanyBenefits } from '../../beneficios/queries'
import { getCompany } from '../../../empresa/queries'
import { isSecaoId } from '../components/ficha/ficha-config'
import { FuncionarioPage } from './components/funcionario-page'
import { getRescisaoAtiva } from '../../rescisao/queries'
import { exigirAcessoPagina } from '@/lib/auth/acesso'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ aba?: string }>
}

// Ficha do funcionário (visualizar). A edição (./editar) usa a mesma tela com os campos abertos.
export default async function FuncionarioViewPage({ params, searchParams }: Props) {
  await exigirAcessoPagina('pessoas.funcionarios')

  const [{ id }, { aba }] = await Promise.all([params, searchParams])

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  const [employee, companyBenefits, company, viewer, rescisaoAtiva] = await Promise.all([
    getEmployeeById(id, companyId),
    getActiveCompanyBenefits(companyId),
    getCompany(companyId),
    getViewerContext(companyId),
    getRescisaoAtiva(companyId, id),
  ])
  if (!employee) notFound()

  // Colaborador só vê a própria ficha
  const isColaboradorSelf = !!viewer?.isColaborador
  if (isColaboradorSelf && viewer?.myEmployeeId !== employee.id) notFound()

  // Foto em bucket privado: link temporário (1h)
  let fotoUrl: string | null = null
  if (employee.foto_path) {
    const { data } = await createAdminClient().storage.from('documentos').createSignedUrl(employee.foto_path, 3600)
    fotoUrl = data?.signedUrl ?? null
  }

  return (
    <div className="w-full">
      <FuncionarioPage
        modo="ver"
        employee={employee}
        companyId={companyId}
        company={company}
        companyBenefits={companyBenefits}
        fotoUrl={fotoUrl}
        abaInicial={isSecaoId(aba) ? aba : undefined}
        isColaboradorSelf={isColaboradorSelf}
        rescisaoAtivaId={isColaboradorSelf ? null : rescisaoAtiva?.id ?? null}
      />
    </div>
  )
}
