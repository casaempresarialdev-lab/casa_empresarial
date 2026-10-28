import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getPerfil } from './queries'
import { PerfilClient } from './components/perfil-client'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ aba?: string }>
}

export default async function PerfilPage({ searchParams }: Props) {
  const { aba } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const perfil = await getPerfil(user.id)
  if (!perfil) redirect('/dashboard')

  return (
    <div className="w-full">
      <PerfilClient perfil={perfil} email={user.email ?? ''} abaInicial={aba} />
    </div>
  )
}
