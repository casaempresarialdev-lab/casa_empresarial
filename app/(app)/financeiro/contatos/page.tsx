import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getContacts } from './queries'
import { ContatosClient } from './components/contatos-client'

export const dynamic = 'force-dynamic'

export default async function ContatosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  const contacts = await getContacts(companyId)

  return (
    <div className="max-w-5xl mx-auto">
      <ContatosClient contacts={contacts} companyId={companyId} />
    </div>
  )
}
