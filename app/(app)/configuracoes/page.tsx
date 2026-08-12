import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
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

  const company = await getCompany(companyId)

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
          Configurações
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
          Personalize a aparência da sua empresa no sistema
        </p>
      </div>

      <div className="bg-white rounded-2xl border p-6" style={{ borderColor: 'var(--color-bg-surface)' }}>
        <p
          className="text-xs font-bold uppercase tracking-wider pb-3 mb-4 border-b"
          style={{ color: 'var(--color-primary-darker)', borderColor: 'var(--color-bg-surface)', letterSpacing: '0.06em' }}
        >
          Identidade Visual
        </p>
        <ConfigIdentidadeVisual
          companyId={companyId}
          logoUrl={company?.logo_url ?? null}
          corPrimaria={company?.cor_primaria ?? '#C19A6B'}
        />
      </div>
    </div>
  )
}
