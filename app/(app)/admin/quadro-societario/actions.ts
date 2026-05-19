'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

function parseSocioFields(formData: FormData) {
  const participacaoRaw = formData.get('participacao') as string
  const participacao = participacaoRaw ? parseFloat(participacaoRaw) : null
  return {
    nome: formData.get('nome') as string,
    cpf: (formData.get('cpf') as string)?.replace(/\D/g, '') || null,
    email: (formData.get('email') as string) || null,
    telefone: (formData.get('telefone') as string) || null,
    participacao,
    cargo: (formData.get('cargo') as string) || null,
    administrador: formData.get('administrador') === 'true',
    cep: (formData.get('cep') as string)?.replace(/\D/g, '') || null,
    uf: (formData.get('uf') as string) || null,
    cidade: (formData.get('cidade') as string) || null,
    logradouro: (formData.get('logradouro') as string) || null,
    bairro: (formData.get('bairro') as string) || null,
    numero: (formData.get('numero') as string) || null,
    complemento: (formData.get('complemento') as string) || null,
  }
}

export async function createSocioAction(companyId: string, formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const fields = parseSocioFields(formData)

  if (fields.participacao !== null && (fields.participacao < 0 || fields.participacao > 100)) {
    return { error: 'Participação deve ser entre 0 e 100%.' }
  }

  const admin = createAdminClient()
  const { error } = await admin.from('socios').insert({ company_id: companyId, ...fields })

  if (error) return { error: error.message }
  revalidatePath('/admin/quadro-societario')
  return { success: true }
}

export async function updateSocioAction(socioId: string, formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const fields = parseSocioFields(formData)

  if (fields.participacao !== null && (fields.participacao < 0 || fields.participacao > 100)) {
    return { error: 'Participação deve ser entre 0 e 100%.' }
  }

  const admin = createAdminClient()
  const { error } = await admin.from('socios').update(fields).eq('id', socioId)

  if (error) return { error: error.message }
  revalidatePath('/admin/quadro-societario')
  return { success: true }
}

export async function deleteSocioAction(socioId: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const { error } = await admin.from('socios').delete().eq('id', socioId)

  if (error) return { error: error.message }
  revalidatePath('/admin/quadro-societario')
  return { success: true }
}
