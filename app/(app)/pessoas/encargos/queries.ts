import { createAdminClient } from '@/lib/supabase/server'

export type EmployeeEncargo = {
  id: string
  nome: string
  cargo: string | null
  tipo_contrato: string | null
  salario: number | null
  vale_transporte: boolean
  vale_refeicao: boolean
}

export async function getEncargosEmployees(companyId: string): Promise<EmployeeEncargo[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('employees')
    .select('id, nome, cargo, tipo_contrato, salario, vale_transporte, vale_refeicao')
    .eq('company_id', companyId)
    .in('status', ['ativo', 'experiencia'])
    .not('salario', 'is', null)
    .order('nome', { ascending: true })

  if (error) throw error
  return (data ?? []) as unknown as EmployeeEncargo[]
}
