import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getCompanyMembers, getPendingInvitations, getPerfisAcesso } from './queries'
import { AcessoClient } from './components/acesso-client'
import { getCargosOpcoes } from '../../empresa/estrutura/queries'
import { exigirAcessoPagina } from '@/lib/auth/acesso'

export const dynamic = 'force-dynamic'

export default async function AcessoPage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  await exigirAcessoPagina('sistema.acesso')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  const admin = createAdminClient()
  const { data: currentMember } = await admin
    .from('company_members')
    .select('role')
    .eq('company_id', companyId)
    .eq('profile_id', user.id)
    .eq('status', 'active')
    .single()

  const [members, invitations, perfis, cargos, { aba }] = await Promise.all([
    getCompanyMembers(companyId),
    getPendingInvitations(companyId),
    getPerfisAcesso(companyId),
    getCargosOpcoes(companyId),
    searchParams,
  ])

  return (
    <div className="w-full">
      <AcessoClient
        abaInicial={aba === 'usuarios' ? 1 : 0}
        perfis={perfis}
        cargos={cargos}
        members={members}
        invitations={invitations}
        companyId={companyId}
        currentProfileId={user.id}
        currentUserRole={currentMember?.role ?? 'member'}
        currentUserEmail={user.email ?? ''}
      />
    </div>
  )
}
