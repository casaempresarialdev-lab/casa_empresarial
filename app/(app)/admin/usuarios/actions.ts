'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { findUserIdByEmail, adicionarContaExistente, enviarConvite } from '@/lib/invitations'

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

async function getAppUrl() {
  const hdrs = await headers()
  const host = hdrs.get('host') ?? 'localhost:3000'
  const proto = hdrs.get('x-forwarded-proto') ?? 'http'
  return `${proto}://${host}`
}

export async function inviteUserAction(
  companyId: string,
  email: string,
  role: string,
) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const normalizedEmail = email.trim().toLowerCase()
  const admin = createAdminClient()

  const appUrl = await getAppUrl()

  // Já tem conta: entra direto na empresa (não há senha a criar)
  const existingUserId = await findUserIdByEmail(admin, normalizedEmail)
  if (existingUserId) {
    const r = await adicionarContaExistente(admin, { companyId, profileId: existingUserId, email: normalizedEmail, role, appUrl })
    revalidatePath('/admin/usuarios')
    return r
  }

  // Verifica convite pendente já existente
  const { data: existing } = await admin
    .from('invitations')
    .select('id')
    .eq('company_id', companyId)
    .eq('email', normalizedEmail)
    .eq('status', 'pending')
    .maybeSingle()

  if (existing) return { error: 'Já existe um convite pendente para este e-mail.' }

  // Cria registro do convite
  const { data: inv, error: dbErr } = await admin.from('invitations').insert({
    company_id: companyId,
    email: normalizedEmail,
    role,
    invited_by: user.id,
    status: 'pending',
  }).select('id').single()

  if (dbErr || !inv) return { error: dbErr?.message ?? 'Erro ao criar convite.' }

  // E-mail com link único para criar a senha (SMTP do sistema)
  const result = await enviarConvite(admin, inv.id, appUrl)
  revalidatePath('/admin/usuarios')
  return result
}

export async function resendInvitationAction(invitationId: string, companyId: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()

  const { data: inv } = await admin
    .from('invitations')
    .select('id, email, role, employee_id')
    .eq('id', invitationId)
    .eq('company_id', companyId)
    .eq('status', 'pending')
    .single()

  if (!inv) return { error: 'Convite não encontrado.' }

  const appUrl = await getAppUrl()

  // A pessoa criou conta depois do convite: entra direto na empresa
  const existingUserId = await findUserIdByEmail(admin, inv.email)
  if (existingUserId) {
    const r = await adicionarContaExistente(admin, {
      companyId, profileId: existingUserId, email: inv.email, role: inv.role, employeeId: inv.employee_id, appUrl,
    })
    revalidatePath('/admin/usuarios')
    return r
  }

  // Novo link (o anterior deixa de valer) e novo e-mail
  const result = await enviarConvite(admin, inv.id, appUrl)
  revalidatePath('/admin/usuarios')
  // No reenvio, e-mail que não saiu é falha (✕ no toast)
  if ('warning' in result) return { error: result.warning }
  return result
}

export async function cancelInvitationAction(invitationId: string, companyId: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('invitations')
    .update({ status: 'cancelled', token_hash: null }) // o link do e-mail deixa de valer
    .eq('id', invitationId)
    .eq('company_id', companyId)

  if (error) return { error: error.message }
  revalidatePath('/admin/usuarios')
  return { success: true }
}

export async function updateMemberRoleAction(memberId: string, role: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('company_members')
    .update({ role })
    .eq('id', memberId)

  if (error) return { error: error.message }
  revalidatePath('/admin/usuarios')
  return { success: true }
}

export async function updateMemberProfileAction(
  profileId: string,
  companyId: string,
  formData: {
    name: string
    avatarFile?: File | null
    cep?: string
    uf?: string
    cidade?: string
    logradouro?: string
    bairro?: string
    numero?: string
    complemento?: string
  }
) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()

  // Verificar se o usuário atual é owner da empresa
  const { data: currentMember } = await admin
    .from('company_members')
    .select('role')
    .eq('company_id', companyId)
    .eq('profile_id', user.id)
    .eq('status', 'active')
    .single()

  if (currentMember?.role !== 'owner') {
    return { error: 'Apenas proprietários podem editar perfis de membros.' }
  }

  let avatar_url: string | undefined

  if (formData.avatarFile) {
    const ext = formData.avatarFile.name.split('.').pop() ?? 'jpg'
    const path = `${profileId}/avatar.${ext}`
    const arrayBuffer = await formData.avatarFile.arrayBuffer()

    const { error: uploadErr } = await admin.storage
      .from('avatars')
      .upload(path, arrayBuffer, { contentType: formData.avatarFile.type, upsert: true })

    if (uploadErr) return { error: `Erro ao fazer upload: ${uploadErr.message}` }

    const { data: urlData } = admin.storage.from('avatars').getPublicUrl(path)
    avatar_url = `${urlData.publicUrl}?t=${Date.now()}`
  }

  const updates: Record<string, unknown> = {
    name: formData.name,
    cep: formData.cep || null,
    uf: formData.uf || null,
    cidade: formData.cidade || null,
    logradouro: formData.logradouro || null,
    bairro: formData.bairro || null,
    numero: formData.numero || null,
    complemento: formData.complemento || null,
  }
  if (avatar_url) updates.avatar_url = avatar_url

  const { error } = await admin.from('profiles').update(updates).eq('id', profileId)
  if (error) return { error: error.message }

  revalidatePath('/admin/usuarios')
  return { success: true, avatar_url }
}

export async function changePasswordAction(newPassword: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }

  if (newPassword.length < 6) return { error: 'A senha deve ter no mínimo 6 caracteres.' }

  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) return { error: error.message }

  return { success: true }
}

export async function removeMemberAction(memberId: string, companyId: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()

  const { data: member } = await admin
    .from('company_members')
    .select('role, profile_id')
    .eq('id', memberId)
    .single()

  if (member?.role === 'owner') {
    const { count } = await admin
      .from('company_members')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('role', 'owner')
      .eq('status', 'active')

    if ((count ?? 0) <= 1) return { error: 'Não é possível remover o único proprietário.' }
  }

  const { error } = await admin
    .from('company_members')
    .update({ status: 'inactive' })
    .eq('id', memberId)

  if (error) return { error: error.message }
  revalidatePath('/admin/usuarios')
  return { success: true }
}
