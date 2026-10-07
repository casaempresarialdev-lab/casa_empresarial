'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { companySchema } from '@/lib/validations/company'
import { encrypt } from '@/lib/crypto'
import { parseAreaPermissions, DEFAULT_NEW_MEMBER_PERMISSIONS } from '@/lib/auth/area-permissions'

async function getAppUrl() {
  const hdrs = await headers()
  const host = hdrs.get('host') ?? 'localhost:3000'
  const proto = hdrs.get('x-forwarded-proto') ?? 'http'
  return `${proto}://${host}`
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

  return { companyId: company.id }
}

// Empresa cadastrada por um Apoio Administrativo em nome de um cliente — a
// pedido da Carol: "a empresa nascer com o dono como master, sempre! E
// depois ele adicionar o apoio administrativo como secundário". Quem
// preenche o formulário NÃO vira dono: o dono é convidado por e-mail (só
// vira master de verdade quando aceitar), e quem cadastrou entra como
// membro secundário ativo na hora, pra poder continuar configurando a
// empresa sem esperar o cliente aceitar nada.
export async function createCompanyForClientAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Sessão inválida. Faça login novamente.' }

  const masterEmail = ((formData.get('master_email') as string) || '').trim().toLowerCase()
  if (!masterEmail) return { error: 'Informe o e-mail do dono (master) da empresa.' }
  if (masterEmail === user.email?.toLowerCase()) {
    return { error: 'O e-mail do dono não pode ser o mesmo da sua própria conta — use "Esta empresa é minha" nesse caso.' }
  }

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

  // Quem cadastrou entra como secundário ativo — com a permissão por área
  // que ele mesmo escolheu no formulário (padrão: Sem acesso em tudo).
  const apoioPermissionsRaw = formData.get('apoio_permissions') as string | null
  const apoioPermissions = apoioPermissionsRaw ? JSON.parse(apoioPermissionsRaw) : DEFAULT_NEW_MEMBER_PERMISSIONS

  const { error: memberError } = await admin.from('company_members').insert({
    company_id: company.id,
    profile_id: user.id,
    role: 'admin',
    status: 'active',
    permissions: parseAreaPermissions(apoioPermissions),
  })

  if (memberError) {
    await admin.from('companies').delete().eq('id', company.id)
    return { error: `Erro ao vincular usuário à empresa: ${memberError.message}` }
  }

  // Convite de verdade pro dono — só vira master quando aceitar (mesmo
  // mecanismo de convite+aceite já usado em Usuários e Acessos).
  const { error: invError } = await admin.from('invitations').insert({
    company_id: company.id,
    email: masterEmail,
    role: 'owner',
    invited_by: user.id,
    status: 'pending',
  })

  if (invError) return { error: `Empresa criada, mas o convite ao dono falhou: ${invError.message}` }

  await uploadLogoAndCert(admin, company.id, formData)

  const appUrl = await getAppUrl()
  const { error: emailErr } = await admin.auth.admin.inviteUserByEmail(masterEmail, {
    redirectTo: `${appUrl}/auth/callback`,
    data: { company_id: company.id, role: 'owner' },
  })

  if (emailErr) {
    return { companyId: company.id, warning: `Empresa criada e convite registrado, mas o e-mail não pôde ser enviado automaticamente: ${emailErr.message}` }
  }

  return { companyId: company.id, invited: true }
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
