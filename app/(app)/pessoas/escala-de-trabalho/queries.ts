import { createAdminClient } from '@/lib/supabase/server'
import type { ScheduleRule, ScheduleException, FolgaPattern } from '@/lib/escala/generate'

// ── Tipos exportados ──────────────────────────────────────────────────────────

export type { ScheduleRule, ScheduleException, FolgaPattern }

// ── Regras de escala ──────────────────────────────────────────────────────────

export async function getScheduleRules(companyId: string): Promise<ScheduleRule[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('employee_schedule_rules')
    .select('id, employee_id, data_inicio, data_fim, hora_entrada, hora_saida, hora_almoco_inicio, hora_almoco_fim, tipo_escala, dias_folga, data_referencia, folga_patterns')
    .eq('company_id', companyId)
    .order('data_inicio', { ascending: true })

  if (error) throw error
  return (data ?? []) as unknown as ScheduleRule[]
}

// Regras de um funcionário específico (para o painel de gerenciamento)
export async function getEmployeeScheduleRules(
  companyId: string,
  employeeId: string,
): Promise<ScheduleRule[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('employee_schedule_rules')
    .select('id, employee_id, data_inicio, data_fim, hora_entrada, hora_saida, hora_almoco_inicio, hora_almoco_fim, tipo_escala, dias_folga, data_referencia, folga_patterns')
    .eq('company_id', companyId)
    .eq('employee_id', employeeId)
    .order('data_inicio', { ascending: true })

  if (error) throw error
  return (data ?? []) as unknown as ScheduleRule[]
}

// ── Exceções manuais ──────────────────────────────────────────────────────────

export async function getScheduleExceptions(
  companyId: string,
  mes: number,
  ano: number,
): Promise<ScheduleException[]> {
  const admin = createAdminClient()
  const dataInicio = `${ano}-${String(mes).padStart(2, '0')}-01`
  const dataFim    = new Date(ano, mes, 0).toISOString().slice(0, 10)

  const { data, error } = await admin
    .from('employee_schedule_exceptions')
    .select('id, employee_id, data, tipo, observacao')
    .eq('company_id', companyId)
    .gte('data', dataInicio)
    .lte('data', dataFim)

  if (error) throw error
  return (data ?? []) as unknown as ScheduleException[]
}

// ── Funcionários ativos ───────────────────────────────────────────────────────

export async function getActiveEmployees(companyId: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('employees')
    .select('id, nome, cargo')
    .eq('company_id', companyId)
    .in('status', ['ativo', 'experiencia', 'admissao', 'ferias', 'afastado'])
    .order('nome', { ascending: true })

  if (error) throw error
  return (data ?? []) as { id: string; nome: string; cargo: string | null }[]
}
