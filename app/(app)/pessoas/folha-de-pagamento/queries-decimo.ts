import { createAdminClient } from '@/lib/supabase/server'
import { calcularFolha, temEncargos, type AjustesFolha, type ApuracaoPonto, type InsumosFolha } from '@/lib/folha/calculo'
import { adicionalDaPessoa, diaBancarioAte } from '@/lib/folha/config'
import { avosDecimo, calcularDecimo, mediaVariaveis, type ReciboDecimo } from '@/lib/folha/recibos'
import { getEncargosAliquotas } from '../encargos/queries'
import { getFeriadosEmpresa } from '../escala-de-trabalho/queries'
import { getConfigFolha } from './queries'
import { adicionaisDosCargos, getRecibos, remuneracaoDaPessoa } from './recibos'

export type LinhaDecimo = {
  employee: { id: string; nome: string; cpf: string | null; cargo: string | null }
  recibo: ReciboDecimo
}

export type DecimoDoAno = {
  ano: number
  parcela: 1 | 2
  linhas: LinhaDecimo[]
  fechada: boolean
  pagamentoEm: string
  /** Na 2ª parcela: se a 1ª foi fechada no sistema (senão, a 2ª paga o 13º inteiro) */
  primeiraFechada: boolean
  /** Na 1ª parcela: se a 2ª já foi fechada (a 1ª não pode mais ser reaberta) */
  segundaFechada: boolean
  responsavel: 'sistema' | 'contabilidade'
}

export const PRAZO_DECIMO = { 1: '11-30', 2: '12-20' } as const

type Funcionario = {
  id: string; nome: string; cpf: string | null; cargo: string | null; salario: number | null; tipo_contrato: string | null
  dependentes: number | null; data_admissao: string | null; tem_periculosidade: boolean; position_id: string | null; adicional_risco?: string | null
}

/**
 * 13º do ano: aberto, é calculado com o salário atual, a média das variáveis das folhas fechadas do ano
 * e os avos (mês com 15 dias ou mais de trabalho). Fechado, usa o recibo congelado.
 */
export async function montarDecimo(companyId: string, ano: number, parcela: 1 | 2): Promise<DecimoDoAno> {
  const admin = createAdminClient()
  const [config, feriados, recibos, outros] = await Promise.all([
    getConfigFolha(companyId),
    getFeriadosEmpresa(companyId),
    getRecibos(admin, companyId, { tipo: parcela === 1 ? 'decimo_1' : 'decimo_2', referencia: String(ano) }),
    getRecibos(admin, companyId, { tipo: parcela === 1 ? 'decimo_2' : 'decimo_1', referencia: String(ano) }),
  ])
  const pagamentoEm = diaBancarioAte(`${ano}-${PRAZO_DECIMO[parcela]}`, feriados)
  const comum = { ano, parcela, pagamentoEm, responsavel: config.responsavel_calculo, primeiraFechada: parcela === 2 && outros.length > 0, segundaFechada: parcela === 1 && outros.length > 0 }

  // '*': adicional_risco vem da migration 20261110000103
  const colunas = '*'
  if (recibos.length) {
    const { data } = await admin.from('employees').select(colunas).in('id', recibos.map((r) => r.employee_id))
    const porId = new Map(((data ?? []) as Funcionario[]).map((f) => [f.id, f]))
    const linhas = recibos
      .map((r) => ({ f: porId.get(r.employee_id), r }))
      .filter((x): x is { f: Funcionario; r: typeof x.r } => !!x.f)
      .map(({ f, r }) => ({ employee: { id: f.id, nome: f.nome, cpf: f.cpf, cargo: f.cargo }, recibo: r.dados as ReciboDecimo }))
      .sort((a, b) => a.employee.nome.localeCompare(b.employee.nome))
    return { ...comum, linhas, fechada: true }
  }

  const [{ data: funcionarios, error }, { data: entradas }, cargos, aliquotas] = await Promise.all([
    admin.from('employees').select(colunas).eq('company_id', companyId).in('status', ['ativo', 'experiencia', 'ferias', 'afastado']).gt('salario', 0).or(`data_admissao.is.null,data_admissao.lte.${ano}-12-31`).order('nome'),
    admin.from('payroll_entries').select('employee_id, mes_ano, ajustes, apuracao').eq('company_id', companyId).neq('status', 'rascunho').gte('mes_ano', `${ano}-01`).lte('mes_ano', `${ano}-12`),
    adicionaisDosCargos(admin, companyId),
    getEncargosAliquotas(companyId),
  ])
  if (error) throw error

  const ativas = aliquotas.filter((a) => a.ativo)
  const fgtsPct = aliquotas.length ? (ativas.find((a) => /fgts/i.test(a.nome))?.percentual ?? 0) : 8

  type Entrada = { employee_id: string; mes_ano: string; ajustes: AjustesFolha | null; apuracao: { insumos: InsumosFolha; ponto: ApuracaoPonto } | null }
  const meses = ((entradas ?? []) as Entrada[]).filter((e) => e.apuracao)
  // A média usa as folhas fechadas até o mês anterior ao pagamento
  const limiteMedia = `${ano}-${parcela === 1 ? '11' : '12'}`
  const primeiraDe = new Map(outros.map((r) => [r.employee_id, (r.dados as ReciboDecimo).resumo.valor]))

  const linhas = ((funcionarios ?? []) as Funcionario[])
    .filter((f) => temEncargos(f.tipo_contrato))
    .map((f): LinhaDecimo | null => {
      const daPessoa = meses.filter((m) => m.employee_id === f.id)
      const faltasPorMes: Record<number, number> = {}
      for (const m of daPessoa) faltasPorMes[Number(m.mes_ano.slice(5, 7))] = calcularFolha(m.apuracao!.insumos, m.apuracao!.ponto, m.ajustes ?? {}).valores.desconto_faltas
      const avos = avosDecimo(ano, parcela === 1 ? 11 : 12, f.data_admissao, faltasPorMes)
      if (!avos) return null

      const pessoa = {
        id: f.id, nome: f.nome, salario: Number(f.salario ?? 0), tipo_contrato: f.tipo_contrato, dependentes: Number(f.dependentes ?? 0),
        data_admissao: f.data_admissao, temPericulosidade: false, adicional: adicionalDaPessoa(f, f.position_id ? cargos.get(f.position_id) : null),
      }
      const media = mediaVariaveis(daPessoa.filter((m) => m.mes_ano < limiteMedia).map((m) => ({ insumos: m.apuracao!.insumos, ponto: m.apuracao!.ponto, ajustes: m.ajustes ?? {} })))
      return {
        employee: { id: f.id, nome: f.nome, cpf: f.cpf, cargo: f.cargo },
        recibo: calcularDecimo({
          parcela, ano, remuneracao: remuneracaoDaPessoa(pessoa, config), media, avos,
          primeira: primeiraDe.get(f.id) ?? 0, dependentes: pessoa.dependentes, fgtsPct, pagamentoEm,
        }),
      }
    })
    .filter((l): l is LinhaDecimo => !!l)

  return { ...comum, linhas, fechada: false }
}
