import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { DEFAULT_BRAND_COLOR } from '@/lib/theme'
import { PageTitle } from '@/components/layout/page-title'
import { getCompany } from '../empresa/queries'
import { ConfigIdentidadeVisual } from './components/config-identidade-visual'

export const dynamic = 'force-dynamic'

export default async function ConfiguracoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  const admin = createAdminClient()
  const [company, { data: row }] = await Promise.all([
    getCompany(companyId),
    // select('*'): as colunas opcionais (migrations 20261023000053/54) podem ainda não existir
    admin.from('companies').select('*').eq('id', companyId).maybeSingle(),
  ])
  const extras = (row ?? {}) as Record<string, string | null | undefined>

  return (
    <div className="w-full">
      <PageTitle title="Configurações" description="Personalize a aparência da sua empresa no sistema" />

      <ConfigIdentidadeVisual
        companyId={companyId}
        logoUrl={company?.logo_url ?? null}
        logoReduzidaUrl={extras.logo_reduzida_url ?? null}
        logoReduzidaDisponivel={'logo_reduzida_url' in extras}
        iconeUrl={extras.icone_url ?? null}
        iconeDisponivel={'icone_url' in extras}
        corFundo={extras.cor_fundo ?? null}
        corFundoDisponivel={'cor_fundo' in extras}
        corPrimaria={company?.cor_primaria ?? DEFAULT_BRAND_COLOR}
      />
    </div>
  )
}
