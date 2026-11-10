import { createAdminClient } from '@/lib/supabase/server'
import type { Batida, OrigemBatida } from '@/lib/ponto'

export type TimeRecord = {
  id: string
  company_id: string
  employee_id: string
  data: string
  batidas: Batida[]
  horas_extras: string | null
  tipo: 'normal' | 'extra' | 'folga' | 'ferias' | 'falta' | 'atestado'
  observacao: string | null
  created_at: string
  /** Formato antigo: só a localização da última batida */
  localizacao: { lat?: number; lng?: number; endereco?: string | null } | null
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
    .select('id, company_id, employee_id, data, batidas, horas_extras, tipo, observacao, created_at, localizacao, employee:employees(nome, cargo)')
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
  /** Horários propostos */
  batidas: string[]
  motivo: string
  status: 'pendente' | 'aprovado' | 'recusado'
  resposta: string | null
  decidido_por_nome: string | null
  decidido_em: string | null
  /** Quando o pedido foi feito */
  created_at: string
  /** Localização e IP do pedido; vazio nos pedidos anteriores a este controle */
  origem?: OrigemBatida | null
  /** Horários que estão no registro hoje (só nos pedidos em análise) */
  atual: string[] | null
}

/** Pedidos em análise e as 50 decisões mais recentes (sem a migration 20261108000094: nenhum) */
export async function getAjustes(companyId: string): Promise<AjusteEquipe[]> {
  const admin = createAdminClient()
  // '*': com a migration 20261109000096 pendente, os pedidos continuam aparecendo, só sem a origem
  const colunas = '*, employee:employee_id(nome)'
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
        .select('employee_id, data, batidas')
        .eq('company_id', companyId)
        .in('employee_id', [...new Set(emAnalise.map((l) => l.employee_id))])
        .in('data', [...new Set(emAnalise.map((l) => l.data))])
    : { data: [] }

  return [...emAnalise, ...historico].map(({ employee, ...l }) => ({
    ...l,
    nome: employee?.nome ?? 'Funcionário',
    atual: l.status === 'pendente'
      ? (((registros ?? []).find((r) => r.employee_id === l.employee_id && r.data === l.data)?.batidas ?? []) as Batida[]).map((b) => b.em)
      : null,
  }))
}

export type AusenciaEquipe = {
  id: string
  employee_id: string
  nome: string
  data_inicio: string
  data_fim: string
  tipo: string
  motivo: string | null
  anexo_path: string | null
  anexo_nome: string | null
  status: 'pendente' | 'abonado' | 'recusado'
  resposta: string | null
  origem: 'colaborador' | 'gestor'
  decidido_por_nome: string | null
  decidido_em: string | null
  created_at: string
}

/** Sem a migration 20261109000099: nenhuma */
export async function getAusencias(companyId: string): Promise<AusenciaEquipe[]> {
  const { data, error } = await createAdminClient()
    .from('time_absences')
    .select('*, employee:employee_id(nome)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) { console.error('[ponto] ausências indisponíveis:', error.message); return [] }
  type Linha = Omit<AusenciaEquipe, 'nome'> & { employee: { nome: string } | null }
  return ((data ?? []) as unknown as Linha[]).map(({ employee, ...a }) => ({ ...a, nome: employee?.nome ?? 'Funcionário' }))
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
