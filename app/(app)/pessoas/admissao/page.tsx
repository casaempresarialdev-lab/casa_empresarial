import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getViewerContext } from '@/lib/auth/viewer'
import { getAdmissaoEmployees, getCartas, getConfigAdmissao, getEntrevistadores, getHistoricos, getOnboardingTokens, type OnboardingTokenInfo } from './queries'
import { getCompany } from '../../empresa/queries'
import { AdmissaoClient } from './components/admissao-client'

export const dynamic = 'force-dynamic'

export default async function AdmissaoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  const viewer = await getViewerContext(companyId)
  if (viewer?.isColaborador) redirect('/pessoas/registro-de-ponto')

  const [employees, tokensArr, entrevistadores, config, company] = await Promise.all([
    getAdmissaoEmployees(companyId),
    getOnboardingTokens(companyId),
    getEntrevistadores(companyId),
    getConfigAdmissao(companyId),
    getCompany(companyId),
  ])
  const ids = employees.map((e) => e.id)
  const [historicos, cartas] = await Promise.all([getHistoricos(companyId, ids), getCartas(companyId, ids)])

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
      .filter((e) => e.foto_path)
      .map(async (e) => {
        const { data } = await admin.storage.from('documentos').createSignedUrl(e.foto_path!, 3600)
        if (data?.signedUrl) photoUrls[e.id] = data.signedUrl
      }),
  )

  return (
    <div className="w-full">
      <AdmissaoClient
        employees={employees}
        tokens={tokens}
        companyId={companyId}
        photoUrls={photoUrls}
        historicos={historicos}
        entrevistadores={entrevistadores}
        usuarioId={user.id}
        cartas={cartas}
        config={config}
        empresa={company?.nome_fantasia || company?.razao_social || ''}
      />
    </div>
  )
}
