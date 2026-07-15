'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function uploadDocumentAction(
  companyId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const file = formData.get('file') as File
  if (!file || file.size === 0) return { error: 'Nenhum arquivo selecionado.' }
  if (file.size > 50 * 1024 * 1024) return { error: 'Arquivo muito grande. Máximo: 50 MB.' }

  const admin = createAdminClient()
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${companyId}/${Date.now()}_${safeName}`
  const bytes = await file.arrayBuffer()

  const { error: uploadErr } = await admin.storage
    .from('documentos')
    .upload(path, bytes, { contentType: file.type || 'application/octet-stream', upsert: false })

  if (uploadErr) return { error: `Erro no upload: ${uploadErr.message}` }

  const descricao = formData.get('descricao') as string | null
  const vencimento = formData.get('vencimento') as string | null
  const observacao = formData.get('observacao') as string | null

  const { error: dbErr } = await admin.from('documents').insert({
    company_id: companyId,
    nome: file.name,
    storage_path: path,
    tamanho: file.size,
    tipo: file.type || null,
    descricao: descricao || null,
    vencimento: vencimento || null,
    observacao: observacao || null,
  })

  if (dbErr) {
    await admin.storage.from('documentos').remove([path])
    return { error: `Erro ao salvar documento: ${dbErr.message}` }
  }

  revalidatePath('/admin/documentacao')
  return {}
}

export async function updateDocumentAction(
  id: string,
  companyId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const descricao = formData.get('descricao') as string | null
  const vencimento = formData.get('vencimento') as string | null
  const observacao = formData.get('observacao') as string | null

  const { error } = await admin
    .from('documents')
    .update({
      descricao: descricao || null,
      vencimento: vencimento || null,
      observacao: observacao || null,
    })
    .eq('id', id)
    .eq('company_id', companyId)

  if (error) return { error: error.message }
  revalidatePath('/admin/documentacao')
  return {}
}

export async function deleteDocumentAction(
  id: string,
  companyId: string,
): Promise<{ error?: string }> {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()

  const { data: doc } = await admin
    .from('documents')
    .select('storage_path')
    .eq('id', id)
    .eq('company_id', companyId)
    .single()

  if (!doc) return { error: 'Documento não encontrado.' }

  const { error: dbErr } = await admin
    .from('documents')
    .delete()
    .eq('id', id)
    .eq('company_id', companyId)

  if (dbErr) return { error: dbErr.message }

  await admin.storage.from('documentos').remove([doc.storage_path])

  revalidatePath('/admin/documentacao')
  return {}
}

export async function getSignedUrlAction(
  id: string,
  companyId: string,
): Promise<{ url?: string; error?: string }> {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()

  const { data: doc } = await admin
    .from('documents')
    .select('storage_path')
    .eq('id', id)
    .eq('company_id', companyId)
    .single()

  if (!doc) return { error: 'Documento não encontrado.' }

  const { data, error } = await admin.storage
    .from('documentos')
    .createSignedUrl(doc.storage_path, 3600)

  if (error) return { error: error.message }
  return { url: data.signedUrl }
}
