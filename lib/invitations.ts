import { createHash, randomBytes } from 'crypto'
import { createAdminClient } from '@/lib/supabase/server'
import { sendEmail, motivoNaoEnviado } from '@/lib/email'
import { getEmailBranding, layoutEmail, escapeHtml } from '@/lib/email-template'

// Convites de acesso — só no servidor. O e-mail sai pelo SMTP do sistema (lib/email.ts), não pelo Supabase.
// O link /convite/<token> é único: só o hash fica no banco, vale por VALIDADE_DIAS e deixa de valer ao ser usado.

type Admin = ReturnType<typeof createAdminClient>

const VALIDADE_DIAS = 7

const ROLE_LABELS: Record<string, string> = {
  owner: 'Proprietário',
  admin: 'Administrador',
  member: 'Membro',
  accountant: 'Contador',
  colaborador: 'Colaborador',
}

/** Como a pessoa entra na empresa: o nome do perfil de acesso ou, sem perfil, a função */
async function papelDoConvite(admin: Admin, role: string, perfilIds?: string[] | null) {
  if (perfilIds?.length) {
    const { data } = await admin.from('access_profiles').select('nome').in('id', perfilIds)
    if (data?.length) return data.map((p) => p.nome as string).sort().join(', ')
  }
  return ROLE_LABELS[role] ?? role
}

/** Substitui os perfis de acesso de um usuário */
export async function definirPerfisMembro(admin: Admin, companyId: string, memberId: string, perfilIds: string[]) {
  const { error: errLimpar } = await admin.from('member_access_profiles').delete().eq('member_id', memberId)
  if (errLimpar) return errLimpar.message
  if (!perfilIds.length) return null
  const { error } = await admin.from('member_access_profiles').insert(perfilIds.map((profile_id) => ({ member_id: memberId, profile_id, company_id: companyId })))
  return error?.message ?? null
}

export function hashConviteToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

/** Resultado do convite para a tela: sempre diz se o e-mail saiu ou não */
export type ConviteResult =
  | { success: true; emailEnviado: true; notice: string }
  | { warning: string }
  | { error: string }

async function nomeEmpresa(admin: Admin, companyId: string) {
  const { data } = await admin.from('companies').select('razao_social, nome_fantasia').eq('id', companyId).single()
  return data?.nome_fantasia || data?.razao_social || 'uma empresa'
}

export type ConviteValido = {
  id: string
  email: string
  role: string
  roleLabel: string
  company_id: string
  empresa: string
  avatar_url: string | null
  employee_id: string | null
  access_profile_ids: string[]
}

/** Convite do link: só vale se estiver pendente e dentro da validade */
export async function buscarConvitePorToken(admin: Admin, token: string): Promise<ConviteValido | null> {
  if (!token || token.length < 20) return null
  const { data: inv } = await admin
    .from('invitations')
    // '*': access_profile_ids pode ainda não existir (migration 20261108000088)
    .select('*')
    .eq('token_hash', hashConviteToken(token))
    .eq('status', 'pending')
    .maybeSingle()
  if (!inv || new Date(inv.expires_at) < new Date()) return null
  return {
    id: inv.id,
    email: inv.email,
    role: inv.role,
    roleLabel: await papelDoConvite(admin, inv.role, inv.access_profile_ids),
    company_id: inv.company_id,
    empresa: await nomeEmpresa(admin, inv.company_id),
    avatar_url: inv.avatar_url ?? null,
    employee_id: inv.employee_id ?? null,
    access_profile_ids: inv.access_profile_ids ?? [],
  }
}

/** Conta já existente com este e-mail (quem já tem conta não precisa criar senha) */
export async function findUserIdByEmail(admin: Admin, email: string): Promise<string | null> {
  const { data, error } = await admin.rpc('get_auth_user_id_by_email', { p_email: email })
  if (error) return null
  return (data as string | null) ?? null
}

/** Vincula um usuário à empresa (reativa se já foi membro antes) */
export async function vincularMembro(admin: Admin, companyId: string, profileId: string, role: string, perfilIds?: string[]) {
  const { data: existing } = await admin
    .from('company_members')
    .select('id, status')
    .eq('company_id', companyId)
    .eq('profile_id', profileId)
    .maybeSingle()

  if (existing?.status === 'active') return { error: 'Este usuário já é membro desta empresa.' }
  const { data: membro, error } = existing
    ? await admin.from('company_members').update({ status: 'active', role }).eq('id', existing.id).select('id').single()
    : await admin.from('company_members').insert({ company_id: companyId, profile_id: profileId, role, status: 'active' }).select('id').single()
  if (error || !membro) return { error: error?.message ?? 'Não foi possível vincular o usuário.' }
  if (perfilIds?.length) {
    const erro = await definirPerfisMembro(admin, companyId, membro.id, perfilIds)
    if (erro) return { error: erro }
  }
  return { success: true as const }
}

/**
 * Gera um link novo para o convite (o anterior deixa de valer), renova a validade e envia o e-mail.
 * Usado no convite e no reenvio.
 */
