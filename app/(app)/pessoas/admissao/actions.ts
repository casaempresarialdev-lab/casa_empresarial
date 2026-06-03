'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function updateEmployeeStatusAction(
  employeeId: string,
  status: 'admissao' | 'experiencia' | 'ativo' | 'inativo' | 'demitido',
) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('employees')
    .update({ status })
    .eq('id', employeeId)

  if (error) return { error: error.message }
  revalidatePath('/pessoas/admissao')
  revalidatePath('/pessoas/funcionarios')
  return { success: true }
}
