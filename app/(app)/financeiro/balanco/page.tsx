import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getBPData } from './queries'
import { BalancoClient } from './components/balanco-client'

export const dynamic = 'force-dynamic'

export default async function BalancoPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; ano?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  const params = await searchParams
  const now = new Date()
  const mes = parseInt(params.mes ?? String(now.getMonth() + 1))
  const ano = parseInt(params.ano ?? String(now.getFullYear()))

  // Último dia do mês selecionado
  const dataBase = new Date(ano, mes, 0).toISOString().split('T')[0]
  // Início do exercício fiscal (1º de janeiro do ano)
  const inicioExercicio = `${ano}-01-01`

  const bpData = await getBPData(companyId, dataBase, inicioExercicio)

  return (
    <div className="max-w-5xl mx-auto">
      <BalancoClient bpData={bpData} mes={mes} ano={ano} companyId={companyId} />
    </div>
  )
}
