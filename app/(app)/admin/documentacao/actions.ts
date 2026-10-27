'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

type Admin = ReturnType<typeof createAdminClient>

// Pasta do documento: só entra no insert/update quando o formulário manda 'folder_id'
// (vazio = sem pasta). Aceita pasta padrão ou pasta da própria empresa.
async function folderField(admin: Admin, companyId: string, formData: FormData): Promise<{ value: { folder_id?: string | null } } | { error: string }> {
  if (!formData.has('folder_id')) return { value: {} }
  const folderId = (formData.get('folder_id') as string) || null
  if (!folderId) return { value: { folder_id: null } }
  const { data } = await admin
    .from('document_folders')
    .select('id, company_id, sistema')
    .eq('id', folderId)
    .maybeSingle()
  if (!data || (!data.sistema && data.company_id !== companyId)) return { error: 'Pasta não encontrada.' }
  return { value: { folder_id: folderId } }
}

// Membro ativo da empresa (pastas são alteradas pelo admin client)
async function isActiveMember(admin: Admin, userId: string, companyId: string) {
  const { data } = await admin
    .from('company_members')
    .select('id')
    .eq('profile_id', userId)
    .eq('company_id', companyId)
    .eq('status', 'active')
    .maybeSingle()
  return !!data
}

// Pasta acessível pela empresa (padrão ou da própria empresa)
async function folderDaEmpresa(admin: Admin, companyId: string, folderId: string) {
  const { data } = await admin
    .from('document_folders')
    .select('id, company_id, sistema')
    .eq('id', folderId)
    .maybeSingle()
  return !!data && (data.sistema || data.company_id === companyId)
}

// parentId null = raiz; dentro de uma pasta (inclusive padrão) também pode criar
export async function createFolderAction(companyId: string, nome: string, parentId: string | null = null): Promise<{ error?: string }> {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }
  const admin = createAdminClient()
  if (!(await isActiveMember(admin, user.id, companyId))) return { error: 'Acesso não autorizado.' }

  const nomeLimpo = nome.trim()
  if (!nomeLimpo) return { error: 'Informe o nome da pasta.' }
  if (parentId && !(await folderDaEmpresa(admin, companyId, parentId))) return { error: 'Pasta não encontrada.' }

  const { error } = await admin.from('document_folders').insert({
    company_id: companyId, nome: nomeLimpo, sistema: false,
    ...(parentId && { parent_id: parentId }),
  })
  if (error) return { error: `Erro ao criar a pasta: ${error.message}` }
  revalidatePath('/admin/documentacao')
  return {}
}

// Move a pasta (parentId null = raiz). Pastas padrão não se movem, e uma pasta não pode ir para dentro dela mesma
export async function moveFolderAction(folderId: string, companyId: string, parentId: string | null): Promise<{ error?: string }> {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }
  const admin = createAdminClient()
  if (!(await isActiveMember(admin, user.id, companyId))) return { error: 'Acesso não autorizado.' }

  const { data: pasta } = await admin
    .from('document_folders')
    .select('id, company_id, sistema')
    .eq('id', folderId)
    .maybeSingle()
  if (!pasta || (!pasta.sistema && pasta.company_id !== companyId)) return { error: 'Pasta não encontrada.' }
  if (pasta.sistema) return { error: 'Pastas padrão não podem ser movidas.' }

  if (parentId) {
    if (!(await folderDaEmpresa(admin, companyId, parentId))) return { error: 'Pasta de destino não encontrada.' }
    // Sobe a partir do destino: se passar pela própria pasta, seria um ciclo
    let cur: string | null = parentId
    const vistos = new Set<string>()
    while (cur && !vistos.has(cur)) {
      if (cur === folderId) return { error: 'Não é possível mover uma pasta para dentro dela mesma.' }
      vistos.add(cur)
      const { data: p }: { data: { parent_id: string | null } | null } = await admin
        .from('document_folders').select('parent_id').eq('id', cur).maybeSingle()
      cur = p?.parent_id ?? null
    }
  }

  const { error } = await admin
    .from('document_folders')
    .update({ parent_id: parentId })
    .eq('id', folderId)
    .eq('company_id', companyId)
    .eq('sistema', false)
  if (error) return { error: error.message }
  revalidatePath('/admin/documentacao')
  return {}
}

