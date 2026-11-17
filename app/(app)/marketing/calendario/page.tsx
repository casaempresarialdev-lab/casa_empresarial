import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { exigirAcessoPagina } from '@/lib/auth/acesso'
import { getConteudosMarketing } from './queries'
import { CalendarioClient } from './components/calendario-client'

export const dynamic = 'force-dynamic'

export default async function CalendarioEditorialPage({
  searchParams,
}: {
  searchParams: Promise<{ prefillTitulo?: string; prefillFormato?: string }>
}) {
  await exigirAcessoPagina('marketing.calendario')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const companyId = (await cookies()).get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  const [conteudos, params] = await Promise.all([getConteudosMarketing(companyId), searchParams])

  return (
    <div className="w-full">
      <CalendarioClient
        conteudos={conteudos}
        companyId={companyId}
        prefill={params.prefillTitulo ? { titulo: params.prefillTitulo, formato: params.prefillFormato ?? '' } : null}
      />
    </div>
  )
}
