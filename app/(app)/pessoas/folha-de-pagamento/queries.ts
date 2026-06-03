import { createAdminClient } from '@/lib/supabase/server'

export type PayrollEntry = {
  id: string
  company_id: string
  employee_id: string
  mes_ano: string
  salario_base: number
  horas_extras: number
  adicional_noturno: number
  bonus: number
  desconto_faltas: number
  desconto_inss: number
  desconto_irrf: number
  desconto_vt: number
  desconto_outros: number
  salario_liquido: number
  status: 'rascunho' | 'fechado' | 'pago'
  observacao: string | null
  created_at: string
  employee: { nome: string; cargo: string | null } | null
}

export async function getPayrollEntries(companyId: string, mesAno: string): Promise<PayrollEntry[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('payroll_entries')
    .select('*, employee:employee_id (nome, cargo)')
    .eq('company_id', companyId)
    .eq('mes_ano', mesAno)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as unknown as PayrollEntry[]
}

export type EmployeeForPayroll = {
  id: string
  nome: string
  cargo: string | null
  salario: number | null
  tipo_contrato: string | null
  vale_transporte: boolean
  vale_refeicao: boolean
}

export async function getActiveEmployeesForPayroll(companyId: string): Promise<EmployeeForPayroll[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('employees')
    .select('id, nome, cargo, salario, tipo_contrato, vale_transporte, vale_refeicao')
    .eq('company_id', companyId)
    .in('status', ['ativo', 'experiencia'])
    .order('nome', { ascending: true })

  if (error) throw error
  return (data ?? []) as unknown as EmployeeForPayroll[]
}
