import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCategories } from './queries'
import { CategoriasClient } from './components/categorias-client'

export const dynamic = 'force-dynamic'

export default async function CategoriasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  const categories = await getCategories(companyId)

  return (
    <div className="max-w-3xl mx-auto">
      <CategoriasClient categories={categories} companyId={companyId} />
    </div>
  )
}
