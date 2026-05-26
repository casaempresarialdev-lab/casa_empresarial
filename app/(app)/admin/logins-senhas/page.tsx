import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCredentials } from './queries'
import { CredentialsClient } from './components/credentials-client'

export const dynamic = 'force-dynamic'

export default async function LoginseSenhasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  const credentials = await getCredentials(companyId)

  return (
    <div className="max-w-5xl mx-auto">
      <CredentialsClient credentials={credentials} companyId={companyId} />
    </div>
  )
}
