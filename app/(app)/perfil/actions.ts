'use server'

import { revalidatePath } from 'next/cache'
import { createClient as createStatelessClient } from '@supabase/supabase-js'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { hashPin } from '@/lib/security-pin'
import { sendEmailCode, verifyEmailCode, hasVerifiedEmailCode, consumeEmailCodes, marcarIdentidadeConfirmada } from '@/lib/email-codes'
import {
  perfilSchema, perfilSenhaSchema, definirPinSchema, confirmarSenhaSchema, codigo2faSchema,
} from '@/lib/validations/perfil'

// Meu Perfil: o usuário só altera os próprios dados (sempre user.id da sessão)

const MAX_AVATAR_BYTES = 2 * 1024 * 1024 // limite do bucket 'avatars'

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function updatePerfilAction(data: unknown) {
  const user = await getAuthUser()
  if (!user) return { error: 'Sessão inválida. Faça login novamente.' }

  const parsed = perfilSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const d = parsed.data

  const admin = createAdminClient()

  // CPF só pode ser informado uma vez (depois fica bloqueado)
  const { data: atual } = await admin.from('profiles').select('cpf').eq('id', user.id).single()
  const cpf = d.cpf?.replace(/\D/g, '') || null

  const { error } = await admin
    .from('profiles')
    .update({
      name: d.name.trim(),
      ...(!atual?.cpf && cpf ? { cpf } : {}),
      cep: d.cep?.replace(/\D/g, '') || null,
      uf: d.uf || null,
      cidade: d.cidade?.trim() || null,
      logradouro: d.logradouro?.trim() || null,
      bairro: d.bairro?.trim() || null,
      numero: d.numero?.trim() || null,
      complemento: d.complemento?.trim() || null,
    })
    .eq('id', user.id)

  if (error) {
    if (error.code === '23505') return { error: 'Este CPF já está cadastrado em outra conta.' }
    return { error: error.message }
  }

  revalidatePath('/', 'layout') // nome no menu do usuário
  return { success: true }
}

export async function updateAvatarAction(formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Sessão inválida. Faça login novamente.' }

  const file = formData.get('avatar') as File | null
  const admin = createAdminClient()

  // Sem arquivo: remove a foto
  if (!file || file.size === 0) {
    const { data: files } = await admin.storage.from('avatars').list(user.id)
    if (files?.length) await admin.storage.from('avatars').remove(files.map((f) => `${user.id}/${f.name}`))
    const { error } = await admin.from('profiles').update({ avatar_url: null }).eq('id', user.id)
    if (error) return { error: error.message }
    revalidatePath('/', 'layout')
    return { success: true, avatar_url: null }
  }

  if (!file.type.startsWith('image/')) return { error: 'A foto precisa ser uma imagem.' }
  if (file.size > MAX_AVATAR_BYTES) return { error: 'A foto passa de 2 MB.' }

  // Mesmo caminho usado na tela Usuários: {profileId}/avatar.{ext}
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `${user.id}/avatar.${ext}`
  const { error: upErr } = await admin.storage
    .from('avatars')
    .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: true })
  if (upErr) return { error: `Erro ao enviar a foto: ${upErr.message}` }

  const { data: urlData } = admin.storage.from('avatars').getPublicUrl(path)
  const avatar_url = `${urlData.publicUrl}?t=${Date.now()}`
  const { error } = await admin.from('profiles').update({ avatar_url }).eq('id', user.id)
  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  return { success: true, avatar_url }
}

// ── Troca de senha: nova senha → confirmação → código (app autenticador, se o 2FA estiver ativo; senão, e-mail) ──
// A senha só é gravada no servidor depois que o código confere.

/** Etapa "Confirmar": valida a senha segura e prepara o código (envia por e-mail se não houver 2FA) */
export async function iniciarTrocaSenhaAction(data: unknown) {
  const user = await getAuthUser()
  if (!user?.email) return { error: 'Sessão inválida. Faça login novamente.' }
  const parsed = perfilSenhaSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  if (await fatorTotpAtivo()) {
    await consumeEmailCodes(user.id, 'senha')
    return { success: true, metodo: '2fa' as const, email: user.email, aviso: null }
  }
  const sent = await sendEmailCode(user.id, user.email, 'senha')
  if ('error' in sent) return { error: sent.error }
  return { success: true, metodo: 'email' as const, email: user.email, aviso: sent.aviso }
}

