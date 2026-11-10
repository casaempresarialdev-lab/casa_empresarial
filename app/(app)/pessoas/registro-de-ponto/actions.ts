'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getViewerContext } from '@/lib/auth/viewer'
import { semAcesso } from '@/lib/auth/acesso'
import { mesclarBatidas, type Batida } from '@/lib/ponto'
import { notificarFuncionario, periodoTexto } from '@/lib/notificacoes'
import { horaParaTimestamp, horariosSchema } from '@/lib/validations/ponto'

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

function revalidarPonto() {
  revalidatePath('/pessoas/registro-de-ponto')
  revalidatePath('/meu-ponto')
  revalidatePath('/dashboard')
}

async function nomeDoUsuario(userId: string) {
  const { data } = await createAdminClient().from('profiles').select('name').eq('id', userId).maybeSingle()
  return (data?.name as string | undefined) ?? 'Usuário'
}

/** O lançamento do gestor vale para o dia: o pedido em análise deixa de fazer sentido e é encerrado */
async function encerrarAjusteDoDia(companyId: string, employeeId: string, data: string, userId: string) {
  const admin = createAdminClient()
  const { data: encerrados, error } = await admin
    .from('time_adjustments')
    .update({
      status: 'recusado',
      resposta: 'O responsável lançou o ponto deste dia diretamente.',
      decidido_por: userId,
      decidido_por_nome: await nomeDoUsuario(userId),
      decidido_em: new Date().toISOString(),
    })
    .eq('company_id', companyId)
    .eq('employee_id', employeeId)
    .eq('data', data)
    .eq('status', 'pendente')
    .select('id')
  if (error) console.error('[ponto] ajuste não encerrado:', error.message)
  if (encerrados?.length) {
    await notificarFuncionario(admin, {
      companyId, employeeId, autorId: userId, tipo: 'ponto',
      titulo: 'Ajuste de ponto encerrado', mensagem: `O responsável lançou o seu ponto de ${periodoTexto(data, data)} diretamente.`, link: '/meu-ponto',
    })
  }
}

/** Campos do lançamento; os horários vêm "08:00" e viram horário de Brasília no dia informado */
function parsePontoFields(formData: FormData) {
  const data = formData.get('data') as string
  let lista: unknown = null
  try { lista = JSON.parse(String(formData.get('batidas') ?? '[]')) } catch { /* cai na validação abaixo */ }
  const parsed = horariosSchema.safeParse(lista)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  return {
    horarios: parsed.data.map((h) => horaParaTimestamp(data, h) as string),
    campos: {
      employee_id: formData.get('employee_id') as string,
      data,
      tipo:        (formData.get('tipo') as string) || 'normal',
      observacao:  (formData.get('observacao') as string) || null,
    },
  }
}

