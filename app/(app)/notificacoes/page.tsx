import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getNotificacoes, getAvisosCalendario } from '../calendario/queries'
import { getAvisosCompartilhamento } from '../cofre-de-senhas/queries'
import { NotificacoesClient } from './components/notificacoes-client'

export const dynamic = 'force-dynamic'

export default async function NotificacoesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [notificacoes, compartilhamentos, calendario] = await Promise.all([getNotificacoes(user.id), getAvisosCompartilhamento(user.id, 200), getAvisosCalendario(user.id, 200)])

  return (
    <div className="w-full">
      <NotificacoesClient notificacoes={notificacoes} compartilhamentos={compartilhamentos} calendario={calendario} />
    </div>
  )
}
