'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getViewerContext } from '@/lib/auth/viewer'
import { semAcesso } from '@/lib/auth/acesso'
import { tipoDaRegra } from '@/lib/escala/generate'
import { somarDias } from '@/lib/escala/periodo'
import { diasEscalaSchema, feriadoSchema, padraoEscalaSchema, removerEscalaSchema } from '@/lib/validations/escala'
import { getEmployeeScheduleRules } from './queries'

/** Devolve o erro a retornar quando o usuário não pode alterar a escala */
async function negarGestao(companyId: string) {
  const negado = await semAcesso('pessoas.escala-de-trabalho', companyId)
  if (negado) return negado
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  const viewer = await getViewerContext(companyId)
  return viewer?.isColaborador ? { error: 'Sem permissão para esta ação.' } : null
}

/** Todas as pessoas informadas precisam ser desta empresa */
async function saoDaEmpresa(companyId: string, ids: string[]) {
  const { count } = await createAdminClient().from('employees').select('id', { count: 'exact', head: true }).eq('company_id', companyId).in('id', ids)
  return count === new Set(ids).size
}

/** Encerra na véspera as escalas anteriores; sem isso, a antiga voltaria a valer quando a nova expirasse */
async function encerrarAnteriores(companyId: string, employeeIds: string[], data: string) {
  const { error } = await createAdminClient()
    .from('employee_schedule_rules')
    .update({ data_fim: somarDias(data, -1) })
    .eq('company_id', companyId)
    .in('employee_id', employeeIds)
    .lt('data_inicio', data)
    .or(`data_fim.is.null,data_fim.gte.${data}`)
  return error
}

/**
 * Define o padrão de folgas e o horário de uma ou mais pessoas, a partir de uma data e, se informado, até a expiração.
 * O que valia antes dessa data continua valendo; o que estava programado depois dela é substituído.
 */
export async function definirPadraoAction(companyId: string, dados: unknown) {
  const negado = await negarGestao(companyId)
  if (negado) return negado

  const parsed = padraoEscalaSchema.safeParse(dados)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const { employee_ids, ...d } = parsed.data
  if (!await saoDaEmpresa(companyId, employee_ids)) return { error: 'Funcionário não encontrado.' }

  const ciclo = d.tipo_escala === 'ciclo'
  const admin = createAdminClient()
  // Insere antes de apagar: se falhar, a escala anterior continua intacta
  const { data: novas, error } = await admin
    .from('employee_schedule_rules')
    .insert(employee_ids.map((employee_id) => ({
      company_id: companyId,
      employee_id,
      data_inicio: d.data_inicio,
      data_fim: d.data_fim ?? null,
      hora_entrada: d.hora_entrada,
      hora_saida: d.hora_saida,
      hora_almoco_inicio: d.hora_almoco_inicio,
      hora_almoco_fim: d.hora_almoco_fim,
      tipo_escala: d.tipo_escala,
      dias_folga: ciclo ? [] : d.dias_folga,
      data_referencia: ciclo ? (d.data_referencia ?? d.data_inicio) : null,
      ciclo_trabalho_dias: ciclo ? d.ciclo_trabalho_dias : null,
      ciclo_folga_dias: ciclo ? d.ciclo_folga_dias : null,
      folga_patterns: [],
    })))
    .select('id')
  if (error || !novas) return { error: error?.message ?? 'Não foi possível salvar o padrão.' }

  const { error: errAntigas } = await admin
    .from('employee_schedule_rules')
    .delete()
    .eq('company_id', companyId)
    .in('employee_id', employee_ids)
    .gte('data_inicio', d.data_inicio)
    .not('id', 'in', `(${novas.map((n) => n.id).join(',')})`)
  if (errAntigas) return { error: errAntigas.message }

  const errEncerrar = await encerrarAnteriores(companyId, employee_ids, d.data_inicio)
  if (errEncerrar) return { error: errEncerrar.message }

  // A escala nova sobrescreve: trocas avulsas feitas sobre a escala anterior, da data de início em diante, saem
  const { error: errTrocas } = await admin.from('employee_schedule_exceptions').delete().eq('company_id', companyId).in('employee_id', employee_ids).gte('data', d.data_inicio)
  if (errTrocas) return { error: errTrocas.message }

  revalidatePath('/pessoas/escala-de-trabalho')
  return { success: true as const }
}

/** Feriado muda escala, ponto e folha do mês aberto */
function revalidarFeriados() {
  revalidatePath('/pessoas/escala-de-trabalho')
  revalidatePath('/pessoas/registro-de-ponto')
  revalidatePath('/pessoas/folha-de-pagamento')
}

