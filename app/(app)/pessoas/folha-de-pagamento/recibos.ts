import type { createAdminClient } from '@/lib/supabase/server'
import { remuneracaoComAdicionais, temEncargos, type AjustesFolha, type ApuracaoPonto, type InsumosFolha } from '@/lib/folha/calculo'
import { adicionalDaPessoa, diaBancarioAte, fmtDataBr, insalubridadeDoCargo, vencimentosFolha, type ConfigFolha } from '@/lib/folha/config'
import { calcularReciboFerias, mediaVariaveis, type MesFechado } from '@/lib/folha/recibos'
import type { HoleriteEnviado } from '@/lib/folha/documentos'
import { fimDasFerias } from '@/lib/ferias/regras'
import { somarDias } from '@/lib/escala/periodo'
import { getFeriadosEmpresa } from '../escala-de-trabalho/queries'
import { getConfigFolha } from './queries'

// Recibos próprios (férias e 13º): o cálculo fica congelado em payroll_receipts e o pagamento entra no fluxo de caixa

type Admin = ReturnType<typeof createAdminClient>

export type TipoRecibo = 'ferias' | 'decimo_1' | 'decimo_2'

export type Recibo = {
  id: string
  employee_id: string
  tipo: TipoRecibo
  referencia: string
  vacation_id: string | null
  pagamento_em: string
  liquido: number
  dados: unknown
}

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
export const rotuloMesAno = (mesAno: string) => `${MESES[Number(mesAno.slice(5, 7)) - 1]}/${mesAno.slice(0, 4)}`

/** Sem a migration 20261110000102: nenhum */
export async function getRecibos(admin: Admin, companyId: string, filtro: { tipo?: TipoRecibo; referencia?: string; employeeId?: string } = {}): Promise<Recibo[]> {
  let q = admin.from('payroll_receipts').select('id, employee_id, tipo, referencia, vacation_id, pagamento_em, liquido, dados').eq('company_id', companyId)
  if (filtro.tipo) q = q.eq('tipo', filtro.tipo)
  if (filtro.referencia) q = q.eq('referencia', filtro.referencia)
  if (filtro.employeeId) q = q.eq('employee_id', filtro.employeeId)
  const { data, error } = await q
  if (error) {
    console.error('[folha] recibos indisponíveis:', error.message)
    return []
  }
  return ((data ?? []) as Recibo[]).map((r) => ({ ...r, liquido: Number(r.liquido) }))
}

/** Holerites em PDF enviados pela contabilidade (sem a migration: nenhum) */
export async function getHoleritesEnviados(admin: Admin, companyId: string, filtro: { competencia?: string; employeeId?: string } = {}): Promise<HoleriteEnviado[]> {
  let q = admin.from('payroll_documents').select('id, employee_id, competencia, tipo, arquivo_nome, enviado_por_nome, created_at').eq('company_id', companyId).order('competencia', { ascending: false }).order('created_at', { ascending: false })
  if (filtro.competencia) q = q.eq('competencia', filtro.competencia)
  if (filtro.employeeId) q = q.eq('employee_id', filtro.employeeId)
  const { data, error } = await q.limit(500)
  if (error) return []
  return (data ?? []) as HoleriteEnviado[]
}

/** Adicional de risco de cada cargo (sem a migration: nenhum) */
export async function adicionaisDosCargos(admin: Admin, companyId: string) {
  const { data } = await admin.from('job_positions').select('*').eq('company_id', companyId)
  return new Map(((data ?? []) as { id: string; adicional?: string | null }[]).map((p) => [p.id, p.adicional ?? 'nenhum']))
}

