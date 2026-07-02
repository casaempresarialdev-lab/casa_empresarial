import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAdmissaoEmployees, getOnboardingTokens, type OnboardingTokenInfo } from './queries'
import { AdmissaoClient } from './components/admissao-client'

export const dynamic = 'force-dynamic'

export default async function AdmissaoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  const [employees, tokensArr] = await Promise.all([
    getAdmissaoEmployees(companyId),
    getOnboardingTokens(companyId),
  ])

  // Mantém apenas o token mais recente por funcionário
  const tokens: Record<string, OnboardingTokenInfo> = {}
  for (const t of tokensArr) {
    if (!tokens[t.employee_id]) tokens[t.employee_id] = t
  }

  return (
    <div className="max-w-5xl mx-auto">
      <AdmissaoClient employees={employees} tokens={tokens} companyId={companyId} />
    </div>
  )
}
