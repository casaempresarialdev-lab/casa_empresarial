'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { semAcesso } from '@/lib/auth/acesso'
import { conferirFerias } from '@/lib/ferias/servidor'
import { feriasSchema } from '@/lib/validations/ferias'
import { fimDasFerias } from '@/lib/ferias/regras'
import { notificarGestores, periodoTexto } from '@/lib/notificacoes'
import { getConfigFolha } from '../pessoas/folha-de-pagamento/queries'

/** A própria ficha do usuário logado nesta empresa: quem pede é sempre quem está logado */
async function minhaFicha() {
  const negado = await semAcesso('visao-geral.bater-ponto')
  if (negado) return negado
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sessão inválida. Faça login novamente.' }
  const companyId = (await cookies()).get('active_company_id')?.value
  if (!companyId) return { error: 'Selecione uma empresa.' }
  const { data: ficha } = await createAdminClient()
    .from('employees').select('id, nome').eq('company_id', companyId).eq('profile_id', user.id).not('status', 'in', '(inativo,demitido)').limit(1).maybeSingle()
  if (!ficha) return { error: 'Seu usuário não está ligado a uma ficha da Equipe.' }
  return { userId: user.id, companyId, employeeId: ficha.id as string, nome: ficha.nome as string }
}

function revalidar() {
  revalidatePath('/minhas-ferias')
  revalidatePath('/pessoas/ferias')
}

/** Pedido de férias: fica aguardando a aprovação da área de Pessoas */
export async function solicitarFeriasAction(dados: unknown) {
  const eu = await minhaFicha()
  if ('error' in eu) return eu

  const config = await getConfigFolha(eu.companyId)
  if (!config.ferias_solicitacao_ativa) return { error: 'A empresa não recebe pedidos de férias por aqui. Fale com a área de Pessoas.' }

  const parsed = feriasSchema.safeParse(dados)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const d = parsed.data

  const admin = createAdminClient()
  const conferido = await conferirFerias(admin, { companyId: eu.companyId, employeeId: eu.employeeId, periodoInicio: d.periodo_inicio, pedido: { inicio: d.data_inicio, dias: d.dias, abono: d.dias_abono }, origem: 'colaborador' })
  if ('error' in conferido) return conferido

  const { error } = await admin.from('employee_vacations').insert({
    company_id: eu.companyId, employee_id: eu.employeeId, periodo_inicio: d.periodo_inicio, data_inicio: d.data_inicio, dias: d.dias, dias_abono: d.dias_abono,
    observacao: d.observacao || null, status: 'solicitada', origem: 'colaborador', solicitado_por: eu.userId,
  })
  if (error) return { error: error.message }
  await notificarGestores(admin, {
    companyId: eu.companyId, item: 'pessoas.ferias', autorId: eu.userId, tipo: 'ferias',
    titulo: 'Pedido de férias para aprovar', mensagem: `${eu.nome} pediu férias de ${periodoTexto(d.data_inicio, conferido.fim)}${d.dias_abono ? `, vendendo ${d.dias_abono} dias` : ''}.`, link: '/pessoas/ferias',
  })
  revalidar()
  return { success: true as const }
}

/** Desiste de um pedido que ainda não foi decidido */
export async function desistirFeriasAction(id: string) {
  const eu = await minhaFicha()
  if ('error' in eu) return eu
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('employee_vacations')
    .update({ status: 'cancelada' })
    .eq('id', id)
    .eq('company_id', eu.companyId)
    .eq('employee_id', eu.employeeId)
    .eq('status', 'solicitada')
    .select('id, data_inicio, dias')
    .maybeSingle()
  if (error) return { error: error.message }
  if (!data) return { error: 'Este pedido já foi decidido.' }
  await notificarGestores(admin, {
    companyId: eu.companyId, item: 'pessoas.ferias', autorId: eu.userId, tipo: 'ferias',
    titulo: 'Pedido de férias cancelado', mensagem: `${eu.nome} desistiu do pedido de férias de ${periodoTexto(data.data_inicio as string, fimDasFerias(data.data_inicio as string, data.dias as number))}.`, link: '/pessoas/ferias',
  })
  revalidar()
  return { success: true as const }
}
