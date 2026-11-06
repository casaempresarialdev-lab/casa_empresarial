import { createAdminClient } from '@/lib/supabase/server'
import type { Employee } from '../funcionarios/queries'
import {
  ASSUNTO_PADRAO, EXAME_ASSUNTO_PADRAO, EXAME_MODELO_PADRAO, EXAME_REPROVACAO_ASSUNTO_PADRAO, EXAME_REPROVACAO_MODELO_PADRAO, MODELO_PADRAO, REPROVACAO_ASSUNTO_PADRAO, REPROVACAO_MODELO_PADRAO, VALIDADE_PADRAO,
} from '@/lib/validations/admissao'
import { ETAPA_FINAL } from './etapas'

export type EmAdmissao = Employee & {
  admissao_em_espera?: boolean
  /** Vaga de origem; sem vaga = admissão direta */
  vaga: { id: string; titulo: string } | null
  /** Benefícios vinculados, em texto (para a carta proposta) */
  beneficios: string[]
}

export type ConfigAdmissao = {
  carta_assunto: string
  carta_modelo: string
  carta_validade_dias: number
  reprovacao_notificar: boolean
  reprovacao_assunto: string
  reprovacao_modelo: string
  exame_notificar: boolean
  exame_assunto: string
  exame_modelo: string
  /** Guia geral: vale para as clínicas sem guia própria */
  exame_guia_path: string | null
  exame_guia_nome: string | null
  exame_reprovacao_notificar: boolean
  exame_reprovacao_assunto: string
  exame_reprovacao_modelo: string
}

/** Configurações da empresa; o que não foi configurado usa o padrão do sistema */
export async function getConfigAdmissao(companyId: string): Promise<ConfigAdmissao> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('admission_settings')
    // '*': as colunas de reprovação e de exame podem ainda não existir (migrations 20261104000080 e 20261106000082)
    .select('*')
    .eq('company_id', companyId)
    .maybeSingle()
  return {
    carta_assunto: data?.carta_assunto || ASSUNTO_PADRAO,
    carta_modelo: data?.carta_modelo || MODELO_PADRAO,
    carta_validade_dias: data?.carta_validade_dias ?? VALIDADE_PADRAO,
    reprovacao_notificar: data?.reprovacao_notificar ?? false,
    reprovacao_assunto: data?.reprovacao_assunto || REPROVACAO_ASSUNTO_PADRAO,
    reprovacao_modelo: data?.reprovacao_modelo || REPROVACAO_MODELO_PADRAO,
    exame_notificar: data?.exame_notificar ?? true,
    exame_assunto: data?.exame_assunto || EXAME_ASSUNTO_PADRAO,
    exame_modelo: data?.exame_modelo || EXAME_MODELO_PADRAO,
    exame_guia_path: data?.exame_guia_path ?? null,
    exame_guia_nome: data?.exame_guia_nome ?? null,
    exame_reprovacao_notificar: data?.exame_reprovacao_notificar ?? false,
    exame_reprovacao_assunto: data?.exame_reprovacao_assunto || EXAME_REPROVACAO_ASSUNTO_PADRAO,
    exame_reprovacao_modelo: data?.exame_reprovacao_modelo || EXAME_REPROVACAO_MODELO_PADRAO,
  }
}

export type Carta = {
  id: string
  employee_id: string
  token: string
  assunto: string
  conteudo: string
  status: 'enviada' | 'aceita' | 'recusada' | 'substituida'
  expira_em: string
  respondida_em: string | null
  resposta_ip: string | null
  /** Aceite registrado no painel: quem registrou */
  aceite_registrado_por?: string | null
  /** Data de início proposta (sugerida como data de admissão no fim) */
  data_inicio?: string | null
  pdf_path: string | null
  created_at: string
}

/** Carta mais recente de cada pessoa do kanban */
export async function getCartas(companyId: string, employeeIds: string[]): Promise<Record<string, Carta>> {
  if (!employeeIds.length) return {}
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('admission_offers')
    // '*': aceite_registrado_por pode ainda não existir (migration 20261106000081)
    .select('*')
    .eq('company_id', companyId)
    .in('employee_id', employeeIds)
    .neq('status', 'substituida')
    .order('created_at', { ascending: false })
  // Sem as cartas (ex.: migration 20261105000078 pendente) o kanban continua abrindo
  if (error) console.error('[admissão] cartas indisponíveis:', error.message)

  const mapa: Record<string, Carta> = {}
  for (const c of (data ?? []) as Carta[]) if (!mapa[c.employee_id]) mapa[c.employee_id] = c
  return mapa
}

