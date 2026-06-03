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

export async function createMonthlyScheduleAction(companyId: string, formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const employeeId = formData.get('employee_id') as string
  if (!employeeId) return { error: 'Selecione um funcionário.' }

  const mesAno = formData.get('mes_ano') as string  // 'YYYY-MM'
  if (!mesAno) return { error: 'Mês/ano é obrigatório.' }

  const diasSemanaRaw = formData.get('dias_semana') as string
  const diasSemana: number[] = diasSemanaRaw ? JSON.parse(diasSemanaRaw) : []
  if (diasSemana.length === 0) return { error: 'Selecione ao menos um dia da semana.' }

  const turno = (formData.get('turno') as string) || null
  const horaInicio = (formData.get('hora_inicio') as string) || null
  const horaFim = (formData.get('hora_fim') as string) || null

  const [ano, mes] = mesAno.split('-').map(Number)
  const totalDias = new Date(ano, mes, 0).getDate()

  const registros: { company_id: string; employee_id: string; data: string; turno: string | null; hora_inicio: string | null; hora_fim: string | null }[] = []
  for (let d = 1; d <= totalDias; d++) {
    const date = new Date(ano, mes - 1, d)
    if (diasSemana.includes(date.getDay())) {
      const dataStr = `${ano}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      registros.push({ company_id: companyId, employee_id: employeeId, data: dataStr, turno, hora_inicio: horaInicio, hora_fim: horaFim })
    }
  }

  if (registros.length === 0) return { error: 'Nenhuma data gerada para os dias selecionados.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('work_schedules')
    .upsert(registros, { onConflict: 'employee_id,data' })

  if (error) return { error: error.message }
  revalidatePath('/pessoas/escala-de-trabalho')
  return { success: true, count: registros.length }
}
