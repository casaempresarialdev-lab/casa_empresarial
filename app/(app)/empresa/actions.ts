'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { companySchema, companyBankSchema } from '@/lib/validations/company'
import { encrypt } from '@/lib/crypto'
import { z } from 'zod'

// Bancos chegam como JSON no campo "bancos" (lista inteira da aba Dados bancários)
function parseBancos(formData: FormData) {
  const raw = formData.get('bancos')
  if (typeof raw !== 'string') return { bancos: undefined }
  let json: unknown
  try { json = JSON.parse(raw) } catch { return { error: 'Dados bancários inválidos.' } }
  const parsed = z.array(companyBankSchema).safeParse(json)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  return { bancos: parsed.data }
}

// Substitui os bancos da empresa pela lista enviada; só um pode ser o principal
async function saveBancos(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  bancos: z.infer<typeof companyBankSchema>[],
) {
  const { error: delError } = await admin.from('company_bank_details').delete().eq('company_id', companyId)
  if (delError) return delError.message
  if (bancos.length === 0) return null

  const principalIdx = bancos.findIndex((b) => b.principal)
  const { error } = await admin.from('company_bank_details').insert(
    bancos.map((b, i) => ({
      company_id: companyId,
      banco:      b.banco.trim(),
      tipo_conta: b.tipo_conta || null,
      agencia:    b.agencia?.trim() || null,
      conta:      b.conta?.trim() || null,
      digito:     b.digito?.trim() || null,
      pix_tipo:   b.pix_tipo || null,
      pix_chave:  (b.pix_tipo && b.pix_chave?.trim()) || null,
      principal:  i === principalIdx,
      ordem:      i,
    })),
  )
  return error?.message ?? null
}

export async function createCompanyAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Sessão inválida. Faça login novamente.' }

  const raw = {
    cnpj:                      formData.get('cnpj') as string,
    razao_social:              formData.get('razao_social') as string,
    nome_fantasia:             formData.get('nome_fantasia') as string || undefined,
    regime_tributario:         formData.get('regime_tributario') as string || undefined,
    telefone:                  formData.get('telefone') as string || undefined,
    email:                     formData.get('email') as string || undefined,
    ie_situacao:               formData.get('ie_situacao') as string || undefined,
    inscricao_estadual:        formData.get('inscricao_estadual') as string || undefined,
    inscricao_municipal:       formData.get('inscricao_municipal') as string || undefined,
    cor_primaria:              formData.get('cor_primaria') as string || undefined,
    certificado_digital_senha: formData.get('certificado_digital_senha') as string || undefined,
    cep:                       formData.get('cep') as string || undefined,
    uf:                        formData.get('uf') as string || undefined,
    cidade:                    formData.get('cidade') as string || undefined,
    logradouro:                formData.get('logradouro') as string || undefined,
    bairro:                    formData.get('bairro') as string || undefined,
    numero:                    formData.get('numero') as string || undefined,
    complemento:               formData.get('complemento') as string || undefined,
  }

  const parsed = companySchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const bancosResult = parseBancos(formData)
  if (bancosResult.error) return { error: bancosResult.error }

  const admin = createAdminClient()

  const certSenhaEnc = parsed.data.certificado_digital_senha
    ? encrypt(parsed.data.certificado_digital_senha)
    : null

  const { data: company, error: companyError } = await admin
    .from('companies')
    .insert({
      cnpj:                          parsed.data.cnpj.replace(/\D/g, ''),
      razao_social:                  parsed.data.razao_social,
      nome_fantasia:                 parsed.data.nome_fantasia || null,
      regime_tributario:             parsed.data.regime_tributario || null,
      telefone:                      parsed.data.telefone || null,
      email:                         parsed.data.email || null,
      ie_situacao:                   parsed.data.ie_situacao || null,
      inscricao_estadual:            parsed.data.inscricao_estadual || null,
      inscricao_municipal:           parsed.data.inscricao_municipal || null,
      cor_primaria:                  parsed.data.cor_primaria || '#C19A6B',
      certificado_digital_senha_enc: certSenhaEnc,
      cep:                           parsed.data.cep?.replace(/\D/g, '') || null,
      uf:                            parsed.data.uf || null,
      cidade:                        parsed.data.cidade || null,
      logradouro:                    parsed.data.logradouro || null,
      bairro:                        parsed.data.bairro || null,
      numero:                        parsed.data.numero || null,
      complemento:                   parsed.data.complemento || null,
    })
    .select('id')
    .single()

  if (companyError) {
    if (companyError.code === '23505') return { error: 'Este CNPJ já está cadastrado.' }
    return { error: `Erro ao criar empresa: ${companyError.message}` }
  }

  const { error: memberError } = await admin.from('company_members').insert({
    company_id: company.id,
    profile_id: user.id,
    role: 'owner',
    status: 'active',
  })

  if (memberError) {
    await admin.from('companies').delete().eq('id', company.id)
    return { error: `Erro ao vincular usuário à empresa: ${memberError.message}` }
  }

  await uploadLogoAndCert(admin, company.id, formData)

  if (bancosResult.bancos) {
    const bancosError = await saveBancos(admin, company.id, bancosResult.bancos)
    if (bancosError) return { companyId: company.id, error: `Empresa criada, mas houve erro ao salvar os dados bancários: ${bancosError}` }
  }

  return { companyId: company.id }
}

