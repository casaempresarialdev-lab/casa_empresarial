import { createAdminClient } from '@/lib/supabase/server'

export type AliquotaRow = {
  id: string
  company_id: string
  nome: string
  percentual: number
  ativo: boolean
  ordem: number
  created_at: string
}

export async function getEncargosAliquotas(companyId: string): Promise<AliquotaRow[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('company_encargos_aliquotas')
    .select('*')
    .eq('company_id', companyId)
    .order('ordem', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as AliquotaRow[]
}

export type EmployeeEncargo = {
  id: string
  nome: string
  cargo: string | null
  tipo_contrato: string | null
  salario: number | null
  employee_benefits: {
    benefit_id: string
    valor_override: number | null
    benefit: {
      nome: string
      valor: number
      por_dia_trabalhado: boolean
      desconta_salario: boolean
    }
  }[]
}

export async function getEncargosEmployees(companyId: string): Promise<EmployeeEncargo[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('employees')
    .select(`
      id, nome, cargo, tipo_contrato, salario,
      employee_benefits(
        benefit_id, valor_override,
        benefit:benefit_id(nome, valor, por_dia_trabalhado, desconta_salario)
      )
    `)
    .eq('company_id', companyId)
    .in('status', ['ativo', 'experiencia'])
    .not('salario', 'is', null)
    .order('nome', { ascending: true })

  if (error) throw error
  return (data ?? []) as unknown as EmployeeEncargo[]
}
