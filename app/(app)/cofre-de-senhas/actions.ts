'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { encrypt, decrypt } from '@/lib/crypto'
import { verifySecurityPin } from '@/lib/security-pin'
import { findUserIdByEmail } from '@/lib/invitations'
import { sendEmail } from '@/lib/email'
import { getEmailBranding, layoutEmail, escapeHtml } from '@/lib/email-template'

// Cofre pessoal: toda operação fica restrita às credenciais do próprio usuário (profile_id)

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function createCredentialAction(formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const senha = formData.get('senha') as string
  if (!senha) return { error: 'Senha é obrigatória.' }

  const admin = createAdminClient()
  const { error } = await admin.from('credentials').insert({
    profile_id: user.id,
    sistema: formData.get('sistema') as string,
    login: formData.get('login') as string,
    senha_enc: encrypt(senha),
    url: (formData.get('url') as string) || null,
    observacao: (formData.get('observacao') as string) || null,
  })

  if (error) return { error: error.message }
  revalidatePath('/cofre-de-senhas')
  return { success: true }
}

// Editar e remover exigem o PIN de segurança (conferido aqui)
export async function updateCredentialAction(credentialId: string, formData: FormData, pin: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const check = await verifySecurityPin(user.id, pin)
  if (!check.ok) return { error: check.error }

  const admin = createAdminClient()

  const updateData: Record<string, unknown> = {
    sistema: formData.get('sistema') as string,
    login: formData.get('login') as string,
    url: (formData.get('url') as string) || null,
    observacao: (formData.get('observacao') as string) || null,
  }

  const novaSenha = formData.get('senha') as string
  if (novaSenha) {
    updateData.senha_enc = encrypt(novaSenha)
  }

  const { error } = await admin
    .from('credentials')
    .update(updateData)
    .eq('id', credentialId)
    .eq('profile_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/cofre-de-senhas')
  return { success: true }
}

export async function deleteCredentialAction(credentialId: string, pin: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const check = await verifySecurityPin(user.id, pin)
  if (!check.ok) return { error: check.error }

  const admin = createAdminClient()
  const { error } = await admin
    .from('credentials')
    .delete()
    .eq('id', credentialId)
    .eq('profile_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/cofre-de-senhas')
  return { success: true }
}

// ── Ver senha e compartilhar: sempre com o PIN de segurança (conferido aqui, com bloqueio após várias falhas) ──

/** Revela a senha de uma credencial própria ou compartilhada com o usuário, mediante o PIN */
export async function revealPasswordAction(
  credentialId: string,
  pin: string,
): Promise<{ password?: string; error?: string; semPin?: boolean }> {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const check = await verifySecurityPin(user.id, pin)
  if (!check.ok) return { error: check.error, semPin: check.error.startsWith('Você ainda não cadastrou') }

  const admin = createAdminClient()
  const { data } = await admin
    .from('credentials')
    .select('senha_enc, profile_id')
    .eq('id', credentialId)
    .maybeSingle()
  if (!data) return { error: 'Credencial não encontrada.' }

  // Dono ou alguém com quem foi compartilhada
  if (data.profile_id !== user.id) {
    const { data: share } = await admin
      .from('credential_shares')
      .select('id')
      .eq('credential_id', credentialId)
      .eq('shared_with', user.id)
      .maybeSingle()
    if (!share) return { error: 'Credencial não encontrada.' }
  }

  try {
    return { password: decrypt(data.senha_enc) }
  } catch {
    return { error: 'Erro ao descriptografar a senha.' }
  }
}

export type Destinatario = { id: string; email: string; nome: string; avatar_url: string | null }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Credencial própria do usuário (só o dono compartilha; recebida não pode ser recompartilhada) */
async function credencialDoDono(admin: ReturnType<typeof createAdminClient>, credentialId: string, userId: string) {
  const { data } = await admin
    .from('credentials')
    .select('id, sistema')
    .eq('id', credentialId)
    .eq('profile_id', userId)
    .maybeSingle()
  return data
}