export async function updateCompanyAction(companyId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Sessão inválida. Faça login novamente.' }

  const updateSchema = companySchema.omit({ cnpj: true })

  const raw = {
    razao_social:              formData.get('razao_social') as string,
    nome_fantasia:             formData.get('nome_fantasia') as string || undefined,
    regime_tributario:         formData.get('regime_tributario') as string || undefined,
    telefone:                  formData.get('telefone') as string || undefined,
    email:                     formData.get('email') as string || undefined,
    ie_situacao:               formData.get('ie_situacao') as string || undefined,
    inscricao_estadual:        formData.get('inscricao_estadual') as string || undefined,
    inscricao_municipal:       formData.get('inscricao_municipal') as string || undefined,
    cor_primaria:              formData.get('cor_primaria') as string || undefined,
    certificado_digital_senha: formData.get('certificado_digital_senha') as string || undefined,
    cep:                       formData.get('cep') as string || undefined,
    uf:                        formData.get('uf') as string || undefined,
    cidade:                    formData.get('cidade') as string || undefined,
    logradouro:                formData.get('logradouro') as string || undefined,
    bairro:                    formData.get('bairro') as string || undefined,
    numero:                    formData.get('numero') as string || undefined,
    complemento:               formData.get('complemento') as string || undefined,
  }

  const parsed = updateSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const bancosResult = parseBancos(formData)
  if (bancosResult.error) return { error: bancosResult.error }

  const admin = createAdminClient()

  const certSenhaEnc = parsed.data.certificado_digital_senha
    ? encrypt(parsed.data.certificado_digital_senha)
    : undefined

  const { error: updateError } = await admin
    .from('companies')
    .update({
      razao_social:                  parsed.data.razao_social,
      nome_fantasia:                 parsed.data.nome_fantasia || null,
      regime_tributario:             parsed.data.regime_tributario || null,
      telefone:                      parsed.data.telefone || null,
      email:                         parsed.data.email || null,
      ie_situacao:                   parsed.data.ie_situacao || null,
      inscricao_estadual:            parsed.data.inscricao_estadual || null,
      inscricao_municipal:           parsed.data.inscricao_municipal || null,
      ...(certSenhaEnc !== undefined && { certificado_digital_senha_enc: certSenhaEnc }),
      cep:                           parsed.data.cep?.replace(/\D/g, '') || null,
      uf:                            parsed.data.uf || null,
      cidade:                        parsed.data.cidade || null,
      logradouro:                    parsed.data.logradouro || null,
      bairro:                        parsed.data.bairro || null,
      numero:                        parsed.data.numero || null,
      complemento:                   parsed.data.complemento || null,
    })
    .eq('id', companyId)

  if (updateError) return { error: `Erro ao atualizar empresa: ${updateError.message}` }

  await uploadLogoAndCert(admin, companyId, formData)

  if (bancosResult.bancos) {
    const bancosError = await saveBancos(admin, companyId, bancosResult.bancos)
    if (bancosError) return { error: `Erro ao salvar dados bancários: ${bancosError}` }
  }

  revalidatePath('/empresa')
  return {}
}

async function uploadLogoAndCert(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  formData: FormData,
) {
  const logoFile = formData.get('logo_file') as File
  if (logoFile && logoFile.size > 0) {
    const ext = logoFile.name.split('.').pop() || 'jpg'
    const path = `${companyId}/logo.${ext}`
    const bytes = await logoFile.arrayBuffer()
    const { error: uploadErr } = await admin.storage
      .from('logos')
      .upload(path, bytes, { contentType: logoFile.type, upsert: true })
    if (!uploadErr) {
      const { data: urlData } = admin.storage.from('logos').getPublicUrl(path)
      await admin.from('companies').update({ logo_url: urlData.publicUrl }).eq('id', companyId)
    }
  }

  const certFile = formData.get('certificado_file') as File
  if (certFile && certFile.size > 0) {
    const ext = certFile.name.split('.').pop() || 'pfx'
    const path = `${companyId}/certificado.${ext}`
    const bytes = await certFile.arrayBuffer()
    const { error: uploadErr } = await admin.storage
      .from('certificados')
      .upload(path, bytes, { contentType: certFile.type || 'application/octet-stream', upsert: true })
    if (!uploadErr) {
      await admin.from('companies').update({ certificado_digital_url: path }).eq('id', companyId)
    }
  }
}
