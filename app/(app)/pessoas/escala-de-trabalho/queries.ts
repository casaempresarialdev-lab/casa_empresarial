import { createAdminClient } from '@/lib/supabase/server'

export type WorkSchedule = {
  id: string
  company_id: string
  employee_id: string
  data: string
  turno: string | null
  hora_inicio: string | null
  hora_fim: string | null
  created_at: string
  employee: {
    nome: string
    cargo: string | null
  }
}

export async function getWorkSchedules(
  companyId: string,
  ano: number,
  mes: number,
): Promise<WorkSchedule[]> {
  const admin = createAdminClient()

  const dataInicio = `${ano}-${String(mes).padStart(2, '0')}-01`
  const dataFim = new Date(ano, mes, 0).toISOString().slice(0, 10)

  const { data, error } = await admin
    .from('work_schedules')
    .select('*, employee:employees(nome, cargo)')
    .eq('company_id', companyId)
    .gte('data', dataInicio)
    .lte('data', dataFim)
    .order('data', { ascending: true })

  if (error) throw error
  return (data ?? []) as WorkSchedule[]
}

export async function getActiveEmployees(companyId: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('employees')
    .select('id, nome, cargo')
    .eq('company_id', companyId)
    .in('status', ['ativo', 'experiencia', 'admissao'])
    .order('nome', { ascending: true })

  if (error) throw error
  return (data ?? []) as { id: string; nome: string; cargo: string | null }[]
}
