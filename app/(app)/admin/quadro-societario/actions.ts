'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'

type Admin = ReturnType<typeof createAdminClient>

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// Foto e documentos dos sócios ficam no bucket privado 'documentos' (como os dos funcionários)
const BUCKET = 'documentos'
const MAX_FOTO_BYTES = 5 * 1024 * 1024
const MAX_DOC_BYTES = 50 * 1024 * 1024

function socioFolder(companyId: string, socioId: string) {
  return `socios/${companyId}/${socioId}`
}

// Envia a foto (se veio) ou remove (remove_foto=true). Devolve mensagem de erro ou null.
async function saveFoto(admin: Admin, companyId: string, socioId: string, formData: FormData) {
  const file = formData.get('foto_file') as File | null
  const remove = formData.get('remove_foto') === 'true'
  if (!file?.size && !remove) return null

  const { data: atual } = await admin.from('socios').select('*').eq('id', socioId).single()
  const anterior = (atual as { foto_path?: string | null } | null)?.foto_path ?? null

  if (file && file.size > 0) {
    if (!file.type.startsWith('image/')) return 'A foto precisa ser uma imagem.'
    if (file.size > MAX_FOTO_BYTES) return 'A foto passa de 5 MB.'
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${socioFolder(companyId, socioId)}/foto-${Date.now()}.${ext}`
    const { error: upErr } = await admin.storage.from(BUCKET).upload(path, await file.arrayBuffer(), { contentType: file.type })
    if (upErr) return `Erro ao enviar a foto: ${upErr.message}`
    const { error } = await admin.from('socios').update({ foto_path: path }).eq('id', socioId)
    if (error) return error.message
  } else {
    const { error } = await admin.from('socios').update({ foto_path: null }).eq('id', socioId)
    if (error) return error.message
  }
  if (anterior) await admin.storage.from(BUCKET).remove([anterior])
  return null
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

// A soma das participações da empresa não pode passar de 100% (excludeId: o sócio sendo editado)
async function participacaoExcedida(admin: Admin, companyId: string, participacao: number | null, excludeId?: string) {
  if (participacao === null) return null
  let query = admin.from('socios').select('participacao').eq('company_id', companyId)
  if (excludeId) query = query.neq('id', excludeId)
  const { data, error } = await query
  if (error) return error.message
  const outros = (data ?? []).reduce((sum, s) => sum + Number(s.participacao ?? 0), 0)
  if (outros + participacao > 100 + 1e-9) {
    const disponivel = Math.max(0, 100 - outros)
    return `A participação total passaria de 100%. Disponível para este sócio: ${disponivel.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%.`
  }
  return null
}

export async function createSocioAction(companyId: string, formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const fields = parseSocioFields(formData)

  if (fields.participacao !== null && (fields.participacao < 0 || fields.participacao > 100)) {
    return { error: 'Participação deve ser entre 0 e 100%.' }
  }

  const admin = createAdminClient()
  const excedida = await participacaoExcedida(admin, companyId, fields.participacao)
  if (excedida) return { error: excedida }

  const { data: criado, error } = await admin.from('socios').insert({ company_id: companyId, ...fields }).select('id').single()

  if (error) return { error: error.message }
  const fotoErro = await saveFoto(admin, companyId, criado.id, formData)
  revalidatePath('/admin/quadro-societario')
  // O sócio foi criado mesmo se a foto falhar: avisa sem perder o cadastro
  if (fotoErro) return { error: `Sócio cadastrado, mas a foto não foi salva: ${fotoErro}` }
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
  const { data: atual, error: atualError } = await admin.from('socios').select('company_id').eq('id', socioId).single()
  if (atualError) return { error: atualError.message }
  const excedida = await participacaoExcedida(admin, atual.company_id, fields.participacao, socioId)
  if (excedida) return { error: excedida }

  const { error } = await admin.from('socios').update(fields).eq('id', socioId)

  if (error) return { error: error.message }
  const fotoErro = await saveFoto(admin, atual.company_id, socioId, formData)
  revalidatePath('/admin/quadro-societario')
  if (fotoErro) return { error: `Dados salvos, mas a foto não foi salva: ${fotoErro}` }
  return { success: true }
}

export async function deleteSocioAction(socioId: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const { data: socio } = await admin.from('socios').select('*').eq('id', socioId).single()
  const { data: docs } = await admin.from('socio_documents').select('storage_path').eq('socio_id', socioId)

  const { error } = await admin.from('socios').delete().eq('id', socioId)
  if (error) return { error: error.message }

  // Arquivos: melhor esforço (o cadastro já foi removido)
  const paths = [
    (socio as { foto_path?: string | null } | null)?.foto_path,
    ...(docs ?? []).map((d) => d.storage_path),
  ].filter((p): p is string => !!p)
  if (paths.length) await admin.storage.from(BUCKET).remove(paths)

  revalidatePath('/admin/quadro-societario')
  return { success: true }
}

// ── Documentos do sócio ─────────────────────────────────────────────

export type SocioDocument = {
  id: string
  socio_id: string
  descricao: string | null
  nome: string
  tipo: string | null
  tamanho: number | null
  created_at: string
}

// Confere que o sócio pertence à empresa antes de mexer na foto ou nos documentos
async function socioDaEmpresa(admin: Admin, socioId: string, companyId: string) {
  const { data } = await admin.from('socios').select('id').eq('id', socioId).eq('company_id', companyId).maybeSingle()
  return !!data
}

// Foto do sócio (modal próprio): envia foto_file ou remove com remove_foto=true
export async function updateSocioFotoAction(socioId: string, companyId: string, formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  if (!(await socioDaEmpresa(admin, socioId, companyId))) return { error: 'Sócio não encontrado.' }

  const erro = await saveFoto(admin, companyId, socioId, formData)
  if (erro) return { error: erro }
  revalidatePath('/admin/quadro-societario')
  return { success: true }
}

export async function listSocioDocumentsAction(socioId: string, companyId: string): Promise<{ documents?: SocioDocument[]; error?: string }> {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('socio_documents')
    .select('id, socio_id, descricao, nome, tipo, tamanho, created_at')
    .eq('socio_id', socioId)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
  if (error) return { error: error.message }
  return { documents: (data ?? []) as SocioDocument[] }
}

export async function uploadSocioDocumentAction(socioId: string, companyId: string, formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return { error: 'Nenhum arquivo selecionado.' }
  if (file.size > MAX_DOC_BYTES) return { error: 'Arquivo muito grande. Máximo: 50 MB.' }

  const admin = createAdminClient()
  if (!(await socioDaEmpresa(admin, socioId, companyId))) return { error: 'Sócio não encontrado.' }

  const safeName = file.name.replace(/[^\w.-]+/g, '_')
  const path = `${socioFolder(companyId, socioId)}/docs/${Date.now()}-${safeName}`
  const { error: upErr } = await admin.storage.from(BUCKET).upload(path, await file.arrayBuffer(), { contentType: file.type || undefined })
  if (upErr) return { error: `Erro no upload: ${upErr.message}` }

  const descricao = ((formData.get('descricao') as string) || '').trim() || null
  const { error } = await admin.from('socio_documents').insert({
    socio_id: socioId, company_id: companyId, descricao, nome: file.name,
    storage_path: path, tipo: file.type || null, tamanho: file.size,
  })
  if (error) {
    await admin.storage.from(BUCKET).remove([path])
    return { error: `Erro ao salvar documento: ${error.message}` }
  }
  return { success: true }
}

export async function deleteSocioDocumentAction(documentId: string, companyId: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }
  const admin = createAdminClient()
  const { data: doc } = await admin.from('socio_documents').select('storage_path').eq('id', documentId).eq('company_id', companyId).maybeSingle()
  if (!doc) return { error: 'Documento não encontrado.' }
  const { error } = await admin.from('socio_documents').delete().eq('id', documentId)
  if (error) return { error: error.message }
  await admin.storage.from(BUCKET).remove([doc.storage_path])
  return { success: true }
}

/** Link temporário (1h); download = true força baixar com o nome original */
export async function getSocioDocumentUrlAction(documentId: string, companyId: string, download = false): Promise<{ url?: string; error?: string }> {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }
  const admin = createAdminClient()
  const { data: doc } = await admin.from('socio_documents').select('storage_path, nome').eq('id', documentId).eq('company_id', companyId).maybeSingle()
  if (!doc) return { error: 'Documento não encontrado.' }
  const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(doc.storage_path, 3600, download ? { download: doc.nome } : undefined)
  if (error) return { error: error.message }
  return { url: data.signedUrl }
}
