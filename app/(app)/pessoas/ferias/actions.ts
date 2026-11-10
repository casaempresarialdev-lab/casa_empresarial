'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getViewerContext } from '@/lib/auth/viewer'
import { semAcesso } from '@/lib/auth/acesso'
import { conferirFerias, desmarcarFerias, marcarFerias, mesFechado } from '@/lib/ferias/servidor'
import { feriasSchema } from '@/lib/validations/ferias'
import { fimDasFerias } from '@/lib/ferias/regras'
import { notificarFuncionario, periodoTexto } from '@/lib/notificacoes'
import type { ReciboFerias } from '@/lib/folha/recibos'
import { gerarReciboFerias, getRecibos, removerReciboFerias } from '../folha-de-pagamento/recibos'

// Gestão de férias: quem tem acesso a Pessoas → Férias programa, aprova, recusa e cancela

async function gestor(companyId: string): Promise<{ error: string } | { id: string; nome: string }> {
  const negado = await semAcesso('pessoas.ferias', companyId)
  if (negado) return negado
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  const viewer = await getViewerContext(companyId)
  if (viewer?.isColaborador) return { error: 'Sem permissão para esta ação.' }
  const { data } = await createAdminClient().from('profiles').select('name').eq('id', user.id).maybeSingle()
  return { id: user.id, nome: (data?.name as string | undefined) ?? 'Usuário' }
}

function revalidar() {
  revalidatePath('/pessoas/ferias')
  revalidatePath('/minhas-ferias')
  revalidatePath('/meu-ponto')
  revalidatePath('/pessoas/registro-de-ponto')
  revalidatePath('/pessoas/folha-de-pagamento')
}

/** Programa já aprovadas: os dias saem do ponto e o valor entra na folha */
export async function programarFeriasAction(companyId: string, dados: unknown) {
  const autor = await gestor(companyId)
  if ('error' in autor) return autor

  const parsed = feriasSchema.safeParse(dados)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const d = parsed.data
  if (!d.employee_id) return { error: 'Selecione o funcionário.' }

  const admin = createAdminClient()
  const conferido = await conferirFerias(admin, { companyId, employeeId: d.employee_id, periodoInicio: d.periodo_inicio, pedido: { inicio: d.data_inicio, dias: d.dias, abono: d.dias_abono }, origem: 'gestor' })
  if ('error' in conferido) return conferido
  const fechado = await mesFechado(admin, companyId, d.employee_id, d.data_inicio, d.dias)
  if (fechado) return { error: fechado }

  const { data: criada, error } = await admin
    .from('employee_vacations')
    .insert({
      company_id: companyId, employee_id: d.employee_id, periodo_inicio: d.periodo_inicio, data_inicio: d.data_inicio, dias: d.dias, dias_abono: d.dias_abono,
      observacao: d.observacao || null, status: 'aprovada', origem: 'gestor', solicitado_por: autor.id,
      decidido_por_nome: autor.nome, decidido_em: new Date().toISOString(),
    })
    .select('id')
    .single()
  if (error || !criada) return { error: error?.message ?? 'Não foi possível programar as férias.' }

  const erro = await marcarFerias(admin, companyId, d.employee_id, d.data_inicio, d.dias)
  if (erro) {
    await admin.from('employee_vacations').delete().eq('id', criada.id)
    return { error: erro }
  }
  const erroRecibo = await gerarReciboFerias(admin, companyId, criada.id, autor.nome)
  if (erroRecibo) {
    await desmarcarFerias(admin, companyId, d.employee_id, d.data_inicio, d.dias)
    await admin.from('employee_vacations').delete().eq('id', criada.id)
    return { error: erroRecibo }
  }
  await notificarFuncionario(admin, {
    companyId, employeeId: d.employee_id, autorId: autor.id, tipo: 'ferias',
    titulo: 'Férias programadas', mensagem: `A área de Pessoas programou suas férias de ${periodoTexto(d.data_inicio, conferido.fim)}.`, link: '/minhas-ferias',
  })
  revalidar()
  return { success: true as const }
}

