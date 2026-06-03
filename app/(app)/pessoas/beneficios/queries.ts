import { createAdminClient } from '@/lib/supabase/server'

export type EmployeeBenefit = {
  id: string
  nome: string
  cargo: string | null
  departamento: string | null
  status: string
  vale_transporte: boolean
  vale_refeicao: boolean
  plano_saude: boolean
  salario: number | null
}

export async function getEmployeeBenefits(companyId: string): Promise<EmployeeBenefit[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('employees')
    .select('id, nome, cargo, departamento, status, vale_transporte, vale_refeicao, plano_saude, salario')
    .eq('company_id', companyId)
    .in('status', ['ativo', 'experiencia', 'admissao'])
    .order('nome', { ascending: true })

  if (error) throw error
  return (data ?? []) as unknown as EmployeeBenefit[]
}
