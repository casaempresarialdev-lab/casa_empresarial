import { createAdminClient } from '@/lib/supabase/server'

export type CashSession = {
  id: string
  company_id: string
  opened_by: string
  opened_at: string
  closed_at: string | null
  saldo_abertura: number
  saldo_fechamento: number | null
  status: 'aberta' | 'fechada'
  observacao: string | null
}

export type PdvProduct = {
  id: string
  nome: string
  sku: string | null
  codigo_barras: string | null
  categoria: string | null
  tipo: 'produto' | 'servico'
  preco_venda: number | null
  estoque_atual: number
  unidade_medida: string
}

export async function getActiveCashSession(companyId: string, userId: string): Promise<CashSession | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('cash_sessions')
    .select('*')
    .eq('company_id', companyId)
    .eq('opened_by', userId)
    .eq('status', 'aberta')
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return null
  return data as CashSession | null
}

export async function getCashSessionById(cashSessionId: string): Promise<CashSession | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('cash_sessions')
    .select('*')
    .eq('id', cashSessionId)
    .maybeSingle()

  if (error) return null
  return data as CashSession | null
}

export async function getProductsForPDV(companyId: string): Promise<PdvProduct[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('products')
    .select('id, nome, sku, codigo_barras, categoria, tipo, preco_venda, estoque_atual, unidade_medida')
    .eq('company_id', companyId)
    .eq('ativo', true)
    .order('nome', { ascending: true })

  if (error) return []
  return (data ?? []) as PdvProduct[]
}

export type CashSessionSummary = {
  totalPorFormaPagamento: Record<string, number>
  totalGeral: number
  qtdVendas: number
}

export async function getCashSessionSummary(cashSessionId: string): Promise<CashSessionSummary> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('pdv_sales')
    .select('total, forma_pagamento')
    .eq('cash_session_id', cashSessionId)

  const vendas = (data ?? []) as { total: number; forma_pagamento: string }[]
  const totalPorFormaPagamento: Record<string, number> = {}
  let totalGeral = 0

  if (!error) {
    for (const v of vendas) {
      totalPorFormaPagamento[v.forma_pagamento] = (totalPorFormaPagamento[v.forma_pagamento] ?? 0) + v.total
      totalGeral += v.total
    }
  }

  return { totalPorFormaPagamento, totalGeral, qtdVendas: vendas.length }
}
