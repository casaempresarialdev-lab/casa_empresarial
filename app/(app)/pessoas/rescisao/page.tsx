import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getViewerContext } from '@/lib/auth/viewer'
import { getActiveEmployees } from '../funcionarios/queries'
import { getEtapasRescisao, getExamesRescisao, getRescisoes } from './queries'
import { RescisaoClient } from './components/rescisao-client'

export const dynamic = 'force-dynamic'

export default async function RescisaoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  const viewer = await getViewerContext(companyId)
  if (viewer?.isColaborador) redirect('/pessoas/registro-de-ponto')

  const [rescisoes, etapas, equipe] = await Promise.all([
    getRescisoes(companyId),
    getEtapasRescisao(companyId),
    getActiveEmployees(companyId),
  ])
  const exames = await getExamesRescisao(companyId, rescisoes.map((r) => r.id))

  // Fotos em bucket privado: links temporários (1h)
  const admin = createAdminClient()
  const fotos: Record<string, string> = {}
  await Promise.all(rescisoes.filter((r) => r.employee.foto_path).map(async (r) => {
    const { data } = await admin.storage.from('documentos').createSignedUrl(r.employee.foto_path!, 3600)
    if (data?.signedUrl) fotos[r.id] = data.signedUrl
  }))

  // "Nova rescisão": quem está na Equipe e ainda não tem processo em andamento
  const emRescisao = new Set(rescisoes.map((r) => r.employee_id))
  const funcionarios = equipe.filter((e) => !emRescisao.has(e.id)).map((e) => ({ id: e.id, nome: e.nome }))

  return (
    <div className="w-full">
      <RescisaoClient rescisoes={rescisoes} etapas={etapas} exames={exames} fotos={fotos} funcionarios={funcionarios} companyId={companyId} />
    </div>
  )
}
