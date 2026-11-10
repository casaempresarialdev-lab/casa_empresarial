import { createAdminClient } from '@/lib/supabase/server'
import { generateRange } from '@/lib/escala/generate'
import { somarDias } from '@/lib/escala/periodo'
import { CONFIG_FOLHA_PADRAO, adicionalDaPessoa, diasDsr, insalubridadeDoCargo, periodoApuracao, vencimentosFolha, type ConfigFolha } from '@/lib/folha/config'
import { apurarPonto, divisorHoras, type AjustesFolha, type ApuracaoPonto, type InsumosFolha, type RegistroPonto } from '@/lib/folha/calculo'
import type { ReciboFerias } from '@/lib/folha/recibos'
import type { BeneficioCalculo } from '@/lib/beneficios-calculo'
import { getEncargosAliquotas } from '../encargos/queries'
import { getFeriadosEmpresa, getScheduleExceptionsEntre, getScheduleRules } from '../escala-de-trabalho/queries'
import { adicionaisDosCargos, getRecibos } from './recibos'

export type StatusFolha = 'rascunho' | 'fechado' | 'pago'

export type LinhaFolha = {
  entryId: string | null
  employee: { id: string; nome: string; cpf: string | null; cargo: string | null; tipo_contrato: string | null }
  insumos: InsumosFolha
  ponto: ApuracaoPonto
  ajustes: AjustesFolha
  observacao: string | null
  status: StatusFolha
}

export type FolhaDoMes = {
  linhas: LinhaFolha[]
  fechada: boolean
  /** Dias que o ponto apura para esta competência */
  periodo: { inicio: string; fim: string }
  vencimentos: ReturnType<typeof vencimentosFolha>
  config: ConfigFolha
}

/** Sem a migration 20261109000099 ou sem nada salvo: os padrões */
export async function getConfigFolha(companyId: string): Promise<ConfigFolha> {
  const { data, error } = await createAdminClient().from('payroll_settings').select('*').eq('company_id', companyId).maybeSingle()
  if (error) console.error('[folha] configuração indisponível:', error.message)
  return { ...CONFIG_FOLHA_PADRAO, ...((data ?? {}) as Partial<ConfigFolha>) }
}

type Funcionario = {
  id: string
  nome: string
  cpf: string | null
  cargo: string | null
  salario: number | null
  tipo_contrato: string | null
  dependentes: number | null
  data_admissao: string | null
  tem_periculosidade: boolean
  adicional_risco?: string | null
  position_id: string | null
  pin_ativo: boolean
  status: string
  employee_benefits: { valor_override: number | null; benefit: BeneficioCalculo & { nome: string } }[]
}

type Lancamento = {
  id: string
  employee_id: string
  status: StatusFolha
  observacao: string | null
  ajustes?: AjustesFolha | null
  apuracao?: { insumos: InsumosFolha; ponto: ApuracaoPonto } | null
}

// Soma das alíquotas padrão CLT, enquanto a empresa não salvou as próprias
const FGTS_PADRAO = 8
const OUTROS_ENCARGOS_PADRAO = 47.24

const RE_FGTS = /fgts/i

/** Salário do mês; quem entrou no meio do mês recebe proporcional (mês comercial de 30 dias) */
function salarioDoMes(salario: number, admissao: string | null, mesAno: string) {
  if (!admissao?.startsWith(mesAno)) return salario
  const dias = Math.max(1, 30 - Number(admissao.slice(8, 10)) + 1)
  return Math.round((salario * dias / 30) * 100) / 100
}

/**
 * Monta a folha do mês. Aberta, é sempre recalculada do ponto, da escala e dos benefícios,
 * mantendo o que foi editado na conferência. Fechada, usa a base congelada no fechamento.
 */
