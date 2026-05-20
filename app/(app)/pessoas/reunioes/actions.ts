'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

function parseMeetingFields(formData: FormData) {
  const duracaoRaw = formData.get('duracao_min') as string
  const participantesRaw = formData.get('participantes') as string

  return {
    titulo: formData.get('titulo') as string,
    data: (formData.get('data') as string) || null,
    duracao_min: duracaoRaw ? parseInt(duracaoRaw) : null,
    local: (formData.get('local') as string) || null,
    status: (formData.get('status') as string) || 'agendada',
    pauta: (formData.get('pauta') as string) || null,
    ata: (formData.get('ata') as string) || null,
    participantes: participantesRaw ? JSON.parse(participantesRaw) : [],
  }
}

export async function createMeetingAction(companyId: string, formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const fields = parseMeetingFields(formData)
  if (!fields.titulo) return { error: 'Título é obrigatório.' }

  const admin = createAdminClient()
  const { error } = await admin.from('meetings').insert({
    company_id: companyId,
    modulo: 'pessoas',
    ...fields,
  })

  if (error) return { error: error.message }
  revalidatePath('/pessoas/reunioes')
  return { success: true }
}

export async function updateMeetingAction(meetingId: string, formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const fields = parseMeetingFields(formData)
  if (!fields.titulo) return { error: 'Título é obrigatório.' }

  const admin = createAdminClient()
  const { error } = await admin.from('meetings').update(fields).eq('id', meetingId)

  if (error) return { error: error.message }
  revalidatePath('/pessoas/reunioes')
  return { success: true }
}

export async function deleteMeetingAction(meetingId: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const { error } = await admin.from('meetings').delete().eq('id', meetingId)

  if (error) return { error: error.message }
  revalidatePath('/pessoas/reunioes')
  return { success: true }
}