/** Etapa 1: confere o e-mail e traz nome e foto de quem vai receber (ainda não compartilha) */
export async function buscarDestinatarioAction(credentialId: string, email: string): Promise<{ destinatario?: Destinatario; error?: string }> {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const normalizedEmail = email.trim().toLowerCase()
  if (!EMAIL_RE.test(normalizedEmail)) return { error: 'Informe um e-mail válido.' }
  if (normalizedEmail === user.email?.toLowerCase()) return { error: 'Você não pode compartilhar com você mesmo.' }

  const admin = createAdminClient()
  if (!(await credencialDoDono(admin, credentialId, user.id))) return { error: 'Só é possível compartilhar credenciais suas.' }

  const destinoId = await findUserIdByEmail(admin, normalizedEmail)
  if (!destinoId) return { error: 'Não encontramos um usuário da Casa Empresarial com este e-mail.' }

  const { data: jaTem } = await admin
    .from('credential_shares')
    .select('id')
    .eq('credential_id', credentialId)
    .eq('shared_with', destinoId)
    .maybeSingle()
  if (jaTem) return { error: 'Esta credencial já está compartilhada com este usuário.' }

  const { data: perfil } = await admin.from('profiles').select('name, avatar_url').eq('id', destinoId).single()
  return { destinatario: { id: destinoId, email: normalizedEmail, nome: perfil?.name ?? normalizedEmail, avatar_url: perfil?.avatar_url ?? null } }
}

/** Etapa 2: com o PIN, compartilha com todos os e-mails da lista. Quem recebe só visualiza. */
export async function compartilharCredentialAction(credentialId: string, emails: string[], pin: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }
  const lista = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter((e) => EMAIL_RE.test(e)))]
  if (!lista.length) return { error: 'Adicione ao menos um e-mail.' }

  const check = await verifySecurityPin(user.id, pin)
  if (!check.ok) return { error: check.error }

  const admin = createAdminClient()
  const cred = await credencialDoDono(admin, credentialId, user.id)
  if (!cred) return { error: 'Só é possível compartilhar credenciais suas.' }

  const { data: dono } = await admin.from('profiles').select('name').eq('id', user.id).single()
  const nomeDono = dono?.name ?? 'Um usuário'
  const branding = await getEmailBranding(null)

  const falhas: string[] = []
  let compartilhadas = 0
  for (const email of lista) {
    const destinoId = email === user.email?.toLowerCase() ? null : await findUserIdByEmail(admin, email)
    if (!destinoId) { falhas.push(email); continue }
    const { error } = await admin.from('credential_shares').insert({
      credential_id: credentialId,
      owner_id: user.id,
      shared_with: destinoId,
      shared_with_email: email,
    })
    // Já compartilhada com essa pessoa conta como feito
    if (error && error.code !== '23505') { falhas.push(email); continue }
    if (!error) compartilhadas++

    // Aviso por e-mail a quem recebeu (extra: o compartilhamento já valeu mesmo se o e-mail não sair)
    if (!error) {
      await sendEmail({
        to: email,
        subject: `${nomeDono} compartilhou uma credencial com você`,
        text: `${nomeDono} compartilhou a credencial "${cred.sistema}" com você na Casa Empresarial. Veja em Cofre de senhas › Compartilhadas comigo (é preciso o seu PIN de segurança para ver a senha).`,
        html: layoutEmail({
          branding,
          previa: `${nomeDono} compartilhou "${cred.sistema}" com você.`,
          titulo: 'Credencial compartilhada com você',
          blocos: [
            { tipo: 'texto', html: `<strong>${escapeHtml(nomeDono)}</strong> compartilhou a credencial <strong>${escapeHtml(cred.sistema)}</strong> com você.` },
            { tipo: 'texto', html: 'Ela está no seu Cofre de senhas, em <strong>Compartilhadas comigo</strong>. Para ver a senha, é preciso informar o seu PIN de segurança.' },
          ],
        }),
      })
    }
  }

  revalidatePath('/cofre-de-senhas')
  if (falhas.length) return { error: `Não foi possível compartilhar com: ${falhas.join(', ')}.`, compartilhadas }
  return { success: true, compartilhadas }
}

/** O dono deixa de compartilhar a credencial com alguém */
export async function removerCompartilhamentoAction(shareId: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }
  const admin = createAdminClient()
  const { error } = await admin.from('credential_shares').delete().eq('id', shareId).eq('owner_id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/cofre-de-senhas')
  return { success: true }
}
