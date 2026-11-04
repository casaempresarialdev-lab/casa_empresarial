import { createClient, createAdminClient } from '@/lib/supabase/server'

/** Para Server Actions: membro ativo da empresa, exceto colaborador (que só acessa os próprios dados) */
export async function requireGestor(companyId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' as const }

  const admin = createAdminClient()
  const { data: membro } = await admin
    .from('company_members')
    .select('role')
    .eq('company_id', companyId)
    .eq('profile_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  if (!membro || membro.role === 'colaborador') return { error: 'Sem permissão para esta ação.' as const }
  return { user, admin }
}
