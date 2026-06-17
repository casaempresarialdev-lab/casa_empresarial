import { createAdminClient } from '@/lib/supabase/server'

export type PayrollEntry = {
  id: string
  company_id: string
  employee_id: string
  mes_ano: string
  salario_base: number
  periculosidade_valor: number
  horas_extras: number
  horas_extras_feriado: number
  adicional_noturno: number
  bonus: number
  desconto_faltas: number
  desconto_inss: number
  desconto_irrf: number
  desconto_vt: number
  desconto_adiantamento: number
  desconto_outros: number
  salario_liquido: number
  dias_trabalhados: number | null
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

export type BenefitForPayroll = {
  benefit_id: string
  valor_override: number | null
  benefit: {
    nome: string
    valor: number
    por_dia_trabalhado: boolean
    desconta_salario: boolean
  }
}

export type EmployeeForPayroll = {
  id: string
  nome: string
  cpf: string | null
  cargo: string | null
  salario: number | null
  tipo_contrato: string | null
  status_contrato: string | null
  dependentes: number
  data_admissao: string | null
  vcto_ferias: string | null
  conceder_ferias_ate: string | null
  exame_periodico: string | null
  tem_periculosidade: boolean
  vale_transporte: boolean
  vale_refeicao: boolean
  vale_transporte_valor: number
  dias_trabalhados_vt: number
  employee_benefits: BenefitForPayroll[]
}

export async function getActiveEmployeesForPayroll(companyId: string): Promise<EmployeeForPayroll[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('employees')
    .select(`
      id, nome, cpf, cargo, salario, tipo_contrato, status_contrato, dependentes,
      data_admissao, vcto_ferias, conceder_ferias_ate, exame_periodico,
      tem_periculosidade, vale_transporte, vale_refeicao,
      vale_transporte_valor, dias_trabalhados_vt,
      employee_benefits(
        benefit_id, valor_override,
        benefit:benefit_id(nome, valor, por_dia_trabalhado, desconta_salario)
      )
    `)
    .eq('company_id', companyId)
    .in('status', ['ativo', 'experiencia'])
    .order('nome', { ascending: true })

  if (error) throw error
  return (data ?? []) as unknown as EmployeeForPayroll[]
}
