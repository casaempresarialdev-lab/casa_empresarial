import { createAdminClient } from '@/lib/supabase/server'

export type TimeRecord = {
  id: string
  company_id: string
  employee_id: string
  data: string
  entrada: string | null
  saida_almoco: string | null
  retorno_almoco: string | null
  saida: string | null
  horas_trabalhadas: string | null
  horas_extras: string | null
  tipo: 'normal' | 'extra' | 'folga' | 'ferias' | 'falta'
  observacao: string | null
  created_at: string
  employee: {
    nome: string
    cargo: string | null
  }
}

export async function getTimeRecords(
  companyId: string,
  ano: number,
  mes: number,
): Promise<TimeRecord[]> {
  const admin = createAdminClient()

  const dataInicio = `${ano}-${String(mes).padStart(2, '0')}-01`
  const dataFim = new Date(ano, mes, 0).toISOString().slice(0, 10) // último dia do mês

  const { data, error } = await admin
    .from('time_records')
    .select('id, company_id, employee_id, data, entrada, saida_almoco, retorno_almoco, saida, horas_trabalhadas, horas_extras, tipo, observacao, created_at, employee:employees(nome, cargo)')
    .eq('company_id', companyId)
    .gte('data', dataInicio)
    .lte('data', dataFim)
    .order('data', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as unknown as TimeRecord[]
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
