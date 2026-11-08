import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getEmployees } from './queries'
import { FuncionariosClient } from './components/funcionarios-client'
import { getRescisoes } from '../rescisao/queries'
import { exigirAcessoPagina } from '@/lib/auth/acesso'

export const dynamic = 'force-dynamic'

export default async function FuncionariosPage() {
  await exigirAcessoPagina('pessoas.funcionarios')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  const [employees, emRescisao] = await Promise.all([getEmployees(companyId), getRescisoes(companyId)])
  // Quem já tem rescisão em andamento: o menu leva à ficha dela em vez de iniciar outra
  const rescisoes = Object.fromEntries(emRescisao.map((r) => [r.employee_id, r.id]))

  // Signed URLs das fotos (bucket privado, TTL 1h)
  const admin = createAdminClient()
  const photoUrls: Record<string, string> = {}
  await Promise.all(
    employees
      .filter((e) => e.foto_path)
      .map(async (e) => {
        const { data } = await admin.storage.from('documentos').createSignedUrl(e.foto_path!, 3600)
        if (data?.signedUrl) photoUrls[e.id] = data.signedUrl
      }),
  )

  return (
    <div className="w-full">
      <FuncionariosClient
        employees={employees}
        photoUrls={photoUrls}
        companyId={companyId}
        rescisoes={rescisoes}
      />
    </div>
  )
}
