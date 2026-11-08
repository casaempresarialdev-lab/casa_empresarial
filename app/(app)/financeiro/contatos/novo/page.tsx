import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FormNovoContato } from './components/form-novo-contato'
import { exigirAcessoPagina } from '@/lib/auth/acesso'

export const dynamic = 'force-dynamic'

export default async function NovoContatoPage() {
  await exigirAcessoPagina('financeiro.contatos')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  return (
    <div className="w-full">
      <FormNovoContato companyId={companyId} />
    </div>
  )
}
