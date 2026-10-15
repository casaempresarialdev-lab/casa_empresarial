import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { AppStoreInitializer } from '@/components/layout/app-store-initializer'
import { AppShell } from '@/components/layout/app-shell'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { ThemeSync } from '@/components/layout/theme-sync'
import { deriveThemeColors } from '@/lib/theme'
import { parseAreaPermissions, FULL_AREA_PERMISSIONS } from '@/lib/auth/area-permissions'
import { getMenuTree } from '@/lib/menu/queries'

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

  const [{ data: profile }, { data: memberships }, { data: myEmployees }] = await Promise.all([
    admin.from('profiles').select('name, avatar_url').eq('id', user.id).single(),
    admin
      .from('company_members')
      .select('company_id, role, permissions, companies(id, razao_social, logo_url, cor_primaria)')
      .eq('profile_id', user.id)
      .eq('status', 'active'),
    admin.from('employees').select('id, company_id').eq('profile_id', user.id),
  ])

  type Company = { id: string; razao_social: string; logo_url?: string | null; cor_primaria?: string | null }
  type MembershipRow = { company_id: string; role: string; permissions: Record<string, string> | null; companies: Company | Company[] | null }
  const membershipRows = (memberships ?? []) as unknown as MembershipRow[]
  const employeeIdByCompany = new Map((myEmployees ?? []).map(e => [e.company_id, e.id]))
  const companies: (Company & { role: string; employeeId: string | null; permissions: Record<string, string> | null })[] = membershipRows
    .flatMap((m) => {
      const c = m.companies
      if (!c) return []
      return (Array.isArray(c) ? c : [c]).map(company => ({
        ...company,
        role: m.role,
        employeeId: employeeIdByCompany.get(company.id) ?? null,
        permissions: m.permissions,
      }))
    })

  const firstCompanyId = companies[0]?.id ?? null
  const activeCompany  = companies.find(c => c.id === activeCookieId) ?? companies[0]
  const logoUrl        = activeCompany?.logo_url ?? null
  const activeRole     = activeCompany?.role ?? null
  const myEmployeeId   = activeCompany?.employeeId ?? null
  const areaPermissions = activeRole === 'owner'
    ? FULL_AREA_PERMISSIONS
    : parseAreaPermissions(activeCompany?.permissions)

  // Colaborador usa a navegação própria (restrita), não a árvore de menu da empresa.
  const menuTree = (activeCompany?.id && activeRole !== 'colaborador')
    ? await getMenuTree(activeCompany.id)
    : []

  // Tema: cores derivadas da empresa ativa (server-side → sem flash)
  const { primary, dark, darker } = deriveThemeColors(activeCompany?.cor_primaria ?? null)
  const themeCSS = `body{--color-primary:${primary};--color-primary-dark:${dark};--color-primary-darker:${darker}}`

  const companyThemes = companies.map(c => ({ id: c.id, cor_primaria: c.cor_primaria ?? null }))

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: themeCSS }} />
      <AppStoreInitializer companies={companies} firstCompanyId={firstCompanyId}>
        <ThemeSync companies={companyThemes} />
        <Sidebar
          logoUrl={logoUrl}
          role={activeRole}
          myEmployeeId={myEmployeeId}
          areaPermissions={areaPermissions}
          companyId={activeCompany?.id ?? null}
          menuTree={menuTree}
          companies={companies}
          userName={profile?.name ?? user.email ?? ''}
          userEmail={user.email ?? undefined}
          userAvatar={profile?.avatar_url}
        />
        <AppShell>
          <Header />
          <main className="flex-1 pt-16 p-6" style={{ backgroundColor: 'var(--color-bg-default)' }}>
            <div className="mb-4">
              <Breadcrumb />
            </div>
            {children}
          </main>
        </AppShell>
      </AppStoreInitializer>
    </>
  )
}
