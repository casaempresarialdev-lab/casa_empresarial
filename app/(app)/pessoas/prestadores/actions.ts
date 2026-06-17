'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { normalizeDocs, type ProviderDoc } from './queries'

const BUCKET = 'documentos'
const MAX_SIZE = 20 * 1024 * 1024 // 20 MB por arquivo

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

function parseProviderFields(formData: FormData) {
  const valorRaw = formData.get('valor') as string
  const valor = valorRaw ? parseFloat(valorRaw.replace(',', '.')) : null
  return {
    nome: formData.get('nome') as string,
    tipo: 'PJ' as const,
    cpf_cnpj: (formData.get('cpf_cnpj') as string)?.replace(/\D/g, '') || null,
    email: (formData.get('email') as string) || null,
    telefone: (formData.get('telefone') as string) || null,
    servico: (formData.get('servico') as string) || null,
    valor,
    data_inicio: (formData.get('data_inicio') as string) || null,
  }
}

type Admin = ReturnType<typeof createAdminClient>

async function uploadProviderFile(
  admin: Admin,
  companyId: string,
  providerId: string,
  slot: number,
  file: File,
  label: string | null,
): Promise<{ doc?: ProviderDoc; error?: string }> {
  if (file.size > MAX_SIZE) return { error: `"${file.name}" excede 20 MB.` }
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `prestadores/${companyId}/${providerId}/${slot}_${Date.now()}_${safeName}`
  const bytes = await file.arrayBuffer()
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: file.type || 'application/octet-stream', upsert: false })
  if (error) return { error: `Erro no upload de "${file.name}": ${error.message}` }
  return { doc: { nome: file.name, storage_path: path, tipo: file.type || null, size: file.size, label: label || null } }
}

// Resolve os 3 slots de documentos combinando: arquivo novo, manter existente ou remover.
async function resolveDocuments(
  admin: Admin,
  companyId: string,
  providerId: string,
  formData: FormData,
  existing: (ProviderDoc | null)[],
): Promise<{ docs: (ProviderDoc | null)[]; error?: string }> {
  const docs: (ProviderDoc | null)[] = [null, null, null]
  const toRemove: string[] = []

  for (let i = 0; i < 3; i++) {
    const file = formData.get(`file_${i}`) as File | null
    const remove = formData.get(`remove_${i}`) === 'true'
    const label = (formData.get(`label_${i}`) as string) || null
    const prev = existing[i] ?? null

    if (file && file.size > 0) {
      const { doc, error } = await uploadProviderFile(admin, companyId, providerId, i, file, label)
      if (error) return { docs, error }
      docs[i] = doc!
      if (prev) toRemove.push(prev.storage_path)
    } else if (remove) {
      if (prev) toRemove.push(prev.storage_path)
      docs[i] = null
    } else if (prev) {
      docs[i] = label !== null ? { ...prev, label } : prev
    }
  }

  if (toRemove.length > 0) {
    await admin.storage.from(BUCKET).remove(toRemove)
  }
  return { docs }
}

export async function createProviderAction(companyId: string, formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const fields = parseProviderFields(formData)
  if (!fields.nome) return { error: 'Nome é obrigatório.' }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('service_providers')
    .insert({ company_id: companyId, ...fields })
    .select('id')
    .single()

  if (error) return { error: error.message }

  const { docs, error: docErr } = await resolveDocuments(admin, companyId, data.id, formData, [null, null, null])
  if (docErr) return { error: docErr }

  if (docs.some(Boolean)) {
    await admin.from('service_providers').update({ documentos: docs }).eq('id', data.id)
  }

  revalidatePath('/pessoas/prestadores')
  return { success: true }
}

export async function updateProviderAction(providerId: string, formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const fields = parseProviderFields(formData)
  if (!fields.nome) return { error: 'Nome é obrigatório.' }

  const admin = createAdminClient()

  const { data: current } = await admin
    .from('service_providers')
    .select('company_id, documentos')
    .eq('id', providerId)
    .single()
  if (!current) return { error: 'Prestador não encontrado.' }

  const existing = normalizeDocs(current.documentos)
  const { docs, error: docErr } = await resolveDocuments(admin, current.company_id, providerId, formData, existing)
  if (docErr) return { error: docErr }

  const { error } = await admin
    .from('service_providers')
    .update({ ...fields, documentos: docs })
    .eq('id', providerId)

  if (error) return { error: error.message }
  revalidatePath('/pessoas/prestadores')
  return { success: true }
}

export async function deleteProviderAction(providerId: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()

  const { data: current } = await admin
    .from('service_providers')
    .select('documentos')
    .eq('id', providerId)
    .single()

  const paths = normalizeDocs(current?.documentos).filter(Boolean).map(d => d!.storage_path)
  if (paths.length > 0) await admin.storage.from(BUCKET).remove(paths)

  const { error } = await admin.from('service_providers').delete().eq('id', providerId)
  if (error) return { error: error.message }

  revalidatePath('/pessoas/prestadores')
  return { success: true }
}

export async function getProviderDocUrlAction(
  providerId: string,
  storagePath: string,
): Promise<{ url?: string; error?: string }> {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()

  // Confere que o documento pertence mesmo a este prestador antes de assinar a URL.
  const { data: provider } = await admin
    .from('service_providers')
    .select('documentos')
    .eq('id', providerId)
    .single()
  if (!provider) return { error: 'Prestador não encontrado.' }

  const owns = normalizeDocs(provider.documentos).some(d => d?.storage_path === storagePath)
  if (!owns) return { error: 'Documento não encontrado.' }

  const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(storagePath, 3600)
  if (error) return { error: error.message }
  return { url: data.signedUrl }
}