/** Quem está no kanban: em admissão e ainda não finalizado. Com employeeId, só essa pessoa (ficha de admissão). */
export async function getAdmissaoEmployees(companyId: string, employeeId?: string): Promise<EmAdmissao[]> {
  const admin = createAdminClient()
  const consulta = admin
    .from('employees')
    .select('*, employee_benefits(benefit:benefit_id(nome, valor, por_dia_trabalhado))')
    .eq('company_id', companyId)
    .eq('status', 'admissao')
    .order('nome', { ascending: true })
  const [{ data, error }, { data: candidaturas }] = await Promise.all([
    employeeId ? consulta.eq('id', employeeId) : consulta,
    admin
      .from('job_applications')
      .select('employee_id, vaga_id, job_openings(titulo)')
      .eq('company_id', companyId)
      .not('employee_id', 'is', null),
  ])
  if (error) throw error

  const vagaPorFuncionario = new Map(
    ((candidaturas ?? []) as unknown as { employee_id: string; vaga_id: string; job_openings: { titulo: string } | null }[])
      .map((c) => [c.employee_id, { id: c.vaga_id, titulo: c.job_openings?.titulo ?? 'Vaga' }]),
  )

  type Vinculo = { benefit: { nome: string; valor: number; por_dia_trabalhado: boolean } | null }

  return ((data ?? []) as unknown as (Omit<Employee, 'employee_benefits'> & { employee_benefits: Vinculo[] })[])
    .filter((e) => e.admission_stage !== ETAPA_FINAL)
    .map(({ employee_benefits, ...e }) => ({
      ...e,
      employee_benefits: [],
      vaga: vagaPorFuncionario.get(e.id) ?? null,
      beneficios: employee_benefits
        .filter((b) => b.benefit)
        .map((b) => `${b.benefit!.nome} (${b.benefit!.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}${b.benefit!.por_dia_trabalhado ? '/dia' : '/mês'})`),
    }))
}

export type OnboardingTokenInfo = {
  employee_id: string
  token: string
  expires_at: string
  used_at: string | null
}

