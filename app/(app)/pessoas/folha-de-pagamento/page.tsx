import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getViewerContext } from '@/lib/auth/viewer'
import { montarFolha } from './queries'
import { getCompany } from '../../empresa/queries'
import { FolhaClient } from './components/folha-client'
import { exigirAcessoPagina } from '@/lib/auth/acesso'

export const dynamic = 'force-dynamic'

export default async function FolhaPagamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; ano?: string }>
}) {
  await exigirAcessoPagina('pessoas.folha-de-pagamento')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  const params = await searchParams
  const [anoAtual, mesAtual] = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date()).split('-')
  const mes = (params.mes ?? mesAtual).padStart(2, '0')
  const ano = params.ano ?? anoAtual
  const mesAno = `${ano}-${mes}`

  const viewer = await getViewerContext(companyId)
  if (viewer?.isColaborador && !viewer.myEmployeeId) notFound()

  const [folha, company] = await Promise.all([montarFolha(companyId, mesAno), getCompany(companyId)])

  // Colaborador só recebe a própria linha
  const linhas = viewer?.isColaborador ? folha.linhas.filter((l) => l.employee.id === viewer.myEmployeeId) : folha.linhas

  return (
    <div className="w-full">
      <FolhaClient
        linhas={linhas}
        fechada={folha.fechada}
        mesAno={mesAno}
        company={company}
        companyId={companyId}
        readOnly={viewer?.isColaborador ?? false}
      />
    </div>
  )
}
