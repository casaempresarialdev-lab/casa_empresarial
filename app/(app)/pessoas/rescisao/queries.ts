import { createAdminClient } from '@/lib/supabase/server'
import { EXAME_DEMISSIONAL_ASSUNTO_PADRAO, EXAME_DEMISSIONAL_MODELO_PADRAO } from '@/lib/validations/rescisao'
import { montarEtapasRescisao, type Etapa } from './etapas'
import type { Anotacao, Exame } from '../admissao/queries'

export type ConfigRescisao = {
  etapas: Etapa[]
  exame_notificar: boolean
  exame_assunto: string
  exame_modelo: string
}

/** Configurações da empresa; o que não foi configurado (ou sem a migration 20261107000086) usa o padrão */
export async function getConfigRescisao(companyId: string): Promise<ConfigRescisao> {
  const { data } = await createAdminClient().from('termination_settings').select('*').eq('company_id', companyId).maybeSingle()
  return {
    etapas: montarEtapasRescisao(data?.etapas),
    exame_notificar: data?.exame_notificar ?? true,
    exame_assunto: data?.exame_assunto || EXAME_DEMISSIONAL_ASSUNTO_PADRAO,
    exame_modelo: data?.exame_modelo || EXAME_DEMISSIONAL_MODELO_PADRAO,
  }
}

export const getEtapasRescisao = async (companyId: string) => (await getConfigRescisao(companyId)).etapas

export type Rescisao = {
  id: string
  employee_id: string
  status: 'em_andamento' | 'finalizada' | 'cancelada'
  etapa: string
  em_espera: boolean
  tipo: string
  motivo: string | null
  aviso_modalidade: string | null
  aviso_comunicacao: string | null
  aviso_dias: number | null
  ultimo_dia: string | null
  contabilidade_enviada_em: string | null
  contabilidade_enviada_por: string | null
  contabilidade_retorno_em: string | null
  trct_path: string | null
  data_desligamento: string | null
  created_at: string
  /** Quem está saindo */
  employee: {
    id: string
    nome: string
    cargo: string | null
    servico: string | null
    email: string | null
    tipo_contrato: string | null
    data_admissao: string | null
    foto_path: string | null
  }
}

const COLS = `*, employee:employee_id(id, nome, cargo, servico, email, tipo_contrato, data_admissao, foto_path)`

/** Rescisões em andamento (kanban); com id, só essa (ficha), em qualquer situação */
export async function getRescisoes(companyId: string): Promise<Rescisao[]> {
  const { data, error } = await createAdminClient()
    .from('employee_terminations')
    .select(COLS)
    .eq('company_id', companyId)
    .eq('status', 'em_andamento')
    .order('created_at', { ascending: true })
  // Sem a tabela (migration 20261107000086 pendente) o kanban abre vazio
  if (error) { console.error('[rescisão] indisponível:', error.message); return [] }
  return (data ?? []) as unknown as Rescisao[]
}

export async function getRescisao(companyId: string, id: string): Promise<Rescisao | null> {
  const { data } = await createAdminClient().from('employee_terminations').select(COLS).eq('company_id', companyId).eq('id', id).maybeSingle()
  return (data as unknown as Rescisao | null) ?? null
}

/** Rescisão em andamento de um funcionário (botão na ficha dele) */
export async function getRescisaoAtiva(companyId: string, employeeId: string): Promise<{ id: string } | null> {
  const { data, error } = await createAdminClient()
    .from('employee_terminations')
    .select('id')
    .eq('company_id', companyId)
    .eq('employee_id', employeeId)
    .eq('status', 'em_andamento')
    .maybeSingle()
  if (error) return null
  return (data as { id: string } | null) ?? null
}

const COLS_ANOTACAO = 'id, texto, tipo, autor_id, autor_nome, created_at, autor:autor_id(avatar_url)'

/** Linha do tempo: mesmo formato das anotações da admissão */
export async function getAnotacoesRescisao(companyId: string, ids: string[]): Promise<Record<string, Anotacao[]>> {
  const mapa: Record<string, Anotacao[]> = {}
  for (const id of ids) mapa[id] = []
  if (!ids.length) return mapa
  const { data } = await createAdminClient()
    .from('termination_notes')
    .select(`termination_id, ${COLS_ANOTACAO}`)
    .eq('company_id', companyId)
    .in('termination_id', ids)
    .order('created_at', { ascending: true })
  for (const a of (data ?? []) as unknown as (Anotacao & { termination_id: string })[]) {
    mapa[a.termination_id]?.push({ ...a, employee_id: null })
  }
  return mapa
}

/** Exames demissionais, do mais recente para o mais antigo (mesmo formato do admissional) */
export async function getExamesRescisao(companyId: string, ids: string[]): Promise<Record<string, Exame[]>> {
  const mapa: Record<string, Exame[]> = {}
  for (const id of ids) mapa[id] = []
  if (!ids.length) return mapa
  const { data } = await createAdminClient()
    .from('termination_exams')
    .select('*')
    .eq('company_id', companyId)
    .in('termination_id', ids)
    .order('created_at', { ascending: false })
  for (const e of (data ?? []) as (Exame & { termination_id: string })[]) mapa[e.termination_id]?.push({ ...e, employee_id: null })
  return mapa
}
