import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getLembretes } from './queries'
import { LembretesClient } from './components/lembretes-client'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ novo?: string }>
}

export default async function LembretesPage({ searchParams }: Props) {
  const { novo } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const lembretes = await getLembretes(user.id)

  return (
    <div className="w-full">
      {/* ?novo=1: vindo do atalho "Novo lembrete" da barra de ferramentas */}
      <LembretesClient lembretes={lembretes} abrirNovo={novo === '1'} />
    </div>
  )
}
