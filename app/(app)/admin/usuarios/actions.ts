'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { createClient, createAdminClient } from '@/lib/supabase/server'

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

export async function addMemberAction(companyId: string, cpf: string, role: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const normalized = cpf.replace(/\D/g, '')

  if (normalized.length !== 11) return { error: 'CPF inválido.' }

  const { data: profile } = await admin
    .from('profiles')
    .select('id, name')
    .eq('cpf', normalized)
    .single()

  if (!profile) return { error: 'Usuário não encontrado. Use a aba "Convidar" para enviar um convite por e-mail.' }

  const { data: existing } = await admin
    .from('company_members')
    .select('id, status')
    .eq('company_id', companyId)
    .eq('profile_id', profile.id)
    .maybeSingle()

  if (existing) {
    if (existing.status === 'active') return { error: 'Este usuário já é membro desta empresa.' }
    const { error } = await admin
      .from('company_members')
      .update({ status: 'active', role })
      .eq('id', existing.id)
    if (error) return { error: error.message }
    revalidatePath('/admin/usuarios')
    return { success: true }
  }

  const { error } = await admin.from('company_members').insert({
    company_id: companyId,
    profile_id: profile.id,
    role,
    status: 'active',
  })

  if (error) return { error: error.message }
  revalidatePath('/admin/usuarios')
  return { success: true }
}

export async function inviteUserAction(companyId: string, email: string, role: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const normalizedEmail = email.trim().toLowerCase()
  const admin = createAdminClient()

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
  const { error: dbErr } = await admin.from('invitations').insert({
    company_id: companyId,
    email: normalizedEmail,
    role,
    invited_by: user.id,
    status: 'pending',
  })

  if (dbErr) return { error: dbErr.message }

  // Envia convite via Supabase Auth (cria usuário em estado "invited" + dispara e-mail)
  const appUrl = await getAppUrl()
  const { error: emailErr } = await admin.auth.admin.inviteUserByEmail(normalizedEmail, {
    redirectTo: `${appUrl}/auth/callback`,
    data: { company_id: companyId, role },
  })

  if (emailErr) {
    // Convite salvo no banco mas e-mail falhou
    return { warning: `Convite registrado, mas o e-mail não pôde ser enviado: ${emailErr.message}` }
  }

  revalidatePath('/admin/usuarios')
  return { success: true }
}

export async function cancelInvitationAction(invitationId: string, companyId: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('invitations')
    .update({ status: 'cancelled' })
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