export async function getOnboardingTokens(companyId: string, employeeId?: string): Promise<OnboardingTokenInfo[]> {
  const admin = createAdminClient()
  const consulta = admin
    .from('employee_onboarding_tokens')
    .select('employee_id, token, expires_at, used_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
  const { data } = await (employeeId ? consulta.eq('employee_id', employeeId) : consulta)
  return (data ?? []) as OnboardingTokenInfo[]
}

// ── Entrevistas e anotações ──────────────────────────────────────────────────

export type Entrevista = {
  id: string
  employee_id: string | null
  entrevistador_id: string | null
  entrevistador_nome: string
  data_hora: string
  duracao_min: number
  link_reuniao: string | null
  status: 'agendada' | 'cancelada'
}

export type Anotacao = {
  id: string
  employee_id: string | null
  texto: string
  /** "evento": registrado pelo sistema; "anotacao": escrita por alguém */
  tipo: 'anotacao' | 'evento'
  autor_id: string | null
  autor_nome: string
  /** Foto de quem escreveu (candidato não tem conta) */
  autor?: { avatar_url: string | null } | null
  created_at: string
}

export type Historico = { entrevistas: Entrevista[]; anotacoes: Anotacao[] }

const COLS_ENTREVISTA = 'id, employee_id, entrevistador_id, entrevistador_nome, data_hora, duracao_min, link_reuniao, status'
const COLS_ANOTACAO = 'id, employee_id, texto, tipo, autor_id, autor_nome, created_at, autor:autor_id(avatar_url)'

/** Histórico de cada pessoa do kanban */
export async function getHistoricos(companyId: string, employeeIds: string[]): Promise<Record<string, Historico>> {
  const mapa: Record<string, Historico> = {}
  for (const id of employeeIds) mapa[id] = { entrevistas: [], anotacoes: [] }
  if (!employeeIds.length) return mapa

  const admin = createAdminClient()
  const [{ data: entrevistas, error: e1 }, { data: anotacoes, error: e2 }] = await Promise.all([
    admin.from('admission_interviews').select(COLS_ENTREVISTA).eq('company_id', companyId).in('employee_id', employeeIds).order('data_hora', { ascending: false }),
    admin.from('admission_notes').select(COLS_ANOTACAO).eq('company_id', companyId).in('employee_id', employeeIds).order('created_at', { ascending: false }),
  ])
  // Sem o histórico (ex.: migration 20261104000077 pendente) o kanban continua abrindo
  if (e1 || e2) console.error('[admissão] histórico indisponível:', e1?.message ?? e2?.message)

  for (const e of (entrevistas ?? []) as Entrevista[]) mapa[e.employee_id!]?.entrevistas.push(e)
  for (const a of (anotacoes ?? []) as unknown as Anotacao[]) mapa[a.employee_id!]?.anotacoes.push(a)
  return mapa
}

/** Histórico guardado na candidatura (ex.: de quem já foi reprovado) */
export async function getHistoricoCandidatura(companyId: string, applicationId: string): Promise<Historico> {
  const admin = createAdminClient()
  const [{ data: entrevistas }, { data: anotacoes }] = await Promise.all([
    admin.from('admission_interviews').select(COLS_ENTREVISTA).eq('company_id', companyId).eq('application_id', applicationId).order('data_hora', { ascending: false }),
    admin.from('admission_notes').select(COLS_ANOTACAO).eq('company_id', companyId).eq('application_id', applicationId).order('created_at', { ascending: false }),
  ])
  return { entrevistas: (entrevistas ?? []) as Entrevista[], anotacoes: (anotacoes ?? []) as unknown as Anotacao[] }
}

// ── Exame admissional ────────────────────────────────────────────────────────

export type Clinica = {
  id: string
  nome: string
  endereco: string | null
  telefone: string | null
  orientacoes: string | null
  guia_path: string | null
  guia_nome: string | null
}

/** Clínicas cadastradas nas configurações (sem a tabela, migration 20261106000082 pendente: nenhuma) */
export async function getClinicas(companyId: string): Promise<Clinica[]> {
  const { data, error } = await createAdminClient()
    .from('admission_clinics')
    .select('id, nome, endereco, telefone, orientacoes, guia_path, guia_nome')
    .eq('company_id', companyId)
    .eq('ativo', true)
    .order('nome', { ascending: true })
  if (error) console.error('[admissão] clínicas indisponíveis:', error.message)
  return (data ?? []) as Clinica[]
}

export type Exame = {
  id: string
  employee_id: string | null
  clinic_id: string | null
  clinica_nome: string
  clinica_endereco: string | null
  clinica_telefone: string | null
  data_hora: string | null
  orientacoes: string | null
  status: 'encaminhado' | 'realizado' | 'substituido'
  email_enviado: boolean
  realizado_em: string | null
  created_at: string
  /** Resultado registrado (migration 20261106000083) */
  resultado?: 'apto' | 'inapto' | null
  resultado_data?: string | null
  resultado_observacoes?: string | null
  aso_path?: string | null
  resultado_por?: string | null
}

/** Encaminhamentos de cada pessoa, do mais recente para o mais antigo */
export async function getExames(companyId: string, employeeIds: string[]): Promise<Record<string, Exame[]>> {
  const mapa: Record<string, Exame[]> = {}
  for (const id of employeeIds) mapa[id] = []
  if (!employeeIds.length) return mapa
  const { data, error } = await createAdminClient()
    .from('admission_exams')
    // '*': as colunas do resultado podem ainda não existir (migration 20261106000083)
    .select('*')
    .eq('company_id', companyId)
    .in('employee_id', employeeIds)
    .order('created_at', { ascending: false })
  if (error) console.error('[admissão] exames indisponíveis:', error.message)
  for (const e of (data ?? []) as Exame[]) mapa[e.employee_id!]?.push(e)
  return mapa
}

export type Entrevistador = { id: string; nome: string }

/** Quem pode entrevistar: usuários ativos da empresa, exceto colaboradores */
export async function getEntrevistadores(companyId: string): Promise<Entrevistador[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('company_members')
    .select('profile_id, role, profiles!profile_id(name)')
    .eq('company_id', companyId)
    .eq('status', 'active')
    .neq('role', 'colaborador')

  return ((data ?? []) as unknown as { profile_id: string; profiles: { name: string } | null }[])
    .map((m) => ({ id: m.profile_id, nome: m.profiles?.name ?? 'Usuário' }))
    .sort((a, b) => a.nome.localeCompare(b.nome))
}
