import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getDocuments, getFolders } from './queries'
import { DocsClient } from './components/docs-client'

export const dynamic = 'force-dynamic'

export default async function DocumentacaoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  const [documents, { folders, error: foldersError }] = await Promise.all([
    getDocuments(companyId),
    getFolders(companyId),
  ])

  return (
    <div className="w-full">
      <DocsClient documents={documents} folders={folders} foldersError={foldersError} companyId={companyId} />
    </div>
  )
}