/** Etapa "Código": confere o código e grava a nova senha */
export async function concluirTrocaSenhaAction(data: unknown, codigo: unknown) {
  const user = await getAuthUser()
  if (!user) return { error: 'Sessão inválida. Faça login novamente.' }
  const parsed = perfilSenhaSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const parsedCode = codigo2faSchema.safeParse(codigo)
  if (!parsedCode.success) return { error: parsedCode.error.issues[0].message }

  const factorId = await fatorTotpAtivo()
  if (factorId) {
    const supabase = await createClient()
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: parsedCode.data.code })
    if (error) return { error: 'Código do app inválido ou expirado. Confira o app e tente de novo.' }
  } else {
    const check = await verifyEmailCode(user.id, 'senha', parsedCode.data.code)
    if ('error' in check) return { error: check.error }
  }

  // Identidade já confirmada pelo código: grava direto (sem exigir nova reautenticação do Supabase)
  const admin = createAdminClient()
  const { error } = await admin.auth.admin.updateUserById(user.id, { password: parsed.data.password })
  if (error) return { error: 'Não foi possível alterar a senha. Tente novamente.' }

  await consumeEmailCodes(user.id, 'senha')
  return { success: true }
}

/** Fechou o modal no meio: descarta o código enviado */
export async function cancelarTrocaSenhaAction() {
  const user = await getAuthUser()
  if (!user) return { error: 'Sessão inválida. Faça login novamente.' }
  await consumeEmailCodes(user.id, 'senha')
  return { success: true }
}

// ── PIN de segurança ─────────────────────────────────────────

async function savePin(profileId: string, pin: string | null) {
  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({
      security_pin_hash: pin ? hashPin(pin) : null,
      security_pin_updated_at: pin ? new Date().toISOString() : null,
      security_pin_falhas: 0,
      security_pin_bloqueado_ate: null,
    })
    .eq('id', profileId)
  if (error) return { error: error.message }
  revalidatePath('/perfil')
  return { success: true }
}

// Confere a senha da conta sem mexer na sessão atual (cliente à parte, sessão descartada em seguida)
async function senhaConfere(email: string, senha: string) {
  const temp = createStatelessClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  const { error } = await temp.auth.signInWithPassword({ email, password: senha })
  if (error) return false
  await temp.auth.signOut({ scope: 'local' })
  return true
}

// ── Ativação do 2FA: senha → código por e-mail → app autenticador ──
// O cadastro do fator só acontece no servidor e depois das duas confirmações.

/** Etapa 1: confere a senha e envia o código por e-mail */
export async function iniciarAtivacao2faAction(data: unknown) {
  const user = await getAuthUser()
  if (!user?.email) return { error: 'Sessão inválida. Faça login novamente.' }
  const parsed = confirmarSenhaSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  if (!(await senhaConfere(user.email, parsed.data.senha))) return { error: 'Senha incorreta.' }
  const sent = await sendEmailCode(user.id, user.email, 'ativar_2fa')
  if ('error' in sent) return { error: sent.error }
  return { success: true, email: user.email, aviso: sent.aviso }
}

/** Reenvio do código (só para quem já passou pela senha: existe um código desta finalidade) */
export async function reenviarCodigo2faAction(acao: 'ativar' | 'desativar' | 'pin' | 'senha' = 'ativar') {
  const user = await getAuthUser()
  if (!user?.email) return { error: 'Sessão inválida. Faça login novamente.' }
  const finalidade = acao === 'desativar' ? 'desativar_2fa' : acao === 'pin' ? 'pin' : acao === 'senha' ? 'senha' : 'ativar_2fa'
  const admin = createAdminClient()
  const { data } = await admin
    .from('email_verification_codes')
    .select('id')
    .eq('profile_id', user.id)
    .eq('finalidade', finalidade)
    .limit(1)
    .maybeSingle()
  if (!data) return { error: 'Confirme sua senha novamente.' }
  const sent = await sendEmailCode(user.id, user.email, finalidade)
  if ('error' in sent) return { error: sent.error }
  // Não enviado de verdade (desenvolvimento): o aviso vira o erro do toast, para não parecer que chegou
  if (sent.aviso) return { error: sent.aviso }
  return { success: true }
}

