'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { salvarDadosAdmissao } from '@/lib/admissao-dados'

/** Preenchimento pelo próprio candidato, com o link recebido depois do aceite */
export async function submitOnboardingAction(
  token: string,
  formData: FormData,
): Promise<{ success?: true; error?: string }> {
  const admin = createAdminClient()

  const { data: tokenRow } = await admin
    .from('employee_onboarding_tokens')
    .select('employee_id, company_id, expires_at, used_at')
    .eq('token', token)
    .maybeSingle()

  if (!tokenRow) return { error: 'Link inválido.' }
  if (tokenRow.used_at) return { error: 'Este link já foi utilizado.' }
  if (new Date(tokenRow.expires_at) < new Date()) return { error: 'Este link expirou.' }

  const r = await salvarDadosAdmissao(admin, {
    employeeId: tokenRow.employee_id as string,
    companyId: tokenRow.company_id as string,
    formData,
  })
  if (r.error) return { error: r.error }

  await admin.from('employee_onboarding_tokens').update({ used_at: new Date().toISOString() }).eq('token', token)
  return { success: true }
}
