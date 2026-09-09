import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getContactById } from '../queries'
import { ViewContato } from './view-contato'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ContatoViewPage({ params }: Props) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  const contact = await getContactById(id, companyId)
  if (!contact) notFound()

  return (
    <div className="max-w-2xl mx-auto">
      <ViewContato contact={contact} />
    </div>
  )
}
