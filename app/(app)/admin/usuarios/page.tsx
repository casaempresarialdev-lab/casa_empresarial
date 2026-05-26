import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
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
      />
    </div>
  )
}
