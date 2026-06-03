import { createAdminClient } from '@/lib/supabase/server'

export type HealthSafetyRecord = {
  id: string
  company_id: string
  employee_id: string | null
  tipo: 'aso' | 'treinamento' | 'epi' | 'incidente' | 'vacina'
  titulo: string
  data: string | null
  data_vencimento: string | null
  resultado: string | null
  observacao: string | null
  created_at: string
  employee: { nome: string } | null
}

export async function getHealthSafetyRecords(companyId: string): Promise<HealthSafetyRecord[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('health_safety_records')
    .select('*, employee:employee_id (nome)')
    .eq('company_id', companyId)
    .order('data', { ascending: false })

  if (error) throw error
  return (data ?? []) as unknown as HealthSafetyRecord[]
}

export type EmployeeForSS = {
  id: string
  nome: string
  cargo: string | null
}

export async function getEmployeesForSS(companyId: string): Promise<EmployeeForSS[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('employees')
    .select('id, nome, cargo')
    .eq('company_id', companyId)
    .in('status', ['ativo', 'experiencia', 'admissao'])
    .order('nome', { ascending: true })

  if (error) throw error
  return (data ?? []) as unknown as EmployeeForSS[]
}
