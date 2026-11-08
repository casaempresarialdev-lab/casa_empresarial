import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FormNovoProduto } from './components/form-novo-produto'
import { exigirAcessoPagina } from '@/lib/auth/acesso'

export const dynamic = 'force-dynamic'

export default async function NovoProdutoPage() {
  await exigirAcessoPagina('operacional.produtos')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  return (
    <div className="w-full">
      <FormNovoProduto companyId={companyId} />
    </div>
  )
}
