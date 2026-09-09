import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FormNovoContato } from './components/form-novo-contato'

export const dynamic = 'force-dynamic'

export default async function NovoContatoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  return (
    <div className="max-w-2xl mx-auto">
      <FormNovoContato companyId={companyId} />
    </div>
  )
}
