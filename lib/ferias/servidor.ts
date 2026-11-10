import type { createAdminClient } from '@/lib/supabase/server'
import { generateRange } from '@/lib/escala/generate'
import { somarDias } from '@/lib/escala/periodo'
import { getEmployeeScheduleRules, getFeriadosEmpresa, getScheduleExceptionsEntre } from '@/app/(app)/pessoas/escala-de-trabalho/queries'
import { getConfigFolha } from '@/app/(app)/pessoas/folha-de-pagamento/queries'
import { desmarcarDias, diasEntre, marcarDias } from '@/lib/ponto-marcacao'
import { calcularPeriodos, fimDasFerias, validarFerias, type FeriasRegistro, type PedidoFerias } from './regras'

type Admin = ReturnType<typeof createAdminClient>

export const hojeBrasil = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())

/** Férias de uma pessoa (sem a migration 20261110000100, as antigas contam como aprovadas) */
export async function feriasDaPessoa(admin: Admin, companyId: string, employeeId: string): Promise<FeriasRegistro[]> {
  const { data } = await admin.from('employee_vacations').select('*').eq('company_id', companyId).eq('employee_id', employeeId)
  return ((data ?? []) as (FeriasRegistro & { status?: string | null })[]).map((f) => ({
    id: f.id, data_inicio: f.data_inicio, dias: f.dias, dias_abono: f.dias_abono ?? 0,
    status: (f.status ?? 'aprovada') as FeriasRegistro['status'], periodo_inicio: f.periodo_inicio ?? null,
  }))
}

/** Os 2 dias depois do início, pela escala e pelos feriados da empresa */
async function diasSeguintes(companyId: string, employeeId: string, inicio: string) {
  const de = somarDias(inicio, 1)
  const ate = somarDias(inicio, 2)
  const [regras, excecoes, feriados] = await Promise.all([
    getEmployeeScheduleRules(companyId, employeeId),
    getScheduleExceptionsEntre(companyId, de, ate),
    getFeriadosEmpresa(companyId),
  ])
  return generateRange(regras, excecoes, de, ate, employeeId, feriados).map((d) => ({ feriado: d.feriado, folga: d.tipo === 'folga' }))
}

/**
 * Valida o pedido contra o período aquisitivo e as regras da empresa, e confere se não se sobrepõe a outras férias.
 * Devolve o erro, ou o período e o fim das férias.
 */
export async function conferirFerias(admin: Admin, opcoes: {
  companyId: string
  employeeId: string
  periodoInicio: string
  pedido: PedidoFerias
  origem: 'colaborador' | 'gestor'
  ignorarId?: string
}): Promise<{ error: string } | { fim: string }> {
  const { companyId, employeeId, periodoInicio, pedido, origem, ignorarId } = opcoes
  const [{ data: funcionario }, ferias, config] = await Promise.all([
    admin.from('employees').select('data_admissao').eq('id', employeeId).eq('company_id', companyId).maybeSingle(),
    feriasDaPessoa(admin, companyId, employeeId),
    getConfigFolha(companyId),
  ])
  if (!funcionario) return { error: 'Funcionário não encontrado.' }
  if (!funcionario.data_admissao) return { error: 'Cadastre a data de admissão para calcular os períodos de férias.' }

  const outras = ferias.filter((f) => f.id !== ignorarId)
  const hoje = hojeBrasil()
  const periodo = calcularPeriodos(funcionario.data_admissao as string, hoje, outras).find((p) => p.inicio === periodoInicio)
  if (!periodo) return { error: 'Escolha um período aquisitivo válido.' }

  const fim = fimDasFerias(pedido.inicio, pedido.dias)
  if (outras.some((f) => (f.status === 'aprovada' || f.status === 'solicitada') && f.data_inicio <= fim && fimDasFerias(f.data_inicio, f.dias) >= pedido.inicio)) {
    return { error: 'Já existem férias marcadas ou pedidas nestes dias.' }
  }

  const erro = validarFerias({ periodo, pedido, config, hoje, origem, diasSeguintes: await diasSeguintes(companyId, employeeId, pedido.inicio) })
  return erro ? { error: erro } : { fim }
}

/** Competência fechada não muda: reabra a folha antes de mexer nas férias que caem nela */
export async function mesFechado(admin: Admin, companyId: string, employeeId: string, inicio: string, dias: number) {
  const meses = [...new Set(diasEntre(inicio, fimDasFerias(inicio, dias)).map((d) => d.slice(0, 7)))]
  const { data } = await admin.from('payroll_entries').select('mes_ano').eq('company_id', companyId).eq('employee_id', employeeId).in('mes_ano', meses).neq('status', 'rascunho').limit(1)
  const mes = data?.[0]?.mes_ano as string | undefined
  return mes ? `A folha de ${mes.split('-').reverse().join('/')} está fechada. Reabra para mudar estas férias.` : null
}

export const marcarFerias = (admin: Admin, companyId: string, employeeId: string, inicio: string, dias: number) =>
  marcarDias(admin, companyId, employeeId, diasEntre(inicio, fimDasFerias(inicio, dias)), 'ferias', 'Férias')

export const desmarcarFerias = (admin: Admin, companyId: string, employeeId: string, inicio: string, dias: number) =>
  desmarcarDias(admin, companyId, employeeId, diasEntre(inicio, fimDasFerias(inicio, dias)), 'ferias')
