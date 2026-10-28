'use server'

import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'
import { aceitarConviteSchema } from '@/lib/validations/auth'
import { buscarConvitePorToken, findUserIdByEmail, vincularMembro } from '@/lib/invitations'

// Aceite do convite pelo link do e-mail (rota pública: quem chega aqui ainda não tem sessão).
// Toda validação parte do token: e-mail, empresa e papel vêm do convite, nunca do formulário.

async function concluirConvite(
  admin: ReturnType<typeof createAdminClient>,
  inv: { id: string; company_id: string; role: string; employee_id: string | null },
  profileId: string,
) {
  const vinculo = await vincularMembro(admin, inv.company_id, profileId, inv.role)
  // Já ser membro não impede concluir o convite
  if ('error' in vinculo && vinculo.error !== 'Este usuário já é membro desta empresa.') return vinculo
  if (inv.employee_id) await admin.from('employees').update({ profile_id: profileId }).eq('id', inv.employee_id)
  // Link usado: deixa de valer
  await admin.from('invitations').update({ status: 'accepted', token_hash: null }).eq('id', inv.id)
  return { success: true as const }
}

async function abrirEmpresa(companyId: string) {
  const cookieStore = await cookies()
  cookieStore.set('active_company_id', companyId, { path: '/', httpOnly: false, sameSite: 'lax', maxAge: 60 * 60 * 24 * 365 })
}

/** Cria a conta com a senha escolhida e vincula à empresa. Não entra no sistema: a pessoa segue para o login. */
export async function aceitarConviteAction(token: string, data: unknown) {
  const parsed = aceitarConviteSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const { name, password } = parsed.data
  const cpf = parsed.data.cpf.replace(/\D/g, '')

  const admin = createAdminClient()
  const inv = await buscarConvitePorToken(admin, token)
  if (!inv) return { error: 'Este convite não é mais válido. Peça um novo convite a quem convidou você.' }

  if (await findUserIdByEmail(admin, inv.email)) {
    return { error: 'Este e-mail já tem uma conta. Recarregue a página para aceitar o convite com ela.' }
  }

  const { data: cpfEmUso } = await admin.from('profiles').select('id').eq('cpf', cpf).maybeSingle()
  if (cpfEmUso) return { error: 'Este CPF já está cadastrado em outra conta.' }

  // E-mail já confirmado: o link do convite chegou nele
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: inv.email,
    password,
    email_confirm: true,
    user_metadata: { name },
  })
  if (createErr || !created.user) return { error: 'Não foi possível criar sua conta. Tente novamente.' }
  const userId = created.user.id

  // Perfil (o trigger do Auth já cria; aqui completa com CPF e a foto definida no convite)
  const { error: profileErr } = await admin.from('profiles').upsert({
    id: userId,
    name,
    cpf,
    ...(inv.avatar_url && { avatar_url: inv.avatar_url }),
  })
  if (profileErr) {
    await admin.auth.admin.deleteUser(userId) // não deixa conta pela metade
    return { error: profileErr.code === '23505' ? 'Este CPF já está cadastrado em outra conta.' : 'Não foi possível salvar seus dados. Tente novamente.' }
  }

  const fim = await concluirConvite(admin, inv, userId)
  if ('error' in fim) return { error: fim.error }

  // Ao entrar pelo login, abre a empresa do convite
  await abrirEmpresa(inv.company_id)
  return { success: true, email: inv.email }
}

/** O e-mail já tem conta: aceita o convite e a pessoa entra com a senha que já usa */
export async function aceitarComContaExistenteAction(token: string) {
  const admin = createAdminClient()
  const inv = await buscarConvitePorToken(admin, token)
  if (!inv) return { error: 'Este convite não é mais válido. Peça um novo convite a quem convidou você.' }

  const userId = await findUserIdByEmail(admin, inv.email)
  if (!userId) return { error: 'Não encontramos uma conta com este e-mail. Recarregue a página.' }

  const fim = await concluirConvite(admin, inv, userId)
  if ('error' in fim) return { error: fim.error }
  await abrirEmpresa(inv.company_id)
  return { success: true }
}