export async function enviarConvite(admin: Admin, invitationId: string, appUrl: string): Promise<ConviteResult> {
  const { data: inv } = await admin
    .from('invitations')
    .select('*')
    .eq('id', invitationId)
    .eq('status', 'pending')
    .single()
  if (!inv) return { error: 'Convite não encontrado.' }

  const token = randomBytes(32).toString('base64url')
  const expira = new Date(Date.now() + VALIDADE_DIAS * 24 * 60 * 60 * 1000)
  const { error: upErr } = await admin
    .from('invitations')
    .update({ token_hash: hashConviteToken(token), expires_at: expira.toISOString() })
    .eq('id', inv.id)
  if (upErr) return { error: upErr.message }

  const branding = await getEmailBranding(inv.company_id)
  const empresa = branding.nome
  const papel = await papelDoConvite(admin, inv.role, inv.access_profile_ids)
  const link = `${appUrl}/convite/${token}`
  const validade = expira.toLocaleDateString('pt-BR')

  const envio = await sendEmail({
    to: inv.email,
    subject: `Convite para acessar ${empresa}`,
    text:
      `Você foi convidado(a) para acessar ${empresa} na Casa Empresarial como ${papel}.\n\n` +
      `Cadastre sua senha pelo link abaixo (válido até ${validade}):\n${link}\n\n` +
      `Se você não esperava este convite, ignore este e-mail.`,
    html: layoutEmail({
      branding,
      previa: `Cadastre sua senha para acessar ${empresa}.`,
      titulo: 'Você foi convidado(a)',
      blocos: [
        { tipo: 'texto', html: `Você recebeu acesso a <strong>${escapeHtml(empresa)}</strong> como <strong>${escapeHtml(papel)}</strong>.` },
        { tipo: 'texto', html: 'Para começar, cadastre a sua senha:' },
        { tipo: 'botao', texto: 'Cadastrar minha senha', url: link },
        { tipo: 'nota', html: `O link vale até <strong>${validade}</strong> e só pode ser usado uma vez.` },
        { tipo: 'nota', html: 'Se você não esperava este convite, pode ignorar este e-mail.' },
      ],
    }),
  })

  if (envio.status === 'enviado') return { success: true, emailEnviado: true, notice: `Convite enviado para ${inv.email}.` }
  return { warning: `Convite registrado, mas o e-mail NÃO foi enviado: ${motivoNaoEnviado(envio)}.` }
}

/** Quem já tem conta não recebe convite: entra direto na empresa e é avisado por e-mail */
export async function adicionarContaExistente(
  admin: Admin,
  opts: { companyId: string; profileId: string; email: string; role: string; employeeId?: string | null; perfilIds?: string[]; appUrl: string },
) {
  const vinculo = await vincularMembro(admin, opts.companyId, opts.profileId, opts.role, opts.perfilIds)
  if ('error' in vinculo) return vinculo

  // Convite de colaborador: o cadastro do funcionário passa a ser desta conta
  if (opts.employeeId) await admin.from('employees').update({ profile_id: opts.profileId }).eq('id', opts.employeeId)

  // Convites pendentes para este e-mail nesta empresa deixam de fazer sentido
  await admin
    .from('invitations')
    .update({ status: 'accepted', token_hash: null })
    .eq('company_id', opts.companyId)
    .eq('email', opts.email)
    .eq('status', 'pending')

  const branding = await getEmailBranding(opts.companyId)
  const empresa = branding.nome
  const papel = await papelDoConvite(admin, opts.role, opts.perfilIds)
  const envio = await sendEmail({
    to: opts.email,
    subject: `Você agora tem acesso a ${empresa}`,
    text: `Você foi adicionado(a) a ${empresa} na Casa Empresarial como ${papel}. Entre com a sua conta de sempre em ${opts.appUrl}/login e escolha a empresa no menu do usuário.`,
    html: layoutEmail({
      branding,
      previa: `Você foi adicionado(a) a ${empresa}.`,
      titulo: 'Novo acesso liberado',
      blocos: [
        { tipo: 'texto', html: `Você foi adicionado(a) a <strong>${escapeHtml(empresa)}</strong> como <strong>${escapeHtml(papel)}</strong>.` },
        { tipo: 'texto', html: 'Entre com a sua conta de sempre e escolha a empresa no menu do usuário.' },
        { tipo: 'botao', texto: 'Acessar', url: `${opts.appUrl}/login` },
      ],
    }),
  })

  if (envio.status === 'enviado') {
    return { success: true as const, emailEnviado: true, contaExistente: true, notice: `${opts.email} já tinha conta e foi adicionado à empresa. E-mail de aviso enviado.` }
  }
  return {
    success: true as const,
    emailEnviado: false,
    contaExistente: true,
    notice: `${opts.email} já tinha conta e foi adicionado à empresa, mas o e-mail de aviso NÃO foi enviado: ${motivoNaoEnviado(envio)}.`,
  }
}
