'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
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

  if (!profile) return { error: 'Usuário não encontrado. Peça para ele se cadastrar primeiro.' }

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

  // Impedir remoção do último owner
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
