import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'
import { AppStoreInitializer } from '@/components/layout/app-store-initializer'
import { AppShell } from '@/components/layout/app-shell'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { PageTransition } from '@/components/layout/page-transition'
import { ThemeSync } from '@/components/layout/theme-sync'
import { themeCssVars } from '@/lib/theme'
import { getCompanyBranding } from '@/lib/company-branding'

// Favicon: ícone da empresa ativa, quando configurado (sobrescreve o icons do layout raiz)
export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies()
  const { iconeUrl } = await getCompanyBranding(cookieStore.get('active_company_id')?.value)
  return iconeUrl ? { icons: { icon: [{ url: iconeUrl, type: 'image/png' }], apple: iconeUrl } } : {}
}

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
      .select('company_id, role, companies(id, razao_social, logo_url, cor_primaria)')
      .eq('profile_id', user.id)
      .eq('status', 'active'),
    admin.from('employees').select('id, company_id').eq('profile_id', user.id),
  ])

  type Company = { id: string; razao_social: string; logo_url?: string | null; cor_primaria?: string | null }
  type MembershipRow = { company_id: string; role: string; companies: Company | Company[] | null }
  const membershipRows = (memberships ?? []) as unknown as MembershipRow[]
  const employeeIdByCompany = new Map((myEmployees ?? []).map(e => [e.company_id, e.id]))
  const companies: (Company & { role: string; employeeId: string | null })[] = membershipRows
    .flatMap((m) => {
      const c = m.companies
      if (!c) return []
      return (Array.isArray(c) ? c : [c]).map(company => ({
        ...company,
        role: m.role,
        employeeId: employeeIdByCompany.get(company.id) ?? null,
      }))
    })

  const firstCompanyId = companies[0]?.id ?? null
  const activeCompany  = companies.find(c => c.id === activeCookieId) ?? companies[0]
  const activeRole     = activeCompany?.role ?? null
  const myEmployeeId   = activeCompany?.employeeId ?? null

  const branding = await getCompanyBranding(activeCompany?.id)

  // Tema: cores derivadas da empresa ativa (server-side → sem flash).
  // --brand-icon: ícone da empresa no pré-loader (sem ele, o CSS usa o símbolo padrão).
  // background-color: cor de fundo configurada (sem ela, fica o branco padrão).
  const iconVar = branding.iconeUrl ? `;--brand-icon:url("${branding.iconeUrl.replace(/["\\]/g, '')}")` : ''
  const fundo   = branding.corFundo ? `;background-color:${branding.corFundo}` : ''
  const themeCSS = `body{${themeCssVars(activeCompany?.cor_primaria ?? null)}${iconVar}${fundo}}`

  const companyThemes = companies.map(c => ({ id: c.id, cor_primaria: c.cor_primaria ?? null }))

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: themeCSS }} />
      <AppStoreInitializer companies={companies} firstCompanyId={firstCompanyId}>
        <ThemeSync companies={companyThemes} />
        <Sidebar
          logoUrl={activeCompany?.logo_url ?? null}
          logoReduzidaUrl={branding.logoReduzidaUrl}
          role={activeRole}
          myEmployeeId={myEmployeeId}
          userName={profile?.name ?? user.email ?? ''}
          userAvatar={profile?.avatar_url}
          companies={companies}
        />
        <AppShell>
          <main className="flex-1 p-6 pt-16 md:pt-6">
            <div className="mb-4">
              <Breadcrumb />
            </div>
            <PageTransition>{children}</PageTransition>
          </main>
        </AppShell>
      </AppStoreInitializer>
    </>
  )
}
