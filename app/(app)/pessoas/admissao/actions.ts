'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function updateAdmissionStageAction(
  employeeId: string,
  stage: string,
) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('employees')
    .update({ admission_stage: stage })
    .eq('id', employeeId)

  if (error) return { error: error.message }
  revalidatePath('/pessoas/admissao')
  return { success: true }
}

export async function updateEmployeeStatusAction(
  employeeId: string,
  status: 'admissao' | 'experiencia' | 'ativo' | 'inativo' | 'demitido',
) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const updates: Record<string, unknown> = { status }
  // ao avançar para fora do funil de admissão, garante que o Kanban seja considerado concluído
  // (senão o funcionário some tanto do Kanban quanto da Equipe — nenhum dos dois mostra status != admissao/experiencia sem isso)
  if (status !== 'admissao') updates.admission_stage = 'finalizado'

  const { error } = await admin
    .from('employees')
    .update(updates)
    .eq('id', employeeId)

  if (error) return { error: error.message }
  revalidatePath('/pessoas/admissao')
  revalidatePath('/pessoas/funcionarios')
  return { success: true }
}
