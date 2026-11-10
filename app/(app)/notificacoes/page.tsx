import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getAvisosSistema } from '@/lib/notificacoes'
import { getNotificacoes, getAvisosCalendario } from '../calendario/queries'
import { getAvisosCompartilhamento } from '../cofre-de-senhas/queries'
import { NotificacoesClient } from './components/notificacoes-client'

export const dynamic = 'force-dynamic'

export default async function NotificacoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const companyId = (await cookies()).get('active_company_id')?.value
  const [notificacoes, compartilhamentos, calendario, sistema] = await Promise.all([
    getNotificacoes(user.id), getAvisosCompartilhamento(user.id, 200), getAvisosCalendario(user.id, 200), getAvisosSistema(createAdminClient(), user.id, companyId, 200),
  ])

  return (
    <div className="w-full">
      <NotificacoesClient notificacoes={notificacoes} compartilhamentos={compartilhamentos} calendario={calendario} sistema={sistema} />
    </div>
  )
}
