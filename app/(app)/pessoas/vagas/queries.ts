import { createAdminClient } from '@/lib/supabase/server'

export type VagaStatus = 'aberta' | 'pausada' | 'encerrada'

export type Vaga = {
  id: string
  company_id: string
  token: string
  titulo: string
  descricao: string | null
  /** Cargo da Estrutura (migration 20261108000090) */
  position_id?: string | null
  cargo: string | null
  departamento: string | null
  local_trabalho: string | null
  tipo_contrato: string
  salario: number | null
  exibir_salario: boolean
  posicoes: number
  data_limite: string | null
  status: VagaStatus
  encerrada_em: string | null
  created_at: string
  benefit_ids: string[]
  /** Total de candidaturas e quantas ainda não foram avaliadas */
  total: number
  novas: number
}

export type CandidaturaStatus = 'nova' | 'selecionada' | 'reprovada' | 'desistiu' | 'processo_encerrado'

export type Candidatura = {
  id: string
  vaga_id: string
  nome: string
  /** Admissão aberta direto no sistema pode não ter CPF nem currículo */
  cpf: string | null
  email: string
  telefone: string
  anexo_nome: string | null
  anexo_tipo: string | null
  status: CandidaturaStatus
  motivo: string | null
  aceite_em: string
  guardar_ate: string
  created_at: string
}

type VagaRow = Omit<Vaga, 'benefit_ids' | 'total' | 'novas'> & {
  job_opening_benefits: { benefit_id: string }[]
  job_applications: { status: string }[]
}

const SELECT_VAGA = '*, job_opening_benefits(benefit_id), job_applications(status)'

function montarVaga({ job_opening_benefits, job_applications, ...v }: VagaRow): Vaga {
  return {
    ...v,
    benefit_ids: job_opening_benefits.map((b) => b.benefit_id),
    total: job_applications.length,
    novas: job_applications.filter((a) => a.status === 'nova').length,
  }
}

/** Devolve o erro em vez de lançar: a tabela pode ainda não existir (migration 20261103000075) */
export async function getVagas(companyId: string): Promise<{ vagas: Vaga[]; error: string | null }> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('job_openings')
    .select(SELECT_VAGA)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (error) return { vagas: [], error: error.message }
  return { vagas: (data as unknown as VagaRow[]).map(montarVaga), error: null }
}

export async function getVagaById(id: string, companyId: string): Promise<Vaga | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('job_openings')
    .select(SELECT_VAGA)
    .eq('id', id)
    .eq('company_id', companyId)
    .maybeSingle()

  return data ? montarVaga(data as unknown as VagaRow) : null
}

export async function getCandidaturas(vagaId: string, companyId: string): Promise<Candidatura[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('job_applications')
    .select('id, vaga_id, nome, cpf, email, telefone, anexo_nome, anexo_tipo, status, motivo, aceite_em, guardar_ate, created_at')
    .eq('vaga_id', vagaId)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as Candidatura[]
}
