import { createAdminClient } from '@/lib/supabase/server'

export type Employee = {
  id: string
  company_id: string
  nome: string
  cpf: string | null
  rg: string | null
  nascimento: string | null
  telefone: string | null
  email: string | null
  cargo: string | null
  departamento: string | null
  local_trabalho: string | null
  salario: number | null
  plano_saude: boolean
  status: 'admissao' | 'experiencia' | 'ativo' | 'inativo' | 'demitido'
  data_admissao: string | null
  data_experiencia_fim: string | null
  fim_experiencia_1: string | null
  fim_experiencia_2: string | null
  data_demissao: string | null
  vcto_ferias: string | null
  conceder_ferias_ate: string | null
  exame_periodico: string | null
  status_contrato: 'assinado' | 'nao_tem' | 'nao_assinado' | null
  tipo_contrato: 'clt' | 'pj' | 'estagio' | 'menor_aprendiz' | null
  pis_pasep: string | null
  matricula: string | null
  serie_ctps: string | null
  certificado_reservista: string | null
  dependentes: number
  dados_bancarios: string | null
  grau_instrucao: string | null
  pin: string | null
  pin_ativo: boolean
  created_at: string
  updated_at: string
  employee_benefits: { benefit_id: string }[]
}

export async function getEmployees(companyId: string): Promise<Employee[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('employees')
    .select('*, employee_benefits(benefit_id)')
    .eq('company_id', companyId)
    .order('nome', { ascending: true })

  if (error) throw error
  return (data ?? []) as unknown as Employee[]
}

export async function getActiveEmployees(companyId: string): Promise<Employee[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('employees')
    .select('*, employee_benefits(benefit_id)')
    .eq('company_id', companyId)
    .in('status', ['admissao', 'experiencia', 'ativo'])
    .order('nome', { ascending: true })

  if (error) throw error
  return (data ?? []) as unknown as Employee[]
}
