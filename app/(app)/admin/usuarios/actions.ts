'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { findUserIdByEmail, adicionarContaExistente, definirPerfisMembro, enviarConvite } from '@/lib/invitations'
import { TODAS_AS_CHAVES } from '@/lib/acesso/catalogo'
import { perfilAcessoSchema } from '@/lib/validations/acesso'
import { semAcesso } from '@/lib/auth/acesso'
import { buscarCargo } from '@/lib/estrutura'

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

/** Ao menos um perfil, e todos desta empresa */
async function perfisDaEmpresa(admin: ReturnType<typeof createAdminClient>, companyId: string, perfilIds: string[]) {
  if (!perfilIds.length) return false
  const { count } = await admin.from('access_profiles').select('id', { count: 'exact', head: true }).eq('company_id', companyId).in('id', perfilIds)
  return count === new Set(perfilIds).size
}

async function ehPadrao(admin: ReturnType<typeof createAdminClient>, companyId: string, perfilId: string) {
  const { data } = await admin.from('access_profiles').select('padrao').eq('id', perfilId).eq('company_id', companyId).maybeSingle()
  return !!data?.padrao
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
  perfilIds: string[],
) {
  const negado = await semAcesso('sistema.acesso', companyId)
  if (negado) return negado

  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const normalizedEmail = email.trim().toLowerCase()
  const admin = createAdminClient()

  if (!await perfisDaEmpresa(admin, companyId, perfilIds)) return { error: 'Escolha ao menos um perfil de acesso.' }
  // A função fica como "membro": o que vale são os perfis
  const role = 'member'

  const appUrl = await getAppUrl()

  // Já tem conta: entra direto na empresa (não há senha a criar)
  const existingUserId = await findUserIdByEmail(admin, normalizedEmail)
  if (existingUserId) {
    const r = await adicionarContaExistente(admin, { companyId, profileId: existingUserId, email: normalizedEmail, role, perfilIds, appUrl })
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
    access_profile_ids: perfilIds,
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
  const negado = await semAcesso('sistema.acesso', companyId)
  if (negado) return negado

  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()

  const { data: inv } = await admin
    .from('invitations')
    .select('*')
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
      companyId, profileId: existingUserId, email: inv.email, role: inv.role, employeeId: inv.employee_id, perfilIds: inv.access_profile_ids, appUrl,
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
  const negado = await semAcesso('sistema.acesso', companyId)
  if (negado) return negado

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

/** Define os perfis de um usuário. Proprietário e colaborador têm acesso definido à parte, sem perfil. */
export async function atualizarPerfisMembroAction(companyId: string, memberId: string, perfilIds: string[]) {
  const negado = await semAcesso('sistema.acesso', companyId)
  if (negado) return negado

  const admin = createAdminClient()
  if (!await perfisDaEmpresa(admin, companyId, perfilIds)) return { error: 'Escolha ao menos um perfil de acesso.' }

  const { data: membro } = await admin.from('company_members').select('role').eq('id', memberId).eq('company_id', companyId).maybeSingle()
  if (!membro) return { error: 'Usuário não encontrado.' }
  if (membro.role === 'owner' || membro.role === 'colaborador') return { error: 'Este usuário não usa perfil de acesso.' }

  const erro = await definirPerfisMembro(admin, companyId, memberId, perfilIds)
  if (erro) return { error: erro }
  revalidatePath('/admin/usuarios')
  return { success: true }
}

/** Liga o usuário a um cargo da Estrutura: na ficha, se ele tiver uma ativa na Equipe; senão, no vínculo com a empresa */
export async function atualizarCargoMembroAction(companyId: string, memberId: string, positionId: string) {
  const negado = await semAcesso('sistema.acesso', companyId)
  if (negado) return negado

  const admin = createAdminClient()
  const { data: membro } = await admin.from('company_members').select('profile_id').eq('id', memberId).eq('company_id', companyId).maybeSingle()
  if (!membro) return { error: 'Usuário não encontrado.' }

  const cargo = positionId ? await buscarCargo(admin, companyId, positionId) : null
  if (positionId && !cargo) return { error: 'Escolha um dos cargos cadastrados.' }

  const { data: ficha } = await admin
    .from('employees')
    .select('id')
    .eq('company_id', companyId)
    .eq('profile_id', membro.profile_id)
    .not('status', 'in', '(inativo,demitido)')
    .limit(1)
    .maybeSingle()

  const { error } = ficha
    ? await admin.from('employees').update({ position_id: cargo?.id ?? null, cargo: cargo?.nome ?? null, departamento: cargo?.departamento ?? null }).eq('id', ficha.id)
    : await admin.from('company_members').update({ position_id: cargo?.id ?? null }).eq('id', memberId).eq('company_id', companyId)
  if (error) return { error: error.message }

  revalidatePath('/admin/usuarios')
  revalidatePath('/empresa')
  revalidatePath('/pessoas/funcionarios')
  return { success: true }
}

/** Cria ou edita um perfil de acesso: um nome e os itens liberados */
export async function salvarPerfilAcessoAction(companyId: string, perfilId: string | null, data: unknown) {
  const negado = await semAcesso('sistema.acesso', companyId)
  if (negado) return negado

  const parsed = perfilAcessoSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const campos = {
    nome: parsed.data.nome,
    // Só o que existe no catálogo, sem repetir
    permissoes: TODAS_AS_CHAVES.filter((k) => parsed.data.permissoes.includes(k)),
    updated_at: new Date().toISOString(),
  }

  const admin = createAdminClient()
  if (perfilId && await ehPadrao(admin, companyId, perfilId)) return { error: 'Os perfis padrão não podem ser alterados.' }
  const { error } = perfilId
    ? await admin.from('access_profiles').update(campos).eq('id', perfilId).eq('company_id', companyId)
    : await admin.from('access_profiles').insert({ ...campos, company_id: companyId })
  if (error) return { error: error.code === '23505' ? 'Já existe um perfil com esse nome.' : error.message }

  revalidatePath('/admin/usuarios')
  revalidatePath('/', 'layout')
  return { success: true }
}

/** Perfil em uso não pode ser excluído: quem está nele ficaria sem acesso */
export async function excluirPerfilAcessoAction(companyId: string, perfilId: string) {
  const negado = await semAcesso('sistema.acesso', companyId)
  if (negado) return negado

  const admin = createAdminClient()
  if (await ehPadrao(admin, companyId, perfilId)) return { error: 'Os perfis padrão não podem ser excluídos.' }
  const [{ count: usuarios }, { count: convites }] = await Promise.all([
    admin.from('member_access_profiles').select('member_id', { count: 'exact', head: true }).eq('company_id', companyId).eq('profile_id', perfilId),
    admin.from('invitations').select('id', { count: 'exact', head: true }).eq('company_id', companyId).contains('access_profile_ids', [perfilId]).eq('status', 'pending'),
  ])
  if (usuarios) return { error: `Este perfil está em uso por ${usuarios} ${usuarios === 1 ? 'usuário' : 'usuários'}. Tire o perfil deles antes de excluir.` }
  if (convites) return { error: `Este perfil está em ${convites} ${convites === 1 ? 'convite pendente' : 'convites pendentes'}. Cancele antes de excluir.` }

  const { error } = await admin.from('access_profiles').delete().eq('id', perfilId).eq('company_id', companyId)
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
  const negado = await semAcesso('sistema.acesso', companyId)
  if (negado) return negado

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
  const negado = await semAcesso('sistema.acesso', companyId)
  if (negado) return negado

  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()

  const { data: member } = await admin
    .from('company_members')
    .select('role, profile_id')
    .eq('id', memberId)
    .eq('company_id', companyId)
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
    .eq('company_id', companyId)

  if (error) return { error: error.message }
  // Quem sai da empresa não prende os perfis; ao voltar, recebe os perfis do novo convite
  await admin.from('member_access_profiles').delete().eq('member_id', memberId)
  revalidatePath('/admin/usuarios')
  return { success: true }
}
