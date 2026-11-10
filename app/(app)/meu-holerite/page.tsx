import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { exigirAcessoPagina } from '@/lib/auth/acesso'
import { calcularFolha, type AjustesFolha, type ApuracaoPonto, type InsumosFolha } from '@/lib/folha/calculo'
import { ROTULO_DOCUMENTO } from '@/lib/folha/documentos'
import { montarHolerite, type DocumentoHolerite } from '@/lib/folha/holerite'
import { getCompany } from '../empresa/queries'
import { getConfigFolha } from '../pessoas/folha-de-pagamento/queries'
import { getHoleritesEnviados, getRecibos } from '../pessoas/folha-de-pagamento/recibos'
import { MeuHoleriteClient, type ItemHolerite } from './components/meu-holerite-client'

export const dynamic = 'force-dynamic'

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const rotulo = (mesAno: string) => `${MESES[Number(mesAno.slice(5, 7)) - 1]} ${mesAno.slice(0, 4)}`

// Holerites do próprio colaborador, se a empresa disponibilizar: os do sistema (folha fechada, férias e 13º) ou os PDFs da contabilidade
export default async function MeuHoleritePage() {
  await exigirAcessoPagina('visao-geral.bater-ponto')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const companyId = (await cookies()).get('active_company_id')?.value
  if (!companyId) redirect('/dashboard')

  const admin = createAdminClient()
  const [config, company, { data: ficha }] = await Promise.all([
    getConfigFolha(companyId),
    getCompany(companyId),
    admin.from('employees').select('id, nome, cpf, cargo').eq('company_id', companyId).eq('profile_id', user.id).not('status', 'in', '(inativo,demitido)').limit(1).maybeSingle(),
  ])

  const itens: ItemHolerite[] = []
  if (config.holerite_ativo && ficha && config.holerite_fonte === 'arquivo') {
    for (const d of await getHoleritesEnviados(admin, companyId, { employeeId: ficha.id as string })) {
      itens.push({ chave: `a-${d.id}`, ordem: `${d.competencia}-${d.created_at}`, titulo: ROTULO_DOCUMENTO[d.tipo], subtitulo: `${rotulo(d.competencia)} · PDF enviado pela contabilidade`, liquido: null, arquivoId: d.id, documento: null, arquivo: `holerite-${d.competencia}` })
    }
  } else if (config.holerite_ativo && ficha) {
    type Entrada = { mes_ano: string; ajustes: AjustesFolha | null; apuracao: { insumos: InsumosFolha; ponto: ApuracaoPonto } | null }
    const [{ data: entradas }, recibos] = await Promise.all([
      admin.from('payroll_entries').select('mes_ano, ajustes, apuracao').eq('company_id', companyId).eq('employee_id', ficha.id).neq('status', 'rascunho').order('mes_ano', { ascending: false }).limit(36),
      getRecibos(admin, companyId, { employeeId: ficha.id as string }),
    ])
    for (const e of ((entradas ?? []) as Entrada[]).filter((e) => e.apuracao)) {
      const { insumos, ponto } = e.apuracao!
      itens.push({
        chave: `m-${e.mes_ano}`, ordem: `${e.mes_ano}-99`, titulo: rotulo(e.mes_ano), subtitulo: 'Holerite mensal',
        liquido: calcularFolha(insumos, ponto, e.ajustes ?? {}).liquido, arquivoId: null,
        documento: montarHolerite(insumos, ponto, e.ajustes ?? {}), arquivo: `holerite-${e.mes_ano}`,
      })
    }
    for (const r of recibos) {
      const doc = r.dados as DocumentoHolerite
      const ferias = r.tipo === 'ferias'
      itens.push({
        chave: `r-${r.id}`, ordem: `${r.pagamento_em}`,
        titulo: ferias ? 'Recibo de férias' : `13º salário · ${r.tipo === 'decimo_1' ? '1ª' : '2ª'} parcela`,
        subtitulo: ferias ? `Pago em ${r.pagamento_em.split('-').reverse().join('/')}` : `${r.referencia} · pago em ${r.pagamento_em.split('-').reverse().join('/')}`,
        liquido: r.liquido, arquivoId: null, documento: doc,
        arquivo: ferias ? `recibo-ferias-${r.pagamento_em}` : `13-salario-${r.referencia}-${r.tipo === 'decimo_1' ? 1 : 2}a-parcela`,
      })
    }
  }
  itens.sort((a, b) => b.ordem.localeCompare(a.ordem))

  const bloqueio = !config.holerite_ativo
    ? 'A empresa ainda não disponibilizou o holerite por aqui.'
    : !ficha ? 'Seu usuário não está ligado a uma ficha da Equipe.' : null

  return (
    <div className="w-full">
      <MeuHoleriteClient
        itens={itens}
        bloqueio={bloqueio}
        company={company}
        employee={ficha ? { nome: ficha.nome as string, cpf: ficha.cpf as string | null, cargo: ficha.cargo as string | null } : null}
        responsavel={config.responsavel_calculo}
        fonte={config.holerite_fonte}
      />
    </div>
  )
}
