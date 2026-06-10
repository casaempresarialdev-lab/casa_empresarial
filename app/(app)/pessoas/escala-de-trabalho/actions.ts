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

export async function deleteSchedulePeriodAction(
  companyId: string,
  employeeId: string,
  dataInicio: string,
  dataFim: string,
) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }
  if (!employeeId) return { error: 'Selecione um funcionário.' }
  if (!dataInicio || !dataFim) return { error: 'Informe o período completo.' }
  if (dataInicio > dataFim) return { error: 'Data inicial deve ser anterior à final.' }

  const admin = createAdminClient()
  const { error, count } = await admin
    .from('work_schedules')
    .delete({ count: 'exact' })
    .eq('company_id', companyId)
    .eq('employee_id', employeeId)
    .gte('data', dataInicio)
    .lte('data', dataFim)

  if (error) return { error: error.message }
  revalidatePath('/pessoas/escala-de-trabalho')
  return { success: true, count: count ?? 0 }
}

// Returns ISO week number (1-53) for a date string 'YYYY-MM-DD'
function isoWeek(dateStr: string): number {
  const d = new Date(Date.UTC(
    parseInt(dateStr.slice(0, 4)),
    parseInt(dateStr.slice(5, 7)) - 1,
    parseInt(dateStr.slice(8, 10)),
  ))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.valueOf() - yearStart.valueOf()) / 86400000) + 1) / 7)
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

  const datasExcluidasRaw = formData.get('datas_excluidas') as string
  const datasExcluidas = new Set<string>(datasExcluidasRaw ? JSON.parse(datasExcluidasRaw) : [])

  const [anoInicio, mesInicio] = mesAno.split('-').map(Number)
  const mesesReplicar = Math.max(1, Math.min(60, parseInt(formData.get('meses_replicar') as string) || 1))
  const pad = (n: number) => String(n).padStart(2, '0')

  // Detecta padrão de semanas alternadas a partir das exclusões do mês 0.
  // Mapeia quais semanas ISO do mês 0 ficaram totalmente excluídas (folga integral).
  const weekSlots = new Map<number, { total: number; excl: number }>()
  const totalDias0 = new Date(anoInicio, mesInicio, 0).getDate()
  for (let d = 1; d <= totalDias0; d++) {
    const date = new Date(anoInicio, mesInicio - 1, d)
    if (!diasSemana.includes(date.getDay())) continue
    const ds = `${anoInicio}-${pad(mesInicio)}-${pad(d)}`
    const w = isoWeek(ds)
    if (!weekSlots.has(w)) weekSlots.set(w, { total: 0, excl: 0 })
    const slot = weekSlots.get(w)!
    slot.total++
    if (datasExcluidas.has(ds)) slot.excl++
  }

  const allWeeks   = [...weekSlots.keys()].sort((a, b) => a - b)
  const firstWeek  = allWeeks[0] ?? 0
  const offWeeks   = allWeeks.filter(w => {
    const s = weekSlots.get(w)!
    return s.total > 0 && s.excl === s.total
  })

  // Verifica se todas as semanas de folga têm o mesmo offset relativo (padrão alternado)
  const offsets   = offWeeks.map(w => ((w - firstWeek) % 2 + 2) % 2)
  const isPattern = offsets.length > 0 && offsets.every(o => o === offsets[0])
  const offOffset = isPattern ? offsets[0] : -1

  const registros: { company_id: string; employee_id: string; data: string; turno: string | null; hora_inicio: string | null; hora_fim: string | null }[] = []

  for (let m = 0; m < mesesReplicar; m++) {
    let mes = mesInicio + m
    let ano = anoInicio
    while (mes > 12) { mes -= 12; ano++ }

    const totalDias = new Date(ano, mes, 0).getDate()
    for (let d = 1; d <= totalDias; d++) {
      const date   = new Date(ano, mes - 1, d)
      const dataStr = `${ano}-${pad(mes)}-${pad(d)}`

      let excluida: boolean
      if (m === 0) {
        // Mês base: usa as exclusões exatas marcadas pelo usuário
        excluida = datasExcluidas.has(dataStr)
      } else if (offOffset >= 0) {
        // Meses seguintes: replica o padrão de semanas alternadas detectado
        const relOffset = ((isoWeek(dataStr) - firstWeek) % 2 + 2) % 2
        excluida = relOffset === offOffset
      } else {
        // Sem padrão detectado: sem exclusões nos meses seguintes
        excluida = false
      }

      if (diasSemana.includes(date.getDay()) && !excluida) {
        registros.push({ company_id: companyId, employee_id: employeeId, data: dataStr, turno, hora_inicio: horaInicio, hora_fim: horaFim })
      }
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
