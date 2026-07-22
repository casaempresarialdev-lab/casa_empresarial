import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { PortalPonto } from '../components/portal-ponto'
import type { PontoSession } from '../actions'

export const dynamic = 'force-dynamic'

export default async function PontoPage() {
  const cookieStore = await cookies()
  const sessionRaw = cookieStore.get('ponto_session')?.value

  if (!sessionRaw) redirect('/registrar-ponto')

  let session: PontoSession
  try {
    session = JSON.parse(sessionRaw)
  } catch {
    redirect('/registrar-ponto')
  }

  const admin = createAdminClient()
  const hoje  = new Date().toISOString().slice(0, 10)

  // Registro de hoje (se houver)
  const { data: registroHoje } = await admin
    .from('time_records')
    .select('id, entrada, saida_almoco, retorno_almoco, saida, data')
    .eq('company_id', session.companyId)
    .eq('employee_id', session.employeeId)
    .eq('data', hoje)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ backgroundColor: '#FAF8F9' }}>
      <PortalPonto session={session} registroHoje={registroHoje ?? null} />
    </div>
  )
}
