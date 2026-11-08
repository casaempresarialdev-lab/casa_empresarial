import { headers } from 'next/headers'
import type { createAdminClient } from '@/lib/supabase/server'
import { adicionarContaExistente, enviarConvite, findUserIdByEmail } from '@/lib/invitations'

type Admin = ReturnType<typeof createAdminClient>

async function urlDoApp() {
  const hdrs = await headers()
  const host = hdrs.get('host') ?? 'localhost:3000'
  const proto = hdrs.get('x-forwarded-proto') ?? 'http'
  return `${proto}://${host}`
}

/**
 * Admissão finalizada: a pessoa ganha o acesso com o perfil Funcionário e recebe o e-mail para cadastrar a senha
 * (quem já tem conta é só adicionado à empresa e avisado). Devolve o que aconteceu, para o histórico e o aviso na tela.
 * Nunca falha: um problema aqui não pode desfazer a admissão.
 */
export async function criarAcessoFuncionario(admin: Admin, opcoes: {
  companyId: string
  employeeId: string
  email: string | null
  jaTemConta: boolean
  autorId: string | null
}): Promise<string | null> {
  const { companyId, employeeId, autorId, jaTemConta } = opcoes
  if (jaTemConta) return null

  const email = opcoes.email?.trim().toLowerCase()
  if (!email) return 'Acesso não enviado: o cadastro não tem e-mail.'

  try {
    const { data: perfil } = await admin.from('access_profiles').select('id').eq('company_id', companyId).eq('padrao', 'funcionario').maybeSingle()
    if (!perfil) return 'Acesso não enviado: o perfil Funcionário não foi encontrado.'
    const perfilIds = [perfil.id as string]
    const appUrl = await urlDoApp()

    // Já tem conta: entra direto na empresa, sem criar senha
    const contaId = await findUserIdByEmail(admin, email)
    if (contaId) {
      const r = await adicionarContaExistente(admin, { companyId, profileId: contaId, email, role: 'member', employeeId, perfilIds, appUrl })
      if ('error' in r) return `Acesso não enviado: ${r.error}`
      return 'emailEnviado' in r && r.emailEnviado ? `Acesso de Funcionário liberado e aviso enviado para ${email}.` : `Acesso de Funcionário liberado, mas o aviso para ${email} não foi enviado.`
    }

    // Convite pendente para o mesmo e-mail: aproveita, somando o perfil Funcionário
    const { data: pendente } = await admin.from('invitations').select('*').eq('company_id', companyId).eq('email', email).eq('status', 'pending').maybeSingle()
    // Já recebeu no fim do cadastro e o link ainda vale: não manda de novo ao finalizar
    if (pendente?.employee_id === employeeId && perfilIds.every((id) => pendente.access_profile_ids?.includes(id)) && new Date(pendente.expires_at) > new Date()) return null

    let conviteId = pendente?.id as string | undefined
    if (pendente) {
      const ids = [...new Set([...(pendente.access_profile_ids ?? []), ...perfilIds])]
      await admin.from('invitations').update({ access_profile_ids: ids, employee_id: employeeId }).eq('id', pendente.id)
    } else {
      const { data: novo, error } = await admin
        .from('invitations')
        .insert({ company_id: companyId, email, role: 'member', access_profile_ids: perfilIds, employee_id: employeeId, invited_by: autorId, status: 'pending' })
        .select('id')
        .single()
      if (error || !novo) return `Acesso não enviado: ${error?.message ?? 'não foi possível criar o convite.'}`
      conviteId = novo.id as string
    }

    const envio = await enviarConvite(admin, conviteId!, appUrl)
    if ('emailEnviado' in envio) return `Acesso de Funcionário criado: e-mail para cadastrar a senha enviado para ${email}.`
    return `Acesso de Funcionário criado, mas o e-mail para ${email} não foi enviado. Reenvie em Acessos > Usuários.`
  } catch (e) {
    console.error('[admissão] acesso não criado:', e instanceof Error ? e.message : e)
    return 'Acesso não enviado: ocorreu um erro. Conceda pela ficha do funcionário.'
  }
}