export async function decidirFeriasAction(companyId: string, id: string, decisao: 'aprovada' | 'recusada', resposta?: string) {
  const autor = await gestor(companyId)
  if ('error' in autor) return autor
  if (decisao !== 'aprovada' && decisao !== 'recusada') return { error: 'Decisão inválida.' }

  const admin = createAdminClient()
  const { data: f } = await admin.from('employee_vacations').select('employee_id, periodo_inicio, data_inicio, dias, dias_abono, status').eq('id', id).eq('company_id', companyId).maybeSingle()
  if (!f || f.status !== 'solicitada') return { error: 'Este pedido já foi decidido.' }

  if (decisao === 'aprovada') {
    // Confere de novo: a escala, os feriados ou outras férias podem ter mudado desde o pedido
    const conferido = await conferirFerias(admin, {
      companyId, employeeId: f.employee_id as string, periodoInicio: f.periodo_inicio as string,
      pedido: { inicio: f.data_inicio as string, dias: f.dias as number, abono: f.dias_abono as number }, origem: 'gestor', ignorarId: id,
    })
    if ('error' in conferido) return conferido
    const fechado = await mesFechado(admin, companyId, f.employee_id as string, f.data_inicio as string, f.dias as number)
    if (fechado) return { error: fechado }
  }

  // Marca primeiro: duas pessoas não decidem o mesmo pedido
  const { data: decidido, error } = await admin
    .from('employee_vacations')
    .update({ status: decisao, resposta: resposta?.trim().slice(0, 500) || null, decidido_por_nome: autor.nome, decidido_em: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'solicitada')
    .select('id')
    .maybeSingle()
  if (error) return { error: error.message }
  if (!decidido) return { error: 'Este pedido já foi decidido.' }

  if (decisao === 'aprovada') {
    const erro = await marcarFerias(admin, companyId, f.employee_id as string, f.data_inicio as string, f.dias as number)
    const erroRecibo = erro ? null : await gerarReciboFerias(admin, companyId, id, autor.nome)
    if (erroRecibo) await desmarcarFerias(admin, companyId, f.employee_id as string, f.data_inicio as string, f.dias as number)
    if (erro || erroRecibo) {
      await admin.from('employee_vacations').update({ status: 'solicitada', resposta: null, decidido_por_nome: null, decidido_em: null }).eq('id', id)
      return { error: (erro || erroRecibo) as string }
    }
  }
  const texto = resposta?.trim()
  await notificarFuncionario(admin, {
    companyId, employeeId: f.employee_id as string, autorId: autor.id, tipo: 'ferias',
    titulo: decisao === 'aprovada' ? 'Férias aprovadas' : 'Pedido de férias recusado',
    mensagem: `Seu pedido de ${periodoTexto(f.data_inicio as string, fimDasFerias(f.data_inicio as string, f.dias as number))} foi ${decisao}${texto ? `: ${texto}` : '.'}`,
    link: '/minhas-ferias',
  })
  revalidar()
  return { success: true as const }
}

/** Recibo de férias para baixar; férias aprovadas antes dos recibos próprios ganham o recibo agora */
export async function reciboFeriasAction(companyId: string, id: string): Promise<{ error: string } | { recibo: ReciboFerias; employee: { nome: string; cpf: string | null; cargo: string | null } }> {
  const autor = await gestor(companyId)
  if ('error' in autor) return autor
  const admin = createAdminClient()
  const { data: f } = await admin.from('employee_vacations').select('status, employees(nome, cpf, cargo)').eq('id', id).eq('company_id', companyId).maybeSingle()
  if (!f || (f.status ?? 'aprovada') !== 'aprovada') return { error: 'Só férias aprovadas têm recibo.' }
  let [recibo] = await getRecibos(admin, companyId, { tipo: 'ferias', referencia: id })
  if (!recibo) {
    const erro = await gerarReciboFerias(admin, companyId, id, autor.nome)
    if (erro) return { error: erro }
    ;[recibo] = await getRecibos(admin, companyId, { tipo: 'ferias', referencia: id })
    revalidar()
  }
  if (!recibo) return { error: 'Execute a migration 20261110000102 para gerar o recibo de férias.' }
  type Pessoa = { nome: string; cpf: string | null; cargo: string | null }
  const e = f.employees as unknown as Pessoa | Pessoa[] | null
  const employee = (Array.isArray(e) ? e[0] : e) ?? { nome: 'Funcionário', cpf: null, cargo: null }
  return { recibo: recibo.dados as ReciboFerias, employee }
}

/** Cancela férias aprovadas ou pedidas; os dias voltam a contar normalmente no ponto */
export async function cancelarFeriasAction(companyId: string, id: string) {
  const autor = await gestor(companyId)
  if ('error' in autor) return autor

  const admin = createAdminClient()
  const { data: f } = await admin.from('employee_vacations').select('employee_id, data_inicio, dias, status').eq('id', id).eq('company_id', companyId).maybeSingle()
  if (!f || (f.status !== 'aprovada' && f.status !== 'solicitada')) return { error: 'Estas férias não podem mais ser canceladas.' }

  if (f.status === 'aprovada') {
    const fechado = await mesFechado(admin, companyId, f.employee_id as string, f.data_inicio as string, f.dias as number)
    if (fechado) return { error: fechado }
    // O recibo sai primeiro: se o pagamento já foi baixado no caixa, nada é desfeito
    const erroRecibo = await removerReciboFerias(admin, companyId, id)
    if (erroRecibo) return { error: erroRecibo }
    const erro = await desmarcarFerias(admin, companyId, f.employee_id as string, f.data_inicio as string, f.dias as number)
    if (erro) return { error: erro }
  }
  const { error } = await admin.from('employee_vacations').update({ status: 'cancelada', decidido_por_nome: autor.nome, decidido_em: new Date().toISOString() }).eq('id', id)
  if (error) return { error: error.message }
  await notificarFuncionario(admin, {
    companyId, employeeId: f.employee_id as string, autorId: autor.id, tipo: 'ferias',
    titulo: f.status === 'aprovada' ? 'Férias canceladas' : 'Pedido de férias cancelado',
    mensagem: `A área de Pessoas cancelou ${f.status === 'aprovada' ? 'suas férias' : 'seu pedido'} de ${periodoTexto(f.data_inicio as string, fimDasFerias(f.data_inicio as string, f.dias as number))}. Os dias voltam ao saldo.`,
    link: '/minhas-ferias',
  })
  revalidar()
  return { success: true as const }
}