export async function adicionarFeriadoAction(companyId: string, dados: unknown) {
  const negado = await negarGestao(companyId)
  if (negado) return negado

  const parsed = feriadoSchema.safeParse(dados)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { error } = await createAdminClient().from('company_holidays').insert({ company_id: companyId, ...parsed.data, tipo: 'adicionado' })
  if (error) return { error: error.code === '23505' ? 'Já existe um feriado da empresa nesta data.' : error.message }
  revalidarFeriados()
  return { success: true as const }
}

export async function excluirFeriadoAction(companyId: string, id: string) {
  const negado = await negarGestao(companyId)
  if (negado) return negado

  const { error } = await createAdminClient().from('company_holidays').delete().eq('id', id).eq('company_id', companyId).eq('tipo', 'adicionado')
  if (error) return { error: error.message }
  revalidarFeriados()
  return { success: true as const }
}

/** Liga ou desliga um feriado nacional para a empresa, naquele ano */
export async function considerarFeriadoNacionalAction(companyId: string, data: string, nome: string, considerar: boolean) {
  const negado = await negarGestao(companyId)
  if (negado) return negado
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return { error: 'Data inválida.' }

  const tabela = createAdminClient().from('company_holidays')
  const { error } = considerar
    ? await tabela.delete().eq('company_id', companyId).eq('data', data).eq('tipo', 'removido')
    : await tabela.upsert({ company_id: companyId, data, nome: nome.slice(0, 80), tipo: 'removido' }, { onConflict: 'company_id,data,tipo' })
  if (error) return { error: error.message }
  revalidarFeriados()
  return { success: true as const }
}

/**
 * Remove a escala de uma pessoa a partir de uma data. Os dias anteriores continuam como estavam,
 * para não alterar o ponto e a folha já apurados.
 */
export async function removerEscalaAction(companyId: string, dados: unknown) {
  const negado = await negarGestao(companyId)
  if (negado) return negado

  const parsed = removerEscalaSchema.safeParse(dados)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const { employee_id, a_partir_de } = parsed.data
  if (!await saoDaEmpresa(companyId, [employee_id])) return { error: 'Funcionário não encontrado.' }

  const admin = createAdminClient()
  const daPessoa = () => admin.from('employee_schedule_rules')

  const { error: errFuturas } = await daPessoa().delete().eq('company_id', companyId).eq('employee_id', employee_id).gte('data_inicio', a_partir_de)
  if (errFuturas) return { error: errFuturas.message }

  const errEncerrar = await encerrarAnteriores(companyId, [employee_id], a_partir_de)
  if (errEncerrar) return { error: errEncerrar.message }

  const { error: errTrocas } = await admin.from('employee_schedule_exceptions').delete().eq('company_id', companyId).eq('employee_id', employee_id).gte('data', a_partir_de)
  if (errTrocas) return { error: errTrocas.message }

  revalidatePath('/pessoas/escala-de-trabalho')
  return { success: true as const }
}

/**
 * Marca dias como folga ou trabalho. Dia igual ao padrão não guarda nada; dia diferente vira troca avulsa.
 */
export async function definirDiasAction(companyId: string, employeeId: string, datas: string[], tipo: 'folga' | 'trabalho') {
  const negado = await negarGestao(companyId)
  if (negado) return negado

  const parsed = diasEscalaSchema.safeParse({ employee_id: employeeId, datas, tipo })
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  if (!await saoDaEmpresa(companyId, [employeeId])) return { error: 'Funcionário não encontrado.' }

  const regras = await getEmployeeScheduleRules(companyId, employeeId)
  if (datas.some((d) => tipoDaRegra(regras, d) === 'sem_regra')) return { error: 'Defina o padrão desta pessoa antes de marcar as folgas.' }

  const iguais = datas.filter((d) => tipoDaRegra(regras, d) === tipo)
  const diferentes = datas.filter((d) => tipoDaRegra(regras, d) !== tipo)
  const admin = createAdminClient()

  if (iguais.length) {
    const { error } = await admin.from('employee_schedule_exceptions').delete().eq('company_id', companyId).eq('employee_id', employeeId).in('data', iguais)
    if (error) return { error: error.message }
  }
  if (diferentes.length) {
    const { error } = await admin
      .from('employee_schedule_exceptions')
      .upsert(diferentes.map((data) => ({ company_id: companyId, employee_id: employeeId, data, tipo })), { onConflict: 'employee_id,data' })
    if (error) return { error: error.message }
  }

  revalidatePath('/pessoas/escala-de-trabalho')
  return { success: true as const }
}
