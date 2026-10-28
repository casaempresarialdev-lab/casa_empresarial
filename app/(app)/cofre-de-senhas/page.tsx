import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCofre } from './queries'
import { CredentialsClient } from './components/credentials-client'

export const dynamic = 'force-dynamic'

export default async function CofreDeSenhasPage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [cofre, { aba }] = await Promise.all([getCofre(user.id), searchParams])

  return (
    <div className="w-full">
      {/* key: ao chegar por um link de notificação com outra aba, a tela reabre nela */}
      <CredentialsClient key={aba ?? 'minhas'} minhas={cofre.minhas} compartilhadas={cofre.compartilhadas} temPin={cofre.temPin} abaInicial={aba === 'compartilhadas' ? 'compartilhadas' : 'minhas'} />
    </div>
  )
}
