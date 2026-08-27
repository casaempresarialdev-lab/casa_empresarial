import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getAdmissaoEmployees, getOnboardingTokens, getAdmissionStages, type OnboardingTokenInfo } from './queries'
import { AdmissaoClient } from './components/admissao-client'

export const dynamic = 'force-dynamic'

export default async function AdmissaoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  const [employees, tokensArr, stages] = await Promise.all([
    getAdmissaoEmployees(companyId),
    getOnboardingTokens(companyId),
    getAdmissionStages(companyId),
  ])

  // Mantém apenas o token mais recente por funcionário
  const tokens: Record<string, OnboardingTokenInfo> = {}
  for (const t of tokensArr) {
    if (!tokens[t.employee_id]) tokens[t.employee_id] = t
  }

  // Gera signed URLs para fotos (bucket privado, TTL 1h)
  const admin = createAdminClient()
  const photoUrls: Record<string, string> = {}
  await Promise.all(
    employees
      .filter(e => e.foto_path)
      .map(async e => {
        const { data } = await admin.storage
          .from('documentos')
          .createSignedUrl(e.foto_path!, 3600)
        if (data?.signedUrl) photoUrls[e.id] = data.signedUrl
      })
  )

  return (
    <AdmissaoClient employees={employees} tokens={tokens} companyId={companyId} photoUrls={photoUrls} stages={stages} />
  )
}
