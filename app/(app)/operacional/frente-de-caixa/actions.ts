'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getCashSessionSummary, type CashSessionSummary } from './queries'

const PDV_COOKIE = 'pdv_session'
const PDV_COOKIE_MAX_AGE = 60 * 60 * 8 // 8h

type PdvSessionCookie = { cashSessionId: string }

export type PdvSaleItem = {
  product_id: string | null
  nome: string
  qtd: number
  preco_unitario: number
  subtotal: number
  tipo: 'produto' | 'servico'
}

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// Reautentica a senha do usuário logado e abre uma sessão de caixa
export async function openCashSessionAction(companyId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return { error: 'Não autenticado' }

  const senha = formData.get('senha') as string
  if (!senha) return { error: 'Informe a senha.' }

  const { error: authError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: senha,
  })
  if (authError) return { error: 'Senha incorreta.' }

  const saldoRaw = formData.get('saldo_abertura') as string
  const saldoAbertura = saldoRaw ? parseFloat(saldoRaw.replace(',', '.')) || 0 : 0

  const admin = createAdminClient()
  const { data: session, error } = await admin
    .from('cash_sessions')
    .insert({
      company_id: companyId,
      opened_by: user.id,
      saldo_abertura: saldoAbertura,
      status: 'aberta',
    })
    .select('id')
    .single()

  if (error || !session) return { error: error?.message ?? 'Erro ao abrir o caixa.' }

  const cookieStore = await cookies()
  const cookiePayload: PdvSessionCookie = { cashSessionId: session.id }
  cookieStore.set(PDV_COOKIE, JSON.stringify(cookiePayload), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/operacional/frente-de-caixa',
    maxAge: PDV_COOKIE_MAX_AGE,
  })

  return { success: true }
}

export async function fetchCashSessionSummaryAction(): Promise<CashSessionSummary | { error: string }> {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const cookieStore = await cookies()
  const raw = cookieStore.get(PDV_COOKIE)?.value
  if (!raw) return { error: 'Nenhum caixa aberto.' }

  let payload: PdvSessionCookie
  try { payload = JSON.parse(raw) } catch { return { error: 'Sessão de caixa inválida.' } }

  return getCashSessionSummary(payload.cashSessionId)
}

export async function closeCashSessionAction(saldoFechamento: number, observacao: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const cookieStore = await cookies()
  const raw = cookieStore.get(PDV_COOKIE)?.value
  if (!raw) return { error: 'Nenhum caixa aberto.' }

  let payload: PdvSessionCookie
  try { payload = JSON.parse(raw) } catch { return { error: 'Sessão de caixa inválida.' } }

  const admin = createAdminClient()
  const { error } = await admin
    .from('cash_sessions')
    .update({
      closed_at: new Date().toISOString(),
      saldo_fechamento: saldoFechamento,
      status: 'fechada',
      observacao: observacao || null,
    })
    .eq('id', payload.cashSessionId)

  if (error) return { error: error.message }

  cookieStore.set(PDV_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/operacional/frente-de-caixa',
    maxAge: 0,
  })

  revalidatePath('/operacional/frente-de-caixa')
  return { success: true }
}

export async function createPdvSaleAction(companyId: string, formData: FormData) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const cookieStore = await cookies()
  const raw = cookieStore.get(PDV_COOKIE)?.value
  if (!raw) return { error: 'Nenhum caixa aberto.' }

  let payload: PdvSessionCookie
  try { payload = JSON.parse(raw) } catch { return { error: 'Sessão de caixa inválida.' } }

  const admin = createAdminClient()

  const { data: session } = await admin
    .from('cash_sessions')
    .select('id, status')
    .eq('id', payload.cashSessionId)
    .single()

  if (!session || session.status !== 'aberta') return { error: 'Caixa não está aberto.' }

  const itensRaw = formData.get('itens') as string
  const itens: PdvSaleItem[] = itensRaw ? JSON.parse(itensRaw) : []
  if (itens.length === 0) return { error: 'Carrinho vazio.' }

  const descontoRaw = formData.get('desconto') as string
  const desconto = descontoRaw ? parseFloat(descontoRaw.replace(',', '.')) || 0 : 0
  const formaPagamento = formData.get('forma_pagamento') as string
  if (!formaPagamento) return { error: 'Selecione a forma de pagamento.' }

  const trocoRaw = formData.get('troco') as string
  const troco = trocoRaw ? parseFloat(trocoRaw.replace(',', '.')) || 0 : 0

  const clienteNome = (formData.get('cliente_nome') as string) || null

  // Valida estoque suficiente para os itens do tipo "produto"
  const produtoItens = itens.filter(i => i.tipo === 'produto' && i.product_id)
  const estoqueMap = new Map<string, { id: string; nome: string; estoque_atual: number }>()
  if (produtoItens.length > 0) {
    const ids = produtoItens.map(i => i.product_id as string)
    const { data: produtos } = await admin
      .from('products')
      .select('id, nome, estoque_atual')
      .in('id', ids)

    for (const p of produtos ?? []) estoqueMap.set(p.id, p)
    for (const item of produtoItens) {
      const p = estoqueMap.get(item.product_id as string)
      if (p && item.qtd > p.estoque_atual) {
        return { error: `Estoque insuficiente de "${p.nome}" (disponível: ${p.estoque_atual}).` }
      }
    }
  }

  const subtotal = itens.reduce((sum, i) => sum + i.subtotal, 0)
  const total = parseFloat(Math.max(0, subtotal - desconto).toFixed(2))

  const { error } = await admin.from('pdv_sales').insert({
    company_id: companyId,
    cash_session_id: payload.cashSessionId,
    cliente_nome: clienteNome,
    itens,
    subtotal,
    desconto,
    total,
    forma_pagamento: formaPagamento,
    troco,
  })

  if (error) return { error: error.message }

  // Baixa de estoque — só itens do tipo "produto"
  for (const item of produtoItens) {
    const p = estoqueMap.get(item.product_id as string)
    if (!p) continue
    await admin
      .from('products')
      .update({ estoque_atual: p.estoque_atual - item.qtd })
      .eq('id', item.product_id as string)
  }

  // Lançamento no financeiro — venda no PDV já é recebida na hora
  if (total > 0) {
    await admin.from('transactions').insert({
      company_id: companyId,
      tipo: 'recebimento',
      descricao: `Venda PDV${clienteNome ? ` — ${clienteNome}` : ''}`,
      valor: total,
      data_competencia: new Date().toISOString().slice(0, 10),
      status: 'pago',
      data_pagamento: new Date().toISOString().slice(0, 10),
      recorrente: 'false',
    })
  }

  revalidatePath('/operacional/frente-de-caixa')
  revalidatePath('/operacional/produtos')
  revalidatePath('/financeiro/fluxo-de-caixa')
  return { success: true, total, troco }
}
