import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { AppStoreInitializer } from '@/components/layout/app-store-initializer'
import { AppShell } from '@/components/layout/app-shell'
import { Breadcrumb } from '@/components/layout/breadcrumb'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Buscar perfil e empresas via admin client (sb_publishable_* não propaga JWT ao PostgREST)
  const admin = createAdminClient()
  const cookieStore = await cookies()
  const activeCookieId = cookieStore.get('active_company_id')?.value

  const [{ data: profile }, { data: memberships }] = await Promise.all([
    admin.from('profiles').select('name, avatar_url').eq('id', user.id).single(),
    admin
      .from('company_members')
      .select('company_id, companies(id, razao_social, logo_url)')
      .eq('profile_id', user.id)
      .eq('status', 'active'),
  ])

  type Company = { id: string; razao_social: string; logo_url?: string | null }
  type MembershipRow = { company_id: string; companies: Company | Company[] | null }
  const companies: Company[] = ((memberships ?? []) as unknown as MembershipRow[])
    .flatMap((m) => {
      const c = m.companies
      if (!c) return []
      return Array.isArray(c) ? c : [c]
    })

  const firstCompanyId = companies[0]?.id ?? null
  const activeCompany  = companies.find(c => c.id === activeCookieId) ?? companies[0]
  const logoUrl        = activeCompany?.logo_url ?? null

  return (
    <AppStoreInitializer companies={companies} firstCompanyId={firstCompanyId}>
      <Sidebar logoUrl={logoUrl} />
      <AppShell>
        <Header
          companies={companies}
          userName={profile?.name ?? user.email ?? ''}
          userAvatar={profile?.avatar_url}
        />
        <main className="flex-1 pt-16 p-6" style={{ backgroundColor: 'var(--color-bg-default)' }}>
          <div className="mb-4">
            <Breadcrumb />
          </div>
          {children}
        </main>
      </AppShell>
    </AppStoreInitializer>
  )
}
