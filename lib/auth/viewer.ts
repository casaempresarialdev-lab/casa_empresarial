import { createClient, createAdminClient } from '@/lib/supabase/server'
import { parseAreaPermissions, FULL_AREA_PERMISSIONS, type AreaPermissions } from './area-permissions'

export type ViewerContext = {
  userId: string
  role: string
  isColaborador: boolean
  /** id do próprio registro em `employees` nesta empresa, quando o usuário é um colaborador vinculado */
  myEmployeeId: string | null
  /** Permissão por área (administrativo/financeiro/pessoas/operacional/marketing). Owner sempre vem como acesso total. */
  areaPermissions: AreaPermissions
}

/**
 * Resolve o role do usuário logado na empresa ativa, a permissão por área do
 * vínculo e, se for "colaborador", o employee_id vinculado a ele — usado
 * pelas telas que precisam restringir dados a "apenas os meus" (Registro de
 * Ponto, Escala, Folha, Benefícios) ou recusar ação sem permissão de Editar.
 */
export async function getViewerContext(companyId: string): Promise<ViewerContext | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const [{ data: membership }, { data: employee }] = await Promise.all([
    admin.from('company_members').select('role, permissions').eq('company_id', companyId).eq('profile_id', user.id).eq('status', 'active').single(),
    admin.from('employees').select('id').eq('company_id', companyId).eq('profile_id', user.id).maybeSingle(),
  ])

  const role = membership?.role ?? 'member'
  const areaPermissions = role === 'owner' ? FULL_AREA_PERMISSIONS : parseAreaPermissions(membership?.permissions)

  return {
    userId: user.id,
    role,
    isColaborador: role === 'colaborador',
    myEmployeeId: employee?.id ?? null,
    areaPermissions,
  }
}