/** Folhas fechadas da pessoa, da mais recente para a mais antiga */
export async function mesesFechados(admin: Admin, companyId: string, employeeId: string, opcoes: { antesDe?: string; desde?: string; limite?: number }) {
  let q = admin
    .from('payroll_entries')
    .select('mes_ano, ajustes, apuracao')
    .eq('company_id', companyId)
    .eq('employee_id', employeeId)
    .neq('status', 'rascunho')
    .order('mes_ano', { ascending: false })
    .limit(opcoes.limite ?? 12)
  if (opcoes.antesDe) q = q.lt('mes_ano', opcoes.antesDe)
  if (opcoes.desde) q = q.gte('mes_ano', opcoes.desde)
  const { data } = await q
  type Entrada = { mes_ano: string; ajustes: AjustesFolha | null; apuracao: { insumos: InsumosFolha; ponto: ApuracaoPonto } | null }
  return ((data ?? []) as Entrada[])
    .filter((e) => e.apuracao)
    .map((e): MesFechado & { mesAno: string } => ({ mesAno: e.mes_ano, insumos: e.apuracao!.insumos, ponto: e.apuracao!.ponto, ajustes: e.ajustes ?? {} }))
}

export type PessoaFolha = {
  id: string
  nome: string
  salario: number
  tipo_contrato: string | null
  dependentes: number
  data_admissao: string | null
  temPericulosidade: boolean
  adicional: string
}

/** Remuneração cheia do mês, com o adicional de risco do cargo */
export function remuneracaoDaPessoa(p: PessoaFolha, config: ConfigFolha) {
  const insal = insalubridadeDoCargo(p.adicional, config, p.salario)
  return remuneracaoComAdicionais(p.salario, p.temPericulosidade || p.adicional === 'periculosidade', insal?.valor).remuneracao
}

export async function getPessoaFolha(admin: Admin, companyId: string, employeeId: string): Promise<PessoaFolha | null> {
  // '*': adicional_risco vem da migration 20261110000103
  const { data: f } = await admin.from('employees').select('*').eq('id', employeeId).eq('company_id', companyId).maybeSingle()
  if (!f) return null
  const cargos = f.position_id ? await adicionaisDosCargos(admin, companyId) : new Map<string, string>()
  return {
    id: f.id as string,
    nome: f.nome as string,
    salario: Number(f.salario ?? 0),
    tipo_contrato: f.tipo_contrato as string | null,
    dependentes: Number(f.dependentes ?? 0),
    data_admissao: f.data_admissao as string | null,
    temPericulosidade: false,
    adicional: adicionalDaPessoa(f, f.position_id ? cargos.get(f.position_id as string) : null),
  }
}

const vencimentosDoMes = (iso: string, config: ConfigFolha, feriados: Awaited<ReturnType<typeof getFeriadosEmpresa>>) =>
  vencimentosFolha(iso.slice(0, 7), config, feriados)

/** Lançamentos de um recibo no fluxo de caixa: pendentes, com vencimento */
async function lancarNoCaixa(admin: Admin, companyId: string, contas: { descricao: string; valor: number; vencimento: string; competencia: string; detalhes: string }[]) {
  const linhas = contas.filter((c) => c.valor > 0).map((c) => ({
    company_id: companyId, tipo: 'pagamento', status: 'pendente', recorrente: false,
    descricao: c.descricao, valor: c.valor, data_vencimento: c.vencimento, data_competencia: c.competencia, detalhes: c.detalhes,
  }))
  if (!linhas.length) return null
  const { error } = await admin.from('transactions').insert(linhas)
  return error?.message ?? null
}

/**
 * Recibo de férias, na aprovação: congela o cálculo e lança o pagamento (2 dias antes do início) e as retenções.
 * Já existindo, não faz nada.
 */
