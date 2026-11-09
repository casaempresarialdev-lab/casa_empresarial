import { createAdminClient } from '@/lib/supabase/server'
import { generateMonth } from '@/lib/escala/generate'
import { apurarPonto, divisorHoras, type AjustesFolha, type ApuracaoPonto, type InsumosFolha, type RegistroPonto } from '@/lib/folha/calculo'
import type { BeneficioCalculo } from '@/lib/beneficios-calculo'
import { getEncargosAliquotas } from '../encargos/queries'
import { getScheduleExceptions, getScheduleRules } from '../escala-de-trabalho/queries'

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

export type FolhaDoMes = { linhas: LinhaFolha[]; fechada: boolean }

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
  pin_ativo: boolean
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
    .select(`
      id, nome, cpf, cargo, salario, tipo_contrato, dependentes, data_admissao, tem_periculosidade, pin_ativo,
      employee_benefits(valor_override, benefit:benefit_id(*))
    `)
    .eq('company_id', companyId)
    .order('nome', { ascending: true })
  // Mês fechado: quem estava na folha, mesmo que já tenha saído da empresa
  consulta = fechada
    ? consulta.in('id', fechados.map((l) => l.employee_id))
    : consulta.in('status', ['ativo', 'experiencia']).gt('salario', 0)

  const [{ data: funcionarios, error: erroFuncionarios }, aliquotas, regras, excecoes, { data: registros, error: erroPonto }] = await Promise.all([
    consulta,
    getEncargosAliquotas(companyId),
    getScheduleRules(companyId),
    getScheduleExceptions(companyId, mes, ano),
    admin
      .from('time_records')
      .select('employee_id, data, batidas, tipo')
      .eq('company_id', companyId)
      .gte('data', inicio)
      .lte('data', fim),
  ])
  if (erroFuncionarios) throw erroFuncionarios
  if (erroPonto) throw erroPonto

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
    return {
      ...base,
      insumos: {
        salario: salarioDoMes(f.salario ?? 0, f.data_admissao, mesAno),
        tipoContrato: f.tipo_contrato,
        temPericulosidade: f.tem_periculosidade,
        dependentes: f.dependentes ?? 0,
        divisor: divisorHoras(regra),
        fgtsPct,
        outrosEncargosPct,
        beneficios: f.employee_benefits.map((b) => ({ nome: b.benefit.nome, beneficio: b.benefit, valorPessoa: b.valor_override })),
      },
      ponto: apurarPonto(
        generateMonth(regras, excecoes, mes, ano, f.id),
        ((registros ?? []) as (RegistroPonto & { employee_id: string })[]).filter((r) => r.employee_id === f.id),
        { hoje, admissao: f.data_admissao, controlaPonto: f.pin_ativo && !pj },
      ),
    }
  })

  return { linhas, fechada }
}