// Renomear/excluir só vale para pastas da empresa — as padrão (sistema) ficam bloqueadas
export async function renameFolderAction(folderId: string, companyId: string, nome: string): Promise<{ error?: string }> {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }
  const admin = createAdminClient()
  if (!(await isActiveMember(admin, user.id, companyId))) return { error: 'Acesso não autorizado.' }

  const nomeLimpo = nome.trim()
  if (!nomeLimpo) return { error: 'Informe o nome da pasta.' }

  const { data, error } = await admin
    .from('document_folders')
    .update({ nome: nomeLimpo })
    .eq('id', folderId)
    .eq('company_id', companyId)
    .eq('sistema', false)
    .select('id')
  if (error) return { error: error.message }
  if (!data?.length) return { error: 'Pastas padrão não podem ser editadas.' }
  revalidatePath('/admin/documentacao')
  return {}
}

export async function deleteFolderAction(folderId: string, companyId: string): Promise<{ error?: string }> {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }
  const admin = createAdminClient()
  if (!(await isActiveMember(admin, user.id, companyId))) return { error: 'Acesso não autorizado.' }

  const { data: pasta } = await admin
    .from('document_folders')
    .select('*')
    .eq('id', folderId)
    .eq('company_id', companyId)
    .eq('sistema', false)
    .maybeSingle()
  if (!pasta) return { error: 'Pastas padrão não podem ser excluídas.' }

  // O conteúdo (documentos e subpastas) sobe para a pasta de cima (ou para a raiz)
  const destino = (pasta as { parent_id?: string | null }).parent_id ?? null
  const { error: docsErr } = await admin.from('documents').update({ folder_id: destino }).eq('folder_id', folderId).eq('company_id', companyId)
  if (docsErr) return { error: docsErr.message }
  if ('parent_id' in pasta) {
    const { error: subErr } = await admin.from('document_folders').update({ parent_id: destino }).eq('parent_id', folderId)
    if (subErr) return { error: subErr.message }
  }

  const { data, error } = await admin
    .from('document_folders')
    .delete()
    .eq('id', folderId)
    .eq('company_id', companyId)
    .eq('sistema', false)
    .select('id')
  if (error) return { error: error.message }
  if (!data?.length) return { error: 'Pastas padrão não podem ser excluídas.' }
  revalidatePath('/admin/documentacao')
  return {}
}

// Move o documento para uma pasta (folderId null = raiz)
export async function moveDocumentAction(documentId: string, companyId: string, folderId: string | null): Promise<{ error?: string }> {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }
  const admin = createAdminClient()
  if (!(await isActiveMember(admin, user.id, companyId))) return { error: 'Acesso não autorizado.' }

  const fd = new FormData()
  fd.set('folder_id', folderId ?? '')
  const folder = await folderField(admin, companyId, fd)
  if ('error' in folder) return folder

  const { data, error } = await admin
    .from('documents')
    .update(folder.value)
    .eq('id', documentId)
    .eq('company_id', companyId)
    .select('id')
  if (error) return { error: error.message }
  if (!data?.length) return { error: 'Documento não encontrado.' }
  revalidatePath('/admin/documentacao')
  return {}
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
  const folder = await folderField(admin, companyId, formData)
  if ('error' in folder) {
    await admin.storage.from('documentos').remove([path])
    return folder
  }

  const { error: dbErr } = await admin.from('documents').insert({
    company_id: companyId,
    nome: file.name,
    storage_path: path,
    tamanho: file.size,
    tipo: file.type || null,
    descricao: descricao || null,
    vencimento: vencimento || null,
    observacao: observacao || null,
    ...folder.value,
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
  const folder = await folderField(admin, companyId, formData)
  if ('error' in folder) return folder

  const { error } = await admin
    .from('documents')
    .update({
      descricao: descricao || null,
      vencimento: vencimento || null,
      observacao: observacao || null,
      ...folder.value,
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

/**
 * Link temporário (1h) para o arquivo.
 * download = true: o link força o download com o nome original do arquivo.
 */
export async function getSignedUrlAction(
  id: string,
  companyId: string,
  download = false,
): Promise<{ url?: string; error?: string }> {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()

  const { data: doc } = await admin
    .from('documents')
    .select('storage_path, nome')
    .eq('id', id)
    .eq('company_id', companyId)
    .single()

  if (!doc) return { error: 'Documento não encontrado.' }

  const { data, error } = await admin.storage
    .from('documentos')
    .createSignedUrl(doc.storage_path, 3600, download ? { download: doc.nome } : undefined)

  if (error) return { error: error.message }
  return { url: data.signedUrl }
}
