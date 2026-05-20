'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

function parseScheduleFields(formData: FormData) {
  return {
    employee_id: formData.get('employee_id') as string,
    data: formData.get('data') as string,
    turno: (formData.get('turno') as string) || null,
    hora_inicio: (formData.get('hora_inicio') as string) || null,
    hora_fim: (formData.get('hora_fim') as string) || null,
  }
}

export async function createScheduleAction(companyId: string, formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const fields = parseScheduleFields(formData)
  if (!fields.employee_id) return { error: 'Selecione um funcionário.' }
  if (!fields.data) return { error: 'Data é obrigatória.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('work_schedules')
    .upsert(
      { company_id: companyId, ...fields },
      { onConflict: 'employee_id,data' },
    )

  if (error) return { error: error.message }
  revalidatePath('/pessoas/escala-de-trabalho')
  return { success: true }
}

export async function updateScheduleAction(scheduleId: string, formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const { employee_id, ...fields } = parseScheduleFields(formData)

  const admin = createAdminClient()
  const { error } = await admin.from('work_schedules').update(fields).eq('id', scheduleId)

  if (error) return { error: error.message }
  revalidatePath('/pessoas/escala-de-trabalho')
  return { success: true }
}

export async function deleteScheduleAction(scheduleId: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const { error } = await admin.from('work_schedules').delete().eq('id', scheduleId)

  if (error) return { error: error.message }
  revalidatePath('/pessoas/escala-de-trabalho')
  return { success: true }
}
