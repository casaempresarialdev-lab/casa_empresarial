import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getViewerContext } from '@/lib/auth/viewer'
import { montarFolha } from './queries'
import { montarDecimo } from './queries-decimo'
import { getHoleritesEnviados } from './recibos'
import { getCompany } from '../../empresa/queries'
import { FolhaClient } from './components/folha-client'
import { DecimoClient } from './components/decimo-client'
import { exigirAcessoPagina } from '@/lib/auth/acesso'

export const dynamic = 'force-dynamic'

export default async function FolhaPagamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; ano?: string; aba?: string; parcela?: string }>
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
  const ano = /^\d{4}$/.test(params.ano ?? '') ? params.ano! : anoAtual
  const mesAno = `${ano}-${mes}`

  // O colaborador acompanha pelo holerite, quando a empresa disponibiliza
  const viewer = await getViewerContext(companyId)
  if (viewer?.isColaborador) redirect('/meu-holerite')

  // 13º salário: aba própria, por ano e parcela (a 2ª a partir de dezembro, ou se escolhida)
  if (params.aba === 'decimo') {
    const parcela = params.parcela === '2' || (!params.parcela && Number(mesAtual) === 12 && ano === anoAtual) ? 2 : 1
    const [decimo, company] = await Promise.all([montarDecimo(companyId, Number(ano), parcela), getCompany(companyId)])
    return (
      <div className="w-full">
        <DecimoClient decimo={decimo} company={company} companyId={companyId} />
      </div>
    )
  }

  const [folha, company, enviados] = await Promise.all([
    montarFolha(companyId, mesAno),
    getCompany(companyId),
    getHoleritesEnviados(createAdminClient(), companyId, { competencia: mesAno }),
  ])

  return (
    <div className="w-full">
      <FolhaClient
        linhas={folha.linhas}
        fechada={folha.fechada}
        mesAno={mesAno}
        company={company}
        companyId={companyId}
        readOnly={false}
        periodo={folha.periodo}
        vencimentos={folha.vencimentos}
        responsavel={folha.config.responsavel_calculo}
        holeriteFonte={folha.config.holerite_ativo ? folha.config.holerite_fonte : null}
        enviados={enviados}
      />
    </div>
  )
}
