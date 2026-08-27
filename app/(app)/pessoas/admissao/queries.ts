import { createAdminClient } from '@/lib/supabase/server'
import type { Employee } from '../funcionarios/queries'

export type AdmissionStage = {
  id: string
  company_id: string
  key: string
  label: string
  color: string
  ordem: number
  is_final: boolean
}

// Colunas padrão do Kanban — semeadas automaticamente no primeiro acesso de cada
// empresa (mesma lógica de fallback já usada em Encargos). "key" nunca muda depois
// de criado, mesmo que o label seja editado — é o valor gravado em admission_stage.
const DEFAULT_STAGES: Omit<AdmissionStage, 'id' | 'company_id'>[] = [
  { key: 'entrevista',               label: 'Entrevista',               color: '#818cf8', ordem: 0, is_final: false },
  { key: 'enviar_formulario',        label: 'Enviar Formulário',        color: '#fbbf24', ordem: 1, is_final: false },
  { key: 'aguardando_preenchimento', label: 'Aguard. Preenchimento',    color: '#f97316', ordem: 2, is_final: false },
  { key: 'agendar_exame',            label: 'Agendar Exame',            color: '#38bdf8', ordem: 3, is_final: false },
  { key: 'aguardando_contabilidade', label: 'Aguard. Contabilidade',    color: '#a78bfa', ordem: 4, is_final: false },
  { key: 'assinatura',               label: 'Assinatura',               color: '#34d399', ordem: 5, is_final: false },
  { key: 'finalizado',               label: 'Finalizado',               color: '#22c55e', ordem: 6, is_final: true  },
]

export async function getAdmissionStages(companyId: string): Promise<AdmissionStage[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('company_admission_stages')
    .select('*')
    .eq('company_id', companyId)
    .order('ordem', { ascending: true })

  if (data && data.length > 0) return data as AdmissionStage[]

  // Primeiro acesso: semeia as colunas padrão pra essa empresa
  const { data: seeded, error } = await admin
    .from('company_admission_stages')
    .insert(DEFAULT_STAGES.map(s => ({ ...s, company_id: companyId })))
    .select('*')

  if (error || !seeded) return DEFAULT_STAGES.map(s => ({ ...s, id: s.key, company_id: companyId }))
  return (seeded as AdmissionStage[]).sort((a, b) => a.ordem - b.ordem)
}

export async function getFinalStageKey(companyId: string): Promise<string> {
  const stages = await getAdmissionStages(companyId)
  return stages.find(s => s.is_final)?.key ?? stages[stages.length - 1]?.key ?? 'finalizado'
}

export async function getAdmissaoEmployees(companyId: string): Promise<Employee[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('employees')
    .select('*')
    .eq('company_id', companyId)
    .in('status', ['admissao', 'experiencia'])
    .order('data_admissao', { ascending: false })

  if (error) throw error
  return (data ?? []) as unknown as Employee[]
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
