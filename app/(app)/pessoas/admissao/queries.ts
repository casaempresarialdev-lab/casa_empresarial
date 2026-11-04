import { createAdminClient } from '@/lib/supabase/server'
import type { Employee } from '../funcionarios/queries'
import { ASSUNTO_PADRAO, MODELO_PADRAO, VALIDADE_PADRAO } from '@/lib/validations/admissao'
import { ETAPA_FINAL } from './etapas'

export type EmAdmissao = Employee & {
  admissao_em_espera?: boolean
  /** Vaga de origem; sem vaga = admissão direta */
  vaga: { id: string; titulo: string } | null
  /** Benefícios vinculados, em texto (para a carta proposta) */
  beneficios: string[]
}

export type ConfigAdmissao = { carta_assunto: string; carta_modelo: string; carta_validade_dias: number }

/** Configurações da empresa; o que não foi configurado usa o padrão do sistema */
export async function getConfigAdmissao(companyId: string): Promise<ConfigAdmissao> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('admission_settings')
    .select('carta_assunto, carta_modelo, carta_validade_dias')
    .eq('company_id', companyId)
    .maybeSingle()
  return {
    carta_assunto: data?.carta_assunto || ASSUNTO_PADRAO,
    carta_modelo: data?.carta_modelo || MODELO_PADRAO,
    carta_validade_dias: data?.carta_validade_dias ?? VALIDADE_PADRAO,
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
  pdf_path: string | null
  created_at: string
}

/** Carta mais recente de cada pessoa do kanban */
export async function getCartas(companyId: string, employeeIds: string[]): Promise<Record<string, Carta>> {
  if (!employeeIds.length) return {}
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('admission_offers')
    .select('id, employee_id, token, assunto, conteudo, status, expira_em, respondida_em, resposta_ip, pdf_path, created_at')
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

/** Quem está no kanban: em admissão e ainda não finalizado */
export async function getAdmissaoEmployees(companyId: string): Promise<EmAdmissao[]> {
  const admin = createAdminClient()
  const [{ data, error }, { data: candidaturas }] = await Promise.all([
    admin
      .from('employees')
      .select('*, employee_benefits(benefit:benefit_id(nome, valor, por_dia_trabalhado))')
      .eq('company_id', companyId)
      .eq('status', 'admissao')
      .order('nome', { ascending: true }),
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

export async function getOnboardingTokens(companyId: string): Promise<OnboardingTokenInfo[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('employee_onboarding_tokens')
    .select('employee_id, token, expires_at, used_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
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
  autor_nome: string
  created_at: string
}

export type Historico = { entrevistas: Entrevista[]; anotacoes: Anotacao[] }

const COLS_ENTREVISTA = 'id, employee_id, entrevistador_id, entrevistador_nome, data_hora, duracao_min, link_reuniao, status'
const COLS_ANOTACAO = 'id, employee_id, texto, autor_nome, created_at'

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
  for (const a of (anotacoes ?? []) as Anotacao[]) mapa[a.employee_id!]?.anotacoes.push(a)
  return mapa
}

/** Histórico guardado na candidatura (ex.: de quem já foi reprovado) */
export async function getHistoricoCandidatura(companyId: string, applicationId: string): Promise<Historico> {
  const admin = createAdminClient()
  const [{ data: entrevistas }, { data: anotacoes }] = await Promise.all([
    admin.from('admission_interviews').select(COLS_ENTREVISTA).eq('company_id', companyId).eq('application_id', applicationId).order('data_hora', { ascending: false }),
    admin.from('admission_notes').select(COLS_ANOTACAO).eq('company_id', companyId).eq('application_id', applicationId).order('created_at', { ascending: false }),
  ])
  return { entrevistas: (entrevistas ?? []) as Entrevista[], anotacoes: (anotacoes ?? []) as Anotacao[] }
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
