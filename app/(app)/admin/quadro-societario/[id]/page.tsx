import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSocioById, getSocios } from '../queries'
import { SocioPage } from './components/socio-page'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ aba?: string }>
}

export default async function SocioEditPage({ params, searchParams }: Props) {
  const [{ id }, { aba }] = await Promise.all([params, searchParams])

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  const [socio, socios] = await Promise.all([
    getSocioById(id, companyId),
    getSocios(companyId),
  ])
  if (!socio) notFound()

  // Participação já usada pelos outros sócios (este fica de fora)
  const outrasParticipacoes = socios
    .filter((s) => s.id !== socio.id)
    .reduce((sum, s) => sum + Number(s.participacao ?? 0), 0)

  return (
    <div className="w-full">
      <SocioPage
        socio={socio}
        companyId={companyId}
        outrasParticipacoes={outrasParticipacoes}
        abrirDocumentos={aba === 'documentos'}
      />
    </div>
  )
}
