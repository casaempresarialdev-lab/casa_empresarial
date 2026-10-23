import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { DEFAULT_BRAND_COLOR } from '@/lib/theme'
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
      <div className="mb-6 animate-enter">
        <h1 className="text-3xl font-extrabold" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>
          Configurações
        </h1>
        <p className="text-sm font-semibold mt-1" style={{ color: 'var(--color-text-muted)' }}>
          Personalize a aparência da sua empresa no sistema
        </p>
      </div>

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
