import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProducts } from './queries'
import { ProdutosClient } from './components/produtos-client'

export const dynamic = 'force-dynamic'

export default async function ProdutosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  const products = await getProducts(companyId)

  return (
    <div className="max-w-5xl mx-auto">
      <ProdutosClient products={products} companyId={companyId} />
    </div>
  )
}
