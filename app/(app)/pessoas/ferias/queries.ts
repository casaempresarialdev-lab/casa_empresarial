import { createAdminClient } from '@/lib/supabase/server'
import type { FeriasRegistro } from '@/lib/ferias/regras'

export type PessoaFerias = { id: string; nome: string; cargo: string | null; data_admissao: string | null }

export type FeriasEquipe = FeriasRegistro & {
  employee_id: string
  observacao: string | null
  origem: 'colaborador' | 'gestor'
  resposta: string | null
  decidido_por_nome: string | null
  decidido_em: string | null
  created_at: string
}

export async function getPessoasFerias(companyId: string): Promise<PessoaFerias[]> {
  const { data, error } = await createAdminClient()
    .from('employees')
    .select('id, nome, cargo, data_admissao')
    .eq('company_id', companyId)
    .in('status', ['ativo', 'experiencia', 'ferias', 'afastado'])
    .order('nome', { ascending: true })
  if (error) throw error
  return (data ?? []) as PessoaFerias[]
}

/** Todas as férias da empresa (sem a migration 20261110000100, as antigas contam como aprovadas) */
export async function getFeriasEquipe(companyId: string): Promise<FeriasEquipe[]> {
  const { data, error } = await createAdminClient()
    .from('employee_vacations')
    .select('*')
    .eq('company_id', companyId)
    .order('data_inicio', { ascending: false })
  if (error) { console.error('[férias] indisponíveis:', error.message); return [] }
  return ((data ?? []) as (FeriasEquipe & { status?: string | null; origem?: string | null })[]).map((f) => ({
    ...f,
    dias_abono: f.dias_abono ?? 0,
    status: (f.status ?? 'aprovada') as FeriasEquipe['status'],
    origem: (f.origem ?? 'gestor') as FeriasEquipe['origem'],
    periodo_inicio: f.periodo_inicio ?? null,
    resposta: f.resposta ?? null,
    decidido_por_nome: f.decidido_por_nome ?? null,
    decidido_em: f.decidido_em ?? null,
  }))
}
