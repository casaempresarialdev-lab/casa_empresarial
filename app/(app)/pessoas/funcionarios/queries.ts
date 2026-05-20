import { createAdminClient } from '@/lib/supabase/server'

export type Employee = {
  id: string
  company_id: string
  nome: string
  cpf: string | null
  rg: string | null
  telefone: string | null
  email: string | null
  cargo: string | null
  departamento: string | null
  salario: number | null
  status: 'admissao' | 'experiencia' | 'ativo' | 'inativo' | 'demitido'
  data_admissao: string | null
  data_experiencia_fim: string | null
  data_demissao: string | null
  tipo_contrato: 'clt' | 'pj' | 'estagio' | 'menor_aprendiz' | null
  vale_transporte: boolean
  vale_refeicao: boolean
  plano_saude: boolean
  grau_instrucao: string | null
  created_at: string
  updated_at: string
}

export async function getEmployees(companyId: string): Promise<Employee[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('employees')
    .select('*')
    .eq('company_id', companyId)
    .order('nome', { ascending: true })

  if (error) throw error
  return (data ?? []) as Employee[]
}
