'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { getViewerContext } from '@/lib/auth/viewer'
import { semAcesso } from '@/lib/auth/acesso'
import { CAMPOS_FOLHA, calcularFolha, type AjustesFolha } from '@/lib/folha/calculo'
import { conferenciaFolhaSchema } from '@/lib/validations/folha'
import { montarFolha } from './queries'

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const RE_MES_ANO = /^\d{4}-(0[1-9]|1[0-2])$/

function mesAnoLabel(mesAno: string) {
  const [ano, mes] = mesAno.split('-')
  return `${MESES[parseInt(mes) - 1]}/${ano}`
}

async function bloqueado(companyId: string) {
  const negado = await semAcesso('pessoas.folha-de-pagamento', companyId)
  if (negado) return negado
  const viewer = await getViewerContext(companyId)
  return viewer?.isColaborador ? { error: 'Sem permissão para esta ação.' } : null
}

function revalidarFolha() {
  revalidatePath('/pessoas/folha-de-pagamento')
  revalidatePath('/financeiro/fluxo-de-caixa')
  revalidatePath('/financeiro/fluxo-de-caixa/pagamentos')
}

/** Grava só o que difere do automático: o resto continua acompanhando o ponto */
export async function salvarConferenciaAction(companyId: string, employeeId: string, mesAno: string, dados: unknown) {
  const negado = await bloqueado(companyId)
  if (negado) return negado
  if (!RE_MES_ANO.test(mesAno)) return { error: 'Mês inválido.' }

  const parsed = conferenciaFolhaSchema.safeParse(dados)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { linhas, fechada } = await montarFolha(companyId, mesAno)
  if (fechada) return { error: 'A folha deste mês está fechada. Reabra para editar.' }
  const linha = linhas.find((l) => l.employee.id === employeeId)
  if (!linha) return { error: 'Funcionário não encontrado nesta folha.' }

  const { automaticos } = calcularFolha(linha.insumos, linha.ponto)
  const ajustes: AjustesFolha = {}
  for (const campo of CAMPOS_FOLHA) {
    const v = parsed.data.valores[campo]
    if (v !== undefined && Math.abs(v - automaticos[campo]) >= 0.005) ajustes[campo] = v
  }

  const { error } = await createAdminClient().from('payroll_entries').upsert({
    company_id: companyId,
    employee_id: employeeId,
    mes_ano: mesAno,
    salario_base: linha.insumos.salario,
    ajustes,
    observacao: parsed.data.observacao || null,
  }, { onConflict: 'employee_id,mes_ano' })
  if (error) return { error: error.message }

  revalidatePath('/pessoas/folha-de-pagamento')
  return { success: true as const }
}

