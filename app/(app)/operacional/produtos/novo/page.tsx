import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FormNovoProduto } from './components/form-novo-produto'

export const dynamic = 'force-dynamic'

export default async function NovoProdutoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  return (
    <div className="max-w-2xl mx-auto">
      <FormNovoProduto companyId={companyId} />
    </div>
  )
}