/** Aprova (o ponto muda para os horários propostos) ou recusa um pedido de ajuste */
export async function decidirAjusteAction(companyId: string, id: string, decisao: 'aprovado' | 'recusado', resposta?: string) {
  const negado = await semAcesso('pessoas.registro-de-ponto', companyId)
  if (negado) return negado

  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }
  const viewer = await getViewerContext(companyId)
  if (viewer?.isColaborador) return { error: 'Sem permissão para esta ação.' }
  if (decisao !== 'aprovado' && decisao !== 'recusado') return { error: 'Decisão inválida.' }

  const admin = createAdminClient()

  // Marca primeiro: dois cliques, ou duas pessoas, não aplicam o mesmo ajuste
  const { data: ajuste, error } = await admin
    .from('time_adjustments')
    .update({
      status: decisao,
      resposta: resposta?.trim().slice(0, 500) || null,
      decidido_por: user.id,
      decidido_por_nome: await nomeDoUsuario(user.id),
      decidido_em: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('company_id', companyId)
    .eq('status', 'pendente')
    .select('employee_id, data, batidas')
    .maybeSingle()
  if (error) return { error: error.message }
  if (!ajuste) return { error: 'Este ajuste já foi decidido.' }

  if (decisao === 'aprovado') {
    const { data: registro } = await admin
      .from('time_records')
      .select('id, batidas')
      .eq('company_id', companyId)
      .eq('employee_id', ajuste.employee_id)
      .eq('data', ajuste.data)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const batidas = mesclarBatidas((registro?.batidas ?? []) as Batida[], ajuste.batidas as string[])
    const { error: errAplicar } = registro
      ? await admin.from('time_records').update({ batidas }).eq('id', registro.id)
      : await admin.from('time_records').insert({ company_id: companyId, employee_id: ajuste.employee_id, data: ajuste.data, tipo: 'normal', batidas })
    if (errAplicar) {
      // Não conseguiu alterar o ponto: o pedido volta para a fila
      await admin.from('time_adjustments').update({ status: 'pendente', decidido_por: null, decidido_por_nome: null, decidido_em: null }).eq('id', id)
      return { error: errAplicar.message }
    }
  }

  const texto = resposta?.trim()
  await notificarFuncionario(admin, {
    companyId, employeeId: ajuste.employee_id as string, autorId: user.id, tipo: 'ponto',
    titulo: decisao === 'aprovado' ? 'Ajuste de ponto aprovado' : 'Ajuste de ponto recusado',
    mensagem: `Seu pedido para ${periodoTexto(ajuste.data as string, ajuste.data as string)} foi ${decisao}${texto ? `: ${texto}` : '.'}`,
    link: '/meu-ponto',
  })

  revalidarPonto()
  return { success: true as const }
}

export async function createTimeRecordAction(companyId: string, formData: FormData) {
  const negado = await semAcesso('pessoas.registro-de-ponto', companyId)
  if (negado) return negado

  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const viewer = await getViewerContext(companyId)
  if (viewer?.isColaborador) return { error: 'Sem permissão para esta ação.' }

  const lancamento = parsePontoFields(formData)
  if ('error' in lancamento) return { error: lancamento.error }
  const fields = lancamento.campos
  if (!fields.employee_id) return { error: 'Selecione um funcionário.' }
  if (!fields.data) return { error: 'Data é obrigatória.' }

  const admin = createAdminClient()
  const { data: funcionario } = await admin.from('employees').select('id').eq('id', fields.employee_id).eq('company_id', companyId).maybeSingle()
  if (!funcionario) return { error: 'Funcionário não encontrado.' }

  // Um registro por pessoa e dia: o lançamento feito aqui substitui o que foi batido
  // (a tabela não garante um registro por dia: atualiza o mais recente, se houver, em vez de depender disso)
  const { data: existente } = await admin
    .from('time_records')
    .select('id, batidas')
    .eq('company_id', companyId)
    .eq('employee_id', fields.employee_id)
    .eq('data', fields.data)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const batidas = mesclarBatidas((existente?.batidas ?? []) as Batida[], lancamento.horarios)
  const { error } = existente
    ? await admin.from('time_records').update({ ...fields, batidas }).eq('id', existente.id)
    : await admin.from('time_records').insert({ company_id: companyId, ...fields, batidas })
  if (error) return { error: error.message }

  await encerrarAjusteDoDia(companyId, fields.employee_id, fields.data, user.id)
  revalidarPonto()
  return { success: true }
}

export async function updateTimeRecordAction(recordId: string, formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()

  const { data: current } = await admin.from('time_records').select('company_id, employee_id, data, batidas').eq('id', recordId).single()
  if (!current) return { error: 'Registro não encontrado.' }

  const negado = await semAcesso('pessoas.registro-de-ponto', current.company_id)
  if (negado) return negado
  const viewer = await getViewerContext(current.company_id)
  if (viewer?.isColaborador) return { error: 'Sem permissão para esta ação.' }

  // A edição corrige o dia do registro: pessoa e data não mudam
  const { employee_id, data } = current
  formData.set('data', data)
  const lancamento = parsePontoFields(formData)
  if ('error' in lancamento) return { error: lancamento.error }
  const batidas = mesclarBatidas((current.batidas ?? []) as Batida[], lancamento.horarios)
  const { error } = await admin.from('time_records').update({ ...lancamento.campos, employee_id, data, batidas }).eq('id', recordId)
  if (error) return { error: error.message }

  await encerrarAjusteDoDia(current.company_id, employee_id, data, user.id)
  revalidarPonto()
  return { success: true }
}

export async function deleteTimeRecordAction(recordId: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()

  const { data: current } = await admin.from('time_records').select('company_id').eq('id', recordId).single()
  if (!current) return { error: 'Registro não encontrado.' }

  const negado = await semAcesso('pessoas.registro-de-ponto', current.company_id)
  if (negado) return negado
  const viewer = await getViewerContext(current.company_id)
  if (viewer?.isColaborador) return { error: 'Sem permissão para esta ação.' }

  const { error } = await admin.from('time_records').delete().eq('id', recordId)

  if (error) return { error: error.message }
  revalidarPonto()
  return { success: true }
}