export async function montarFolha(companyId: string, mesAno: string): Promise<FolhaDoMes> {
  const admin = createAdminClient()
  const [ano, mes] = mesAno.split('-').map(Number)
  const inicio = `${mesAno}-01`
  const fim = `${mesAno}-${String(new Date(Date.UTC(ano, mes, 0)).getUTCDate()).padStart(2, '0')}`
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())

  const { data: lancamentos, error: erroLancamentos } = await admin
    .from('payroll_entries')
    .select('*')
    .eq('company_id', companyId)
    .eq('mes_ano', mesAno)
  if (erroLancamentos) throw erroLancamentos

  const porFuncionario = new Map(((lancamentos ?? []) as unknown as Lancamento[]).map((l) => [l.employee_id, l]))
  const fechados = [...porFuncionario.values()].filter((l) => l.status !== 'rascunho')
  const fechada = fechados.length > 0

  let consulta = admin
    .from('employees')
    // '*': adicional_risco vem da migration 20261110000103
    .select(`*, employee_benefits(valor_override, benefit:benefit_id(*))`)
    .eq('company_id', companyId)
    .order('nome', { ascending: true })
  // Mês fechado: quem estava na folha, mesmo que já tenha saído da empresa
  consulta = fechada
    ? consulta.in('id', fechados.map((l) => l.employee_id))
    : consulta.in('status', ['ativo', 'experiencia', 'ferias', 'afastado']).gt('salario', 0)

  const config = await getConfigFolha(companyId)
  const periodo = periodoApuracao(mesAno, config)

  const [{ data: funcionarios, error: erroFuncionarios }, aliquotas, regras, excecoes, feriados, { data: registros, error: erroPonto }, { data: ferias, error: erroFerias }, cargos, recibosFerias] = await Promise.all([
    consulta,
    getEncargosAliquotas(companyId),
    getScheduleRules(companyId),
    getScheduleExceptionsEntre(companyId, periodo.inicio, periodo.fim),
    getFeriadosEmpresa(companyId),
    admin
      .from('time_records')
      .select('employee_id, data, batidas, tipo')
      .eq('company_id', companyId)
      .gte('data', periodo.inicio)
      .lte('data', periodo.fim),
    // '*': sem a migration 20261110000100 não há status, e as férias antigas contam como aprovadas
    admin.from('employee_vacations').select('*').eq('company_id', companyId),
    adicionaisDosCargos(admin, companyId),
    getRecibos(admin, companyId, { tipo: 'ferias' }),
  ])
  if (erroFuncionarios) throw erroFuncionarios
  if (erroPonto) throw erroPonto
  if (erroFerias) console.error('[folha] férias indisponíveis:', erroFerias.message)

  const reciboDe = new Map(recibosFerias.map((r) => [r.referencia, r.dados as ReciboFerias]))
  type Ferias = { id: string; employee_id: string; data_inicio: string; dias: number; dias_abono: number; status?: string | null }
  /**
   * Só as aprovadas, nos dias que caem no mês. Com recibo próprio, entram como já pagas (proporcionais aos dias do mês);
   * sem recibo, como antes: dentro da folha, com o abono no mês em que começam.
   */
  const feriasDe = (id: string) => {
    const legado = { dias: 0, abono: 0 }
    let recibo: InsumosFolha['feriasRecibo']
    for (const f of ((ferias ?? []) as Ferias[]).filter((f) => f.employee_id === id && (f.status ?? 'aprovada') === 'aprovada')) {
      const noMes = Array.from({ length: f.dias }, (_, n) => somarDias(f.data_inicio, n)).filter((d) => d.startsWith(mesAno)).length
      const r = reciboDe.get(f.id)?.resumo
      if (!r) {
        legado.dias += noMes
        legado.abono += f.data_inicio.startsWith(mesAno) ? f.dias_abono : 0
        continue
      }
      if (!noMes) continue
      const parte = noMes / f.dias
      const c = (v: number) => Math.round(v * 100) / 100
      recibo = {
        dias: (recibo?.dias ?? 0) + noMes,
        valor: c((recibo?.valor ?? 0) + r.ferias * parte),
        terco: c((recibo?.terco ?? 0) + r.terco * parte),
        inss: c((recibo?.inss ?? 0) + r.inss * parte),
        pagamentoEm: recibo?.pagamentoEm ?? r.pagamentoEm,
      }
    }
    return { ...legado, recibo }
  }

  const dsr = config.dsr_reflexo_ativo || config.dsr_desconta_falta
    ? { ...diasDsr(periodo.inicio, periodo.fim, feriados), reflexo: config.dsr_reflexo_ativo, descontaFalta: config.dsr_desconta_falta }
    : undefined
  const noturno = config.noturno_ativo ? { pct: Number(config.noturno_percentual), reduzida: config.noturno_hora_reduzida } : undefined

  const ativas = aliquotas.filter((a) => a.ativo)
  const fgtsPct = aliquotas.length ? (ativas.find((a) => RE_FGTS.test(a.nome))?.percentual ?? 0) : FGTS_PADRAO
  const outrosEncargosPct = aliquotas.length
    ? ativas.filter((a) => !RE_FGTS.test(a.nome)).reduce((s, a) => s + a.percentual, 0)
    : OUTROS_ENCARGOS_PADRAO

  const linhas = ((funcionarios ?? []) as unknown as Funcionario[]).map((f): LinhaFolha => {
    const lancamento = porFuncionario.get(f.id)
    const base = {
      entryId: lancamento?.id ?? null,
      employee: { id: f.id, nome: f.nome, cpf: f.cpf, cargo: f.cargo, tipo_contrato: f.tipo_contrato },
      ajustes: lancamento?.ajustes ?? {},
      observacao: lancamento?.observacao ?? null,
      status: lancamento?.status ?? 'rascunho' as StatusFolha,
    }
    if (fechada && lancamento?.apuracao) return { ...base, ...lancamento.apuracao }

    const regra = regras.filter((r) => r.employee_id === f.id && r.data_inicio <= fim && (!r.data_fim || r.data_fim >= inicio)).at(-1)
    const pj = f.tipo_contrato === 'pj' || f.tipo_contrato === 'autonomo'
    const { dias: diasFerias, abono: diasAbono, recibo } = feriasDe(f.id)
    const salarioMes = salarioDoMes(f.salario ?? 0, f.data_admissao, mesAno)
    const adicional = adicionalDaPessoa(f, f.position_id ? cargos.get(f.position_id) : null)
    const insalubridade = insalubridadeDoCargo(adicional, config, f.salario ?? 0, f.salario ? salarioMes / f.salario : 1)
    return {
      ...base,
      insumos: {
        salario: salarioMes,
        tipoContrato: f.tipo_contrato,
        temPericulosidade: adicional === 'periculosidade',
        ...(insalubridade ? { insalubridade } : {}),
        ...(noturno ? { noturno } : {}),
        ...(dsr ? { dsr } : {}),
        ...(recibo ? { feriasRecibo: recibo } : {}),
        dependentes: f.dependentes ?? 0,
        divisor: divisorHoras(regra),
        fatorHe: { normal: 1 + config.he_percentual / 100, feriado: 1 + config.he_feriado_percentual / 100, domingo: 1 + config.he_domingo_percentual / 100 },
        adiantamentoPct: config.adiantamento_ativo ? config.adiantamento_percentual : 0,
        diasFerias,
        diasAbono,
        fgtsPct,
        outrosEncargosPct,
        beneficios: f.employee_benefits.map((b) => ({ nome: b.benefit.nome, beneficio: b.benefit, valorPessoa: b.valor_override })),
      },
      ponto: apurarPonto(
        generateRange(regras, excecoes, periodo.inicio, periodo.fim, f.id, feriados),
        ((registros ?? []) as (RegistroPonto & { employee_id: string })[]).filter((r) => r.employee_id === f.id),
        {
          hoje,
          admissao: f.data_admissao,
          controlaPonto: f.pin_ativo && !pj,
          tolerancia: config.tolerancia_minutos,
          feriadoCompensado: regra?.tipo_escala === 'ciclo' && regra.ciclo_trabalho_dias === 1 && regra.ciclo_folga_dias === 1,
          afastado: f.status === 'afastado',
          noturno: config.noturno_ativo ? { inicio: config.noturno_inicio, fim: config.noturno_fim } : null,
        },
      ),
    }
  })

  return { linhas, fechada, periodo, vencimentos: vencimentosFolha(mesAno, config, feriados), config }
}