/** Etapa 2: confere o código do e-mail e cria o fator TOTP (QR code e chave) */
export async function confirmarEmail2faAction(data: unknown) {
  const user = await getAuthUser()
  if (!user) return { error: 'Sessão inválida. Faça login novamente.' }
  const parsed = codigo2faSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const check = await verifyEmailCode(user.id, 'ativar_2fa', parsed.data.code)
  if ('error' in check) return { error: check.error }

  const supabase = await createClient()
  // Remove tentativas anteriores não concluídas (senão o Supabase recusa um novo cadastro)
  const { data: list } = await supabase.auth.mfa.listFactors()
  for (const f of list?.all ?? []) {
    if (f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id })
  }
  const { data: enrolled, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: `Authenticator ${Date.now()}`,
  })
  if (error || !enrolled) return { error: 'Não foi possível gerar o QR code. Tente novamente.' }

  const qr = enrolled.totp.qr_code.startsWith('data:')
    ? enrolled.totp.qr_code
    : `data:image/svg+xml;utf-8,${encodeURIComponent(enrolled.totp.qr_code)}`
  return { success: true, factorId: enrolled.id, qr, secret: enrolled.totp.secret }
}

/** Etapa 3: confere o código do app e conclui a ativação */
export async function concluirAtivacao2faAction(factorId: string, data: unknown) {
  const user = await getAuthUser()
  if (!user) return { error: 'Sessão inválida. Faça login novamente.' }
  const parsed = codigo2faSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  if (!(await hasVerifiedEmailCode(user.id, 'ativar_2fa'))) {
    return { error: 'A confirmação por e-mail expirou. Comece a ativação novamente.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: parsed.data.code })
  if (error) return { error: 'Código do app inválido ou expirado. Confira o app e tente de novo.' }

  await consumeEmailCodes(user.id, 'ativar_2fa')
  return { success: true }
}

// ── Desativação do 2FA: senha → código por e-mail → remove o fator (no servidor) ──

/** Etapa 1: confere a senha e envia o código por e-mail */
export async function iniciarDesativacao2faAction(data: unknown) {
  const user = await getAuthUser()
  if (!user?.email) return { error: 'Sessão inválida. Faça login novamente.' }
  const parsed = confirmarSenhaSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  if (!(await senhaConfere(user.email, parsed.data.senha))) return { error: 'Senha incorreta.' }
  const sent = await sendEmailCode(user.id, user.email, 'desativar_2fa')
  if ('error' in sent) return { error: sent.error }
  return { success: true, email: user.email, aviso: sent.aviso }
}

/** Etapa 2: confere o código do e-mail e desativa */
export async function concluirDesativacao2faAction(data: unknown) {
  const user = await getAuthUser()
  if (!user) return { error: 'Sessão inválida. Faça login novamente.' }
  const parsed = codigo2faSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const check = await verifyEmailCode(user.id, 'desativar_2fa', parsed.data.code)
  if ('error' in check) return { error: check.error }

  const supabase = await createClient()
  const { data: list } = await supabase.auth.mfa.listFactors()
  for (const f of list?.all ?? []) {
    const { error } = await supabase.auth.mfa.unenroll({ factorId: f.id })
    if (error) return { error: 'Não foi possível desativar. Saia, entre novamente com o código do app e tente outra vez.' }
  }

  await consumeEmailCodes(user.id, 'desativar_2fa')
  return { success: true }
}

/** Fechou o modal de desativação no meio: descarta o código enviado */
export async function cancelarDesativacao2faAction() {
  const user = await getAuthUser()
  if (!user) return { error: 'Sessão inválida. Faça login novamente.' }
  await consumeEmailCodes(user.id, 'desativar_2fa')
  return { success: true }
}

/** Fechou o modal no meio: descarta o fator ainda não confirmado */
export async function cancelarAtivacao2faAction() {
  const user = await getAuthUser()
  if (!user) return { error: 'Sessão inválida. Faça login novamente.' }
  const supabase = await createClient()
  const { data: list } = await supabase.auth.mfa.listFactors()
  for (const f of list?.all ?? []) {
    if (f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id })
  }
  await consumeEmailCodes(user.id, 'ativar_2fa')
  return { success: true }
}

// ── PIN de segurança: senha → código (app autenticador, se o 2FA estiver ativo; senão, e-mail) → PIN ──
// Cadastrar, alterar e remover seguem o mesmo caminho de confirmação de identidade (no servidor).

async function fatorTotpAtivo() {
  const supabase = await createClient()
  const { data } = await supabase.auth.mfa.listFactors()
  return data?.totp[0]?.id ?? null
}

/** Etapa 1: confere a senha. Com 2FA, o próximo passo é o código do app; sem, envia o código por e-mail. */
export async function iniciarPinAction(data: unknown) {
  const user = await getAuthUser()
  if (!user?.email) return { error: 'Sessão inválida. Faça login novamente.' }
  const parsed = confirmarSenhaSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  if (!(await senhaConfere(user.email, parsed.data.senha))) return { error: 'Senha incorreta.' }

  if (await fatorTotpAtivo()) {
    await consumeEmailCodes(user.id, 'pin') // começa do zero
    return { success: true, metodo: '2fa' as const, email: user.email, aviso: null }
  }
  const sent = await sendEmailCode(user.id, user.email, 'pin')
  if ('error' in sent) return { error: sent.error }
  return { success: true, metodo: 'email' as const, email: user.email, aviso: sent.aviso }
}

/** Etapa 2: confere o código (do app autenticador ou do e-mail) */
export async function confirmarIdentidadePinAction(data: unknown) {
  const user = await getAuthUser()
  if (!user) return { error: 'Sessão inválida. Faça login novamente.' }
  const parsed = codigo2faSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const factorId = await fatorTotpAtivo()
  if (factorId) {
    const supabase = await createClient()
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: parsed.data.code })
    if (error) return { error: 'Código do app inválido ou expirado. Confira o app e tente de novo.' }
    await marcarIdentidadeConfirmada(user.id, 'pin')
    return { success: true }
  }

  const check = await verifyEmailCode(user.id, 'pin', parsed.data.code)
  if ('error' in check) return { error: check.error }
  return { success: true }
}

