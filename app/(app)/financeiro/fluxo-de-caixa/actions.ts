'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

function parseMoney(v: string | null): number {
  if (!v) return 0
  return parseFloat(v.replace(/\./g, '').replace(',', '.')) || 0
}

function addPeriod(date: Date, tipo: string): Date {
  const d = new Date(date)
  switch (tipo) {
    case 'semanal':    d.setDate(d.getDate() + 7);          break
    case 'quinzenal':  d.setDate(d.getDate() + 15);         break
    case 'mensal':     d.setMonth(d.getMonth() + 1);        break
    case 'bimestral':  d.setMonth(d.getMonth() + 2);        break
    case 'trimestral': d.setMonth(d.getMonth() + 3);        break
    case 'semestral':  d.setMonth(d.getMonth() + 6);        break
    case 'anual':      d.setFullYear(d.getFullYear() + 1);  break
  }
  return d
}

function toISODate(d: Date): string {
  return d.toISOString().split('T')[0]
}

function generateSeriesDates(
  startDate: string,
  vencimentoDate: string | null,
  tipo: string,
  options: { count?: number; endDate?: string; infinite?: boolean },
): Array<{ data_competencia: string; data_vencimento: string | null }> {
  const start = new Date(startDate + 'T12:00:00Z')
  const vencOffset = vencimentoDate
    ? new Date(vencimentoDate + 'T12:00:00Z').getTime() - start.getTime()
    : null

  const dates: Array<{ data_competencia: string; data_vencimento: string | null }> = []
  let current = new Date(start)

  function push() {
    const comp = toISODate(current)
    const venc = vencOffset !== null
      ? toISODate(new Date(current.getTime() + vencOffset))
      : null
    dates.push({ data_competencia: comp, data_vencimento: venc })
  }

  if (options.count) {
    for (let i = 0; i < options.count; i++) {
      push()
      if (i < options.count - 1) current = addPeriod(current, tipo)
    }
  } else if (options.endDate) {
    const end = new Date(options.endDate + 'T12:00:00Z')
    while (current <= end) {
      push()
      current = addPeriod(current, tipo)
    }
  } else {
    // Infinito: gera 36 meses à frente
    const limit = new Date(start)
    limit.setMonth(limit.getMonth() + 36)
    while (current <= limit) {
      push()
      current = addPeriod(current, tipo)
    }
  }

  return dates
}

function parseBaseFields(formData: FormData) {
  return {
    descricao: formData.get('descricao') as string,
    tipo: formData.get('tipo') as string,
    valor: parseMoney(formData.get('valor') as string),
    data_competencia: formData.get('data_competencia') as string,
    data_vencimento: (formData.get('data_vencimento') as string) || null,
    data_pagamento: (formData.get('data_pagamento') as string) || null,
    status: (formData.get('status') as string) || 'pendente',
    categoria_id: (formData.get('categoria_id') as string) || null,
    account_id: (formData.get('account_id') as string) || null,
    card_id: (formData.get('card_id') as string) || null,
    cost_center_id: (formData.get('cost_center_id') as string) || null,
    contact_id: (formData.get('contact_id') as string) || null,
    detalhes: (formData.get('detalhes') as string) || null,
  }
}

