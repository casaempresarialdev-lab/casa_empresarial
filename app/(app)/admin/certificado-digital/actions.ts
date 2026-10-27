'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { encrypt, decrypt } from '@/lib/crypto'

type Admin = ReturnType<typeof createAdminClient>

// Certificados (.pfx / .p12) no bucket privado 'certificados'; a senha fica criptografada
const BUCKET = 'certificados'
const MAX_CERT_BYTES = 5 * 1024 * 1024
const PATH = '/admin/certificado-digital'

// Usuário logado e membro ativo da empresa
async function authorize(companyId: string): Promise<{ admin: Admin } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sessão inválida. Faça login novamente.' }

  const admin = createAdminClient()
  const { data: member } = await admin
    .from('company_members')
    .select('id')
    .eq('profile_id', user.id)
    .eq('company_id', companyId)
    .eq('status', 'active')
    .maybeSingle()
  if (!member) return { error: 'Acesso não autorizado.' }
  return { admin }
}

// Valida e envia o arquivo; devolve o caminho no storage ou a mensagem de erro
async function uploadCertFile(admin: Admin, companyId: string, file: File): Promise<{ path: string } | { error: string }> {
  const ext = (file.name.split('.').pop() || '').toLowerCase()
  if (ext !== 'pfx' && ext !== 'p12') return { error: 'O certificado precisa ser um arquivo .pfx ou .p12.' }
  if (file.size > MAX_CERT_BYTES) return { error: 'Arquivo muito grande. Máximo: 5 MB.' }

  const safeName = file.name.replace(/[^\w.-]+/g, '_')
  const path = `${companyId}/${Date.now()}-${safeName}`
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(path, await file.arrayBuffer(), { contentType: file.type || 'application/octet-stream' })
  if (error) return { error: `Erro ao enviar o certificado: ${error.message}` }
  return { path }
}

export async function createCertificateAction(companyId: string, formData: FormData) {
  const auth = await authorize(companyId)
  if ('error' in auth) return auth
  const { admin } = auth

  const identificacao = ((formData.get('identificacao') as string) || '').trim()
  const file = formData.get('certificado_file') as File | null
  const senha = ((formData.get('senha') as string) || '').trim()
  if (!identificacao) return { error: 'Informe a identificação do certificado.' }
  if (!file?.size) return { error: 'Envie o arquivo do certificado.' }

  const up = await uploadCertFile(admin, companyId, file)
  if ('error' in up) return up

  const { error } = await admin.from('company_certificates').insert({
    company_id: companyId,
    identificacao,
    nome_arquivo: file.name,
    storage_path: up.path,
    senha_enc: senha ? encrypt(senha) : null,
  })
  if (error) {
    await admin.storage.from(BUCKET).remove([up.path])
    return { error: `Erro ao salvar o certificado: ${error.message}` }
  }
  revalidatePath(PATH)
  return { success: true }
}

// Edição: identificação; arquivo e senha só mudam se vierem preenchidos
export async function updateCertificateAction(certificateId: string, companyId: string, formData: FormData) {
  const auth = await authorize(companyId)
  if ('error' in auth) return auth
  const { admin } = auth

  const { data: atual } = await admin
    .from('company_certificates')
    .select('storage_path')
    .eq('id', certificateId)
    .eq('company_id', companyId)
    .maybeSingle()
  if (!atual) return { error: 'Certificado não encontrado.' }

  const identificacao = ((formData.get('identificacao') as string) || '').trim()
  const file = formData.get('certificado_file') as File | null
  const senha = ((formData.get('senha') as string) || '').trim()
  if (!identificacao) return { error: 'Informe a identificação do certificado.' }

  const changes: Record<string, string> = { identificacao, updated_at: new Date().toISOString() }
  if (senha) changes.senha_enc = encrypt(senha)

  let novoPath: string | null = null
  if (file?.size) {
    const up = await uploadCertFile(admin, companyId, file)
    if ('error' in up) return up
    novoPath = up.path
    changes.storage_path = up.path
    changes.nome_arquivo = file.name
  }

  const { error } = await admin.from('company_certificates').update(changes).eq('id', certificateId).eq('company_id', companyId)
  if (error) {
    if (novoPath) await admin.storage.from(BUCKET).remove([novoPath])
    return { error: `Erro ao salvar o certificado: ${error.message}` }
  }
  // Arquivo trocado: apaga o anterior
  if (novoPath) await admin.storage.from(BUCKET).remove([atual.storage_path])

  revalidatePath(PATH)
  return { success: true }
}

export async function deleteCertificateAction(certificateId: string, companyId: string) {
  const auth = await authorize(companyId)
  if ('error' in auth) return auth
  const { admin } = auth

  const { data: atual } = await admin
    .from('company_certificates')
    .select('storage_path')
    .eq('id', certificateId)
    .eq('company_id', companyId)
    .maybeSingle()
  if (!atual) return { error: 'Certificado não encontrado.' }

  const { error } = await admin.from('company_certificates').delete().eq('id', certificateId).eq('company_id', companyId)
  if (error) return { error: error.message }

  await admin.storage.from(BUCKET).remove([atual.storage_path])
  // Certificado antigo (de antes da lista) também era referenciado em companies
  await admin.from('companies').update({ certificado_digital_url: null, certificado_digital_senha_enc: null })
    .eq('id', companyId).eq('certificado_digital_url', atual.storage_path)

  revalidatePath(PATH)
  return { success: true }
}

export async function revealCertificatePasswordAction(certificateId: string, companyId: string): Promise<{ password?: string; error?: string }> {
  const auth = await authorize(companyId)
  if ('error' in auth) return auth
  const { data } = await auth.admin
    .from('company_certificates')
    .select('senha_enc')
    .eq('id', certificateId)
    .eq('company_id', companyId)
    .maybeSingle()
  if (!data) return { error: 'Certificado não encontrado.' }
  if (!data.senha_enc) return { error: 'Nenhuma senha cadastrada para este certificado.' }
  try {
    return { password: decrypt(data.senha_enc) }
  } catch {
    return { error: 'Erro ao descriptografar a senha.' }
  }
}

// Link temporário para baixar o arquivo com o nome original
export async function getCertificateDownloadUrlAction(certificateId: string, companyId: string): Promise<{ url?: string; error?: string }> {
  const auth = await authorize(companyId)
  if ('error' in auth) return auth
  const { data } = await auth.admin
    .from('company_certificates')
    .select('storage_path, nome_arquivo')
    .eq('id', certificateId)
    .eq('company_id', companyId)
    .maybeSingle()
  if (!data) return { error: 'Certificado não encontrado.' }

  const { data: signed, error } = await auth.admin.storage
    .from(BUCKET)
    .createSignedUrl(data.storage_path, 60, { download: data.nome_arquivo })
  if (error || !signed) return { error: 'Não foi possível gerar o link de download.' }
  return { url: signed.signedUrl }
}