/** Congela a base do mês e lança salários e benefícios no fluxo de caixa como pendentes */
export async function fecharFolhaAction(companyId: string, mesAno: string) {
  const negado = await bloqueado(companyId)
  if (negado) return negado
  if (!RE_MES_ANO.test(mesAno)) return { error: 'Mês inválido.' }

  const { linhas, fechada } = await montarFolha(companyId, mesAno)
  if (fechada) return { error: 'A folha deste mês já está fechada.' }
  if (linhas.length === 0) return { error: 'Não há funcionários nesta folha.' }

  const admin = createAdminClient()
  const calculadas = linhas.map((l) => ({ linha: l, r: calcularFolha(l.insumos, l.ponto, l.ajustes) }))

  const { data: gravados, error } = await admin.from('payroll_entries').upsert(
    calculadas.map(({ linha: l, r }) => ({
      company_id: companyId,
      employee_id: l.employee.id,
      mes_ano: mesAno,
      salario_base: l.insumos.salario,
      periculosidade_valor: r.periculosidade,
      desconto_faltas: r.valores.desconto_faltas,
      atestados: r.valores.atestados,
      horas_extras: r.valores.horas_extras,
      horas_extras_feriado: r.valores.horas_extras_feriado,
      horas_extras_domingo: r.valores.horas_extras_domingo,
      bonus: r.valores.bonus,
      desconto_atrasos: r.valores.desconto_atrasos,
      desconto_vt: r.valores.desconto_vt,
      desconto_vr: r.valores.desconto_vr,
      desconto_outros: r.valores.desconto_outros,
      desconto_adiantamento: r.valores.desconto_adiantamento,
      desconto_inss: r.inss,
      desconto_irrf: r.irrf,
      salario_liquido: r.liquido,
      dias_trabalhados: l.ponto.motivo ? null : l.ponto.diasTrabalhados,
      status: 'fechado',
      ajustes: l.ajustes,
      observacao: l.observacao,
      apuracao: { insumos: l.insumos, ponto: l.ponto },
    })),
    { onConflict: 'employee_id,mes_ano' },
  ).select('id, employee_id')
  if (error || !gravados) return { error: error?.message ?? 'Não foi possível fechar a folha.' }

  const idDe = new Map(gravados.map((g) => [g.employee_id as string, g.id as string]))
  const competencia = `${mesAno}-01`
  const rotulo = mesAnoLabel(mesAno)
  const contas = calculadas.flatMap(({ linha: l, r }) => {
    const ref = `payroll_entry:${idDe.get(l.employee.id)}`
    const comum = { company_id: companyId, tipo: 'pagamento', data_competencia: competencia, status: 'pendente', recorrente: false }
    return [
      ...(r.liquido > 0 ? [{ ...comum, descricao: `Salário — ${l.employee.nome} — ${rotulo}`, valor: r.liquido, detalhes: `${ref}:salary` }] : []),
      ...(r.custoBeneficios > 0 ? [{ ...comum, descricao: `Benefícios (patronal) — ${l.employee.nome} — ${rotulo}`, valor: r.custoBeneficios, detalhes: `${ref}:benefits` }] : []),
    ]
  })

  if (contas.length > 0) {
    const { error: erroContas } = await admin.from('transactions').insert(contas)
    if (erroContas) {
      await admin.from('payroll_entries').update({ status: 'rascunho', apuracao: null }).eq('company_id', companyId).eq('mes_ano', mesAno)
      return { error: erroContas.message }
    }
  }

  revalidarFolha()
  return { success: true as const }
}

/** Volta para conferência e retira do fluxo de caixa, desde que nada tenha sido pago */
export async function reabrirFolhaAction(companyId: string, mesAno: string) {
  const negado = await bloqueado(companyId)
  if (negado) return negado
  if (!RE_MES_ANO.test(mesAno)) return { error: 'Mês inválido.' }

  const admin = createAdminClient()
  const { data: lancamentos, error } = await admin
    .from('payroll_entries')
    .select('id, status')
    .eq('company_id', companyId)
    .eq('mes_ano', mesAno)
    .neq('status', 'rascunho')
  if (error) return { error: error.message }
  if (!lancamentos?.length) return { error: 'A folha deste mês não está fechada.' }
  if (lancamentos.some((l) => l.status === 'pago')) return { error: 'Esta folha já foi paga e não pode ser reaberta.' }

  const filtroContas = lancamentos.map((l) => `detalhes.like.payroll_entry:${l.id}:*`).join(',')
  const { data: contas, error: erroContas } = await admin.from('transactions').select('id, status').eq('company_id', companyId).or(filtroContas)
  if (erroContas) return { error: erroContas.message }
  if (contas?.some((c) => c.status !== 'pendente')) {
    return { error: 'Há pagamentos desta folha já baixados no fluxo de caixa. Estorne-os antes de reabrir.' }
  }

  if (contas?.length) {
    const { error: erroExcluir } = await admin.from('transactions').delete().in('id', contas.map((c) => c.id))
    if (erroExcluir) return { error: erroExcluir.message }
  }

  const { error: erroReabrir } = await admin
    .from('payroll_entries')
    .update({ status: 'rascunho', apuracao: null })
    .in('id', lancamentos.map((l) => l.id))
  if (erroReabrir) return { error: erroReabrir.message }

  revalidarFolha()
  return { success: true as const }
}