export async function createTransactionAction(companyId: string, formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const fields = parseBaseFields(formData)
  if (!fields.descricao) return { error: 'Descrição é obrigatória.' }
  if (!fields.valor || fields.valor <= 0) return { error: 'Valor deve ser maior que zero.' }
  if (!fields.data_competencia) return { error: 'Data de competência é obrigatória.' }

  const recorrente = formData.get('recorrente') === 'true'
  const recorrenciaTipo = (formData.get('recorrencia_tipo') as string) || null
  const fimTipo = (formData.get('recorrencia_fim_tipo') as string) || 'infinito'
  const recorrenciaTotal = parseInt(formData.get('recorrencia_total') as string) || null
  const recorrenciaFim = (formData.get('recorrencia_fim') as string) || null

  const admin = createAdminClient()

  if (!recorrente || !recorrenciaTipo) {
    // Lançamento único
    const { error } = await admin.from('transactions').insert({
      company_id: companyId,
      ...fields,
      recorrente: false,
    })
    if (error) return { error: error.message }
  } else {
    // Gera série de recorrência
    let options: { count?: number; endDate?: string; infinite?: boolean } = {}
    if (fimTipo === 'parcelas' && recorrenciaTotal) {
      options = { count: recorrenciaTotal }
    } else if (fimTipo === 'data' && recorrenciaFim) {
      options = { endDate: recorrenciaFim }
    } else {
      options = { infinite: true }
    }

    const seriesDates = generateSeriesDates(
      fields.data_competencia,
      fields.data_vencimento,
      recorrenciaTipo,
      options,
    )
    const total = seriesDates.length

    // Insere o primeiro (parent)
    const { data: parent, error: parentErr } = await admin.from('transactions').insert({
      company_id: companyId,
      ...fields,
      data_competencia: seriesDates[0].data_competencia,
      data_vencimento: seriesDates[0].data_vencimento,
      recorrente: true,
      recorrencia_tipo: recorrenciaTipo,
      recorrencia_fim: fimTipo === 'data' ? recorrenciaFim : null,
      recorrencia_total: fimTipo === 'parcelas' ? recorrenciaTotal : null,
      parcela_numero: 1,
      parcela_total: fimTipo === 'parcelas' ? total : null,
      parent_id: null,
    }).select('id').single()

    if (parentErr || !parent) return { error: parentErr?.message ?? 'Erro ao criar série' }

    // Insere os demais em batch
    if (seriesDates.length > 1) {
      const children = seriesDates.slice(1).map((d, i) => ({
        company_id: companyId,
        ...fields,
        data_competencia: d.data_competencia,
        data_vencimento: d.data_vencimento,
        status: 'pendente' as const,     // filhos sempre pendentes
        data_pagamento: null,
        recorrente: true,
        recorrencia_tipo: recorrenciaTipo,
        recorrencia_fim: fimTipo === 'data' ? recorrenciaFim : null,
        recorrencia_total: fimTipo === 'parcelas' ? recorrenciaTotal : null,
        parcela_numero: i + 2,
        parcela_total: fimTipo === 'parcelas' ? total : null,
        parent_id: parent.id,
      }))

      const { error: childErr } = await admin.from('transactions').insert(children)
      if (childErr) return { error: childErr.message }
    }
  }

  revalidatePath('/financeiro/fluxo-de-caixa')
  revalidatePath('/financeiro/fluxo-de-caixa/recebimentos')
  revalidatePath('/financeiro/fluxo-de-caixa/pagamentos')
  return { success: true }
}

export async function updateTransactionAction(transactionId: string, formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const fields = parseBaseFields(formData)
  if (!fields.descricao) return { error: 'Descrição é obrigatória.' }
  if (!fields.valor || fields.valor <= 0) return { error: 'Valor deve ser maior que zero.' }

  const admin = createAdminClient()
  const { error } = await admin.from('transactions').update(fields).eq('id', transactionId)

  if (error) return { error: error.message }
  revalidatePath('/financeiro/fluxo-de-caixa')
  revalidatePath('/financeiro/fluxo-de-caixa/recebimentos')
  revalidatePath('/financeiro/fluxo-de-caixa/pagamentos')
  return { success: true }
}

export async function markAsPaidAction(transactionId: string, dataPagamento?: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const { error } = await admin.from('transactions').update({
    status: 'pago',
    data_pagamento: dataPagamento ?? new Date().toISOString().split('T')[0],
  }).eq('id', transactionId)

  if (error) return { error: error.message }
  revalidatePath('/financeiro/fluxo-de-caixa')
  revalidatePath('/financeiro/fluxo-de-caixa/recebimentos')
  revalidatePath('/financeiro/fluxo-de-caixa/pagamentos')
  return { success: true }
}

export async function markAsPendingAction(transactionId: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const { error } = await admin.from('transactions').update({
    status: 'pendente',
    data_pagamento: null,
  }).eq('id', transactionId)

  if (error) return { error: error.message }
  revalidatePath('/financeiro/fluxo-de-caixa')
  revalidatePath('/financeiro/fluxo-de-caixa/recebimentos')
  revalidatePath('/financeiro/fluxo-de-caixa/pagamentos')
  return { success: true }
}

export async function deleteTransactionAction(transactionId: string, mode: 'single' | 'following' | 'all') {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()

  if (mode === 'single') {
    const { error } = await admin.from('transactions').delete().eq('id', transactionId)
    if (error) return { error: error.message }
  } else {
    // Busca a transação para saber o parent e a data
    const { data: tx } = await admin
      .from('transactions')
      .select('parent_id, data_competencia, company_id')
      .eq('id', transactionId)
      .single()

    if (!tx) return { error: 'Lançamento não encontrado.' }

    const rootId = tx.parent_id ?? transactionId
    const companyId = tx.company_id

    if (mode === 'all') {
      // Deleta parent + todos os filhos
      await admin.from('transactions')
        .delete()
        .eq('company_id', companyId)
        .or(`id.eq.${rootId},parent_id.eq.${rootId}`)
    } else {
      // 'following': deleta este e os seguintes
      await admin.from('transactions')
        .delete()
        .eq('company_id', companyId)
        .or(`id.eq.${transactionId},parent_id.eq.${rootId}`)
        .gte('data_competencia', tx.data_competencia)
    }
  }

  revalidatePath('/financeiro/fluxo-de-caixa')
  revalidatePath('/financeiro/fluxo-de-caixa/recebimentos')
  revalidatePath('/financeiro/fluxo-de-caixa/pagamentos')
  return { success: true }
}
