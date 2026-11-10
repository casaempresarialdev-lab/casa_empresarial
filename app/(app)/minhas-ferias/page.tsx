import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { exigirAcessoPagina } from '@/lib/auth/acesso'
import { getConfigFolha } from '../pessoas/folha-de-pagamento/queries'
import { getFeriasEquipe } from '../pessoas/ferias/queries'
import { MinhasFeriasClient } from './components/minhas-ferias-client'

export const dynamic = 'force-dynamic'

// Férias do próprio colaborador: períodos aquisitivos, saldo e pedidos
export default async function MinhasFeriasPage() {
  await exigirAcessoPagina('visao-geral.bater-ponto')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const companyId = (await cookies()).get('active_company_id')?.value
  if (!companyId) redirect('/dashboard')

  const [{ data: ficha }, config] = await Promise.all([
    createAdminClient().from('employees').select('id, nome, data_admissao').eq('company_id', companyId).eq('profile_id', user.id).not('status', 'in', '(inativo,demitido)').limit(1).maybeSingle(),
    getConfigFolha(companyId),
  ])
  // Só as próprias férias chegam à tela
  const ferias = ficha ? (await getFeriasEquipe(companyId)).filter((f) => f.employee_id === ficha.id) : []

  return (
    <div className="w-full">
      <MinhasFeriasClient
        pessoa={ficha ? { id: ficha.id as string, nome: ficha.nome as string, data_admissao: ficha.data_admissao as string | null } : null}
        ferias={ferias}
        config={config}
      />
    </div>
  )
}
