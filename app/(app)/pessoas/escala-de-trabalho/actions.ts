'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { FolgaPattern } from '@/lib/escala/generate'

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

const REVALIDATE = () => revalidatePath('/pessoas/escala-de-trabalho')

// ── Regras de escala ──────────────────────────────────────────────────────────

export type RulePayload = {
  employee_id: string
  data_inicio: string
  data_fim: string | null
  hora_entrada: string
  hora_saida: string
  hora_almoco_inicio: string | null
  hora_almoco_fim: string | null
  tipo_escala: 'semanal' | '12x36'
  dias_folga: number[]
  data_referencia: string | null
  folga_patterns: FolgaPattern[]
}

export async function createRuleAction(companyId: string, payload: RulePayload) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  if (!payload.employee_id) return { error: 'Selecione um funcionário.' }
  if (!payload.data_inicio)  return { error: 'Data de início é obrigatória.' }
  if (!payload.hora_entrada) return { error: 'Horário de entrada é obrigatório.' }
  if (!payload.hora_saida)   return { error: 'Horário de saída é obrigatório.' }
  if (payload.tipo_escala === '12x36' && !payload.data_referencia)
    return { error: 'Informe a data do primeiro dia de trabalho para 12x36.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('employee_schedule_rules')
    .insert({ company_id: companyId, ...payload })

  if (error) return { error: error.message }
  REVALIDATE()
  return { success: true }
}

export async function updateRuleAction(ruleId: string, companyId: string, payload: Partial<RulePayload>) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('employee_schedule_rules')
    .update(payload)
    .eq('id', ruleId)
    .eq('company_id', companyId)

  if (error) return { error: error.message }
  REVALIDATE()
  return { success: true }
}

export async function deleteRuleAction(ruleId: string, companyId: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('employee_schedule_rules')
    .delete()
    .eq('id', ruleId)
    .eq('company_id', companyId)

  if (error) return { error: error.message }
  REVALIDATE()
  return { success: true }
}

// ── Exceções manuais ──────────────────────────────────────────────────────────

export async function upsertExceptionAction(
  companyId: string,
  employeeId: string,
  data: string,
  tipo: 'folga' | 'trabalho',
  observacao: string | null,
) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('employee_schedule_exceptions')
    .upsert(
      { company_id: companyId, employee_id: employeeId, data, tipo, observacao },
      { onConflict: 'employee_id,data' },
    )

  if (error) return { error: error.message }
  REVALIDATE()
  return { success: true }
}

export async function deleteExceptionAction(exceptionId: string, companyId: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('employee_schedule_exceptions')
    .delete()
    .eq('id', exceptionId)
    .eq('company_id', companyId)

  if (error) return { error: error.message }
  REVALIDATE()
  return { success: true }
}