/** Etapa final do cadastro/alteração: grava o novo PIN */
export async function salvarPinAction(data: unknown) {
  const user = await getAuthUser()
  if (!user) return { error: 'Sessão inválida. Faça login novamente.' }
  const parsed = definirPinSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  if (!(await hasVerifiedEmailCode(user.id, 'pin'))) return { error: 'A confirmação expirou. Comece novamente.' }
  const r = await savePin(user.id, parsed.data.pin)
  if ('error' in r) return r
  await consumeEmailCodes(user.id, 'pin')
  return r
}

/** Etapa final da remoção */
export async function removerPinAction() {
  const user = await getAuthUser()
  if (!user) return { error: 'Sessão inválida. Faça login novamente.' }
  if (!(await hasVerifiedEmailCode(user.id, 'pin'))) return { error: 'A confirmação expirou. Comece novamente.' }
  const r = await savePin(user.id, null)
  if ('error' in r) return r
  await consumeEmailCodes(user.id, 'pin')
  return r
}

/** Fechou o modal do PIN no meio: descarta a confirmação */
export async function cancelarPinAction() {
  const user = await getAuthUser()
  if (!user) return { error: 'Sessão inválida. Faça login novamente.' }
  await consumeEmailCodes(user.id, 'pin')
  return { success: true }
}
