import { createAdminClient } from '@/lib/supabase/server'

export type CompanyBenefit = {
  id: string
  company_id: string
  nome: string
  valor: number
  por_dia_trabalhado: boolean
  desconta_salario: boolean
  /** Regra do desconto (migration 20261108000089) */
  desconto_tipo?: string | null
  desconto_valor?: number | null
  ativo: boolean
  created_at: string
}

export type EmployeeWithBenefits = {
  id: string
  nome: string
  cargo: string | null
  status: string
  salario: number | null
  foto_path: string | null
  employee_benefits: { benefit_id: string; valor_override: number | null }[]
}

export async function getCompanyBenefits(companyId: string): Promise<CompanyBenefit[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('company_benefits')
    .select('*')
    .eq('company_id', companyId)
    .order('nome', { ascending: true })
  if (error) throw error
  return (data ?? []) as CompanyBenefit[]
}

export async function getActiveCompanyBenefits(companyId: string): Promise<CompanyBenefit[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('company_benefits')
    .select('*')
    .eq('company_id', companyId)
    .eq('ativo', true)
    .order('nome', { ascending: true })
  if (error) throw error
  return (data ?? []) as CompanyBenefit[]
}

export async function getEmployeesWithBenefits(companyId: string): Promise<EmployeeWithBenefits[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('employees')
    .select('id, nome, cargo, status, salario, foto_path, employee_benefits(benefit_id, valor_override)')
    .eq('company_id', companyId)
    .in('status', ['ativo', 'experiencia'])
    .order('nome', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as EmployeeWithBenefits[]
}
