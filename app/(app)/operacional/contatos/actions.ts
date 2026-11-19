'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { semAcesso } from '@/lib/auth/acesso'

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

function parseContactFields(formData: FormData) {
  return {
    nome: formData.get('nome') as string,
    tipo: (formData.get('tipo') as string) || 'PF',
    papel: (formData.get('papel') as string) || 'ambos',
    cpf_cnpj: (formData.get('cpf_cnpj') as string)?.replace(/\D/g, '') || null,
    email: (formData.get('email') as string) || null,
    telefone: (formData.get('telefone') as string) || null,
    observacao: (formData.get('observacao') as string) || null,
  }
}

async function uploadFoto(admin: ReturnType<typeof createAdminClient>, companyId: string, contactId: string, fotoFile: File) {
  const ext = fotoFile.name.split('.').pop() || 'jpg'
  const path = `${companyId}/${contactId}.${ext}`
  const bytes = await fotoFile.arrayBuffer()
  const { error: uploadErr } = await admin.storage
    .from('contatos')
    .upload(path, bytes, { contentType: fotoFile.type, upsert: true })
  if (uploadErr) return
  const { data: urlData } = admin.storage.from('contatos').getPublicUrl(path)
  await admin.from('contacts').update({ foto_url: urlData.publicUrl }).eq('id', contactId)
}

export async function createContactAction(companyId: string, formData: FormData) {
  const negado = await semAcesso('operacional.contatos', companyId)
  if (negado) return negado

  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const fields = parseContactFields(formData)
  if (!fields.nome) return { error: 'Nome é obrigatório.' }

  const admin = createAdminClient()
  const { data: inserted, error } = await admin
    .from('contacts')
    .insert({ company_id: companyId, ...fields })
    .select('id')
    .single()

  if (error) return { error: error.message }

  const fotoFile = formData.get('foto_file') as File
  if (fotoFile && fotoFile.size > 0) await uploadFoto(admin, companyId, inserted.id, fotoFile)

  revalidatePath('/operacional/contatos')
  return { success: true }
}

export async function updateContactAction(contactId: string, formData: FormData) {
  const negado = await semAcesso('operacional.contatos')
  if (negado) return negado

  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const fields = parseContactFields(formData)
  if (!fields.nome) return { error: 'Nome é obrigatório.' }

  const admin = createAdminClient()
  const { data: existing, error: existingErr } = await admin.from('contacts').select('company_id').eq('id', contactId).single()
  if (existingErr || !existing) return { error: 'Contato não encontrado.' }

  const { error } = await admin.from('contacts').update(fields).eq('id', contactId)
  if (error) return { error: error.message }

  const fotoFile = formData.get('foto_file') as File
  if (fotoFile && fotoFile.size > 0) await uploadFoto(admin, existing.company_id, contactId, fotoFile)

  revalidatePath('/operacional/contatos')
  return { success: true }
}

export async function deleteContactAction(contactId: string) {
  const negado = await semAcesso('operacional.contatos')
  if (negado) return negado

  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const { error } = await admin.from('contacts').delete().eq('id', contactId)

  if (error) return { error: error.message }
  revalidatePath('/operacional/contatos')
  return { success: true }
}
