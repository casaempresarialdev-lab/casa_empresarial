import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getCompanyMembers, getPendingInvitations } from './queries'
import { UsuariosClient } from './components/usuarios-client'

export const dynamic = 'force-dynamic'

export default async function UsuariosPage() {
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

  const [members, invitations] = await Promise.all([
    getCompanyMembers(companyId),
    getPendingInvitations(companyId),
  ])

  return (
    <div className="max-w-5xl mx-auto">
      <UsuariosClient
        members={members}
        invitations={invitations}
        companyId={companyId}
        currentProfileId={user.id}
        currentUserRole={currentMember?.role ?? 'member'}
      />
    </div>
  )
}
