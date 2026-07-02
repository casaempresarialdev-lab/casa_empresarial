import { createAdminClient } from '@/lib/supabase/server'
import type { Employee } from '../funcionarios/queries'

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
