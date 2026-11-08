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

export type AjusteEquipe = {
  id: string
  employee_id: string
  nome: string
  data: string
  entrada: string | null
  saida_almoco: string | null
  retorno_almoco: string | null
  saida: string | null
  motivo: string
  status: 'pendente' | 'aprovado' | 'recusado'
  resposta: string | null
  decidido_por_nome: string | null
  decidido_em: string | null
  /** Horários que estão no registro hoje (só nos pedidos em análise) */
  atual: Pick<AjusteEquipe, 'entrada' | 'saida_almoco' | 'retorno_almoco' | 'saida'> | null
}

/** Pedidos em análise e as 50 decisões mais recentes (sem a migration 20261108000094: nenhum) */
export async function getAjustes(companyId: string): Promise<AjusteEquipe[]> {
  const admin = createAdminClient()
  const colunas = 'id, employee_id, data, entrada, saida_almoco, retorno_almoco, saida, motivo, status, resposta, decidido_por_nome, decidido_em, employee:employee_id(nome)'
  const [pendentes, decididos] = await Promise.all([
    admin.from('time_adjustments').select(colunas).eq('company_id', companyId).eq('status', 'pendente').order('created_at', { ascending: true }),
    admin.from('time_adjustments').select(colunas).eq('company_id', companyId).neq('status', 'pendente').order('decidido_em', { ascending: false }).limit(50),
  ])
  if (pendentes.error) { console.error('[ponto] ajustes indisponíveis:', pendentes.error.message); return [] }

  type Linha = Omit<AjusteEquipe, 'nome' | 'atual'> & { employee: { nome: string } | null }
  const emAnalise = (pendentes.data ?? []) as unknown as Linha[]
  const historico = (decididos.data ?? []) as unknown as Linha[]

  const { data: registros } = emAnalise.length
    ? await admin
        .from('time_records')
        .select('employee_id, data, entrada, saida_almoco, retorno_almoco, saida')
        .eq('company_id', companyId)
        .in('employee_id', [...new Set(emAnalise.map((l) => l.employee_id))])
        .in('data', [...new Set(emAnalise.map((l) => l.data))])
    : { data: [] }

  return [...emAnalise, ...historico].map(({ employee, ...l }) => ({
    ...l,
    nome: employee?.nome ?? 'Funcionário',
    atual: l.status === 'pendente' ? (registros ?? []).find((r) => r.employee_id === l.employee_id && r.data === l.data) ?? null : null,
  }))
}

export async function getActiveEmployees(companyId: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('employees')
    .select('id, nome, cargo')
    .eq('company_id', companyId)
    .in('status', ['ativo', 'experiencia'])
    .order('nome', { ascending: true })

  if (error) throw error
  return (data ?? []) as { id: string; nome: string; cargo: string | null }[]
}