export async function gerarReciboFerias(admin: Admin, companyId: string, vacationId: string, autorNome: string): Promise<string | null> {
  const { data: f } = await admin.from('employee_vacations').select('employee_id, data_inicio, dias, dias_abono').eq('id', vacationId).eq('company_id', companyId).maybeSingle()
  if (!f) return 'Férias não encontradas.'
  const existentes = await getRecibos(admin, companyId, { tipo: 'ferias', referencia: vacationId })
  if (existentes.length) return null

  const [pessoa, config, feriados] = await Promise.all([getPessoaFolha(admin, companyId, f.employee_id as string), getConfigFolha(companyId), getFeriadosEmpresa(companyId)])
  if (!pessoa) return 'Funcionário não encontrado.'
  const inicio = f.data_inicio as string
  const fim = fimDasFerias(inicio, f.dias as number)
  const pagamentoEm = diaBancarioAte(somarDias(inicio, -2), feriados)
  const meses = await mesesFechados(admin, companyId, pessoa.id, { antesDe: inicio.slice(0, 7), limite: 12 })

  const recibo = calcularReciboFerias({
    remuneracao: remuneracaoDaPessoa(pessoa, config),
    media: mediaVariaveis(meses),
    dias: f.dias as number,
    abono: (f.dias_abono as number) ?? 0,
    dependentes: pessoa.dependentes,
    encargos: temEncargos(pessoa.tipo_contrato),
    inicio,
    fim,
    pagamentoEm,
  })

  const { data: criado, error } = await admin
    .from('payroll_receipts')
    .insert({ company_id: companyId, employee_id: pessoa.id, tipo: 'ferias', referencia: vacationId, vacation_id: vacationId, pagamento_em: pagamentoEm, liquido: recibo.liquido, dados: recibo, fechado_por_nome: autorNome })
    .select('id')
    .single()
  if (error || !criado) {
    // Sem a tabela (migration 20261110000102), as férias seguem sem recibo próprio, como antes
    if (error && ['42P01', 'PGRST205'].includes(error.code)) return null
    return error?.message ?? 'Não foi possível gerar o recibo de férias.'
  }

  const periodo = `${fmtDataBr(inicio).slice(0, 5)} a ${fmtDataBr(fim).slice(0, 5)}`
  const competencia = `${pagamentoEm.slice(0, 7)}-01`
  const erro = await lancarNoCaixa(admin, companyId, [
    { descricao: `Férias — ${pessoa.nome} — ${periodo}`, valor: recibo.liquido, vencimento: pagamentoEm, competencia, detalhes: `payroll_receipt:${criado.id}:ferias` },
    { descricao: `INSS e IRRF das férias — ${pessoa.nome} — ${rotuloMesAno(pagamentoEm.slice(0, 7))}`, valor: Math.round((recibo.resumo.inss + recibo.resumo.irrf) * 100) / 100, vencimento: vencimentosDoMes(pagamentoEm, config, feriados).guias, competencia, detalhes: `payroll_receipt:${criado.id}:retidos` },
  ])
  if (erro) {
    await admin.from('payroll_receipts').delete().eq('id', criado.id)
    return erro
  }
  return null
}

/** Tira o recibo e os lançamentos dele, desde que nada tenha sido pago */
export async function removerRecibos(admin: Admin, companyId: string, ids: string[]): Promise<string | null> {
  if (!ids.length) return null
  const { data: contas, error } = await admin.from('transactions').select('id, status').eq('company_id', companyId).or(ids.map((id) => `detalhes.like.payroll_receipt:${id}:*`).join(','))
  if (error) return error.message
  if (contas?.some((c) => c.status !== 'pendente')) return 'O pagamento deste recibo já foi baixado no fluxo de caixa. Estorne antes de continuar.'
  if (contas?.length) {
    const { error: erroContas } = await admin.from('transactions').delete().in('id', contas.map((c) => c.id))
    if (erroContas) return erroContas.message
  }
  const { error: erroRecibo } = await admin.from('payroll_receipts').delete().in('id', ids)
  return erroRecibo?.message ?? null
}

export async function removerReciboFerias(admin: Admin, companyId: string, vacationId: string) {
  const recibos = await getRecibos(admin, companyId, { tipo: 'ferias', referencia: vacationId })
  return removerRecibos(admin, companyId, recibos.map((r) => r.id))
}
