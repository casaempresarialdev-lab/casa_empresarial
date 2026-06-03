import { createAdminClient } from '@/lib/supabase/server'

export type TransactionRow = {
  id: string
  company_id: string
  descricao: string
  tipo: 'pagamento' | 'recebimento'
  valor: number
  data_competencia: string
  data_vencimento: string | null
  data_pagamento: string | null
  status: 'pendente' | 'pago' | 'cancelado' | 'conciliado'
  detalhes: string | null
  categoria_id: string | null
  account_id: string | null
  card_id: string | null
  cost_center_id: string | null
  contact_id: string | null
  recorrente: boolean
  recorrencia_tipo: string | null
  recorrencia_fim: string | null
  recorrencia_total: number | null
  parcela_numero: number | null
  parcela_total: number | null
  parent_id: string | null
  created_at: string
  // joins
  categoria: { nome: string; cor: string | null; icone: string | null } | null
  contato: { nome: string } | null
  conta: { banco: string } | null
  cartao: { nome: string } | null
  centro_custo: { nome: string } | null
}

const SELECT = `
  *,
  categoria:categoria_id (nome, cor, icone),
  contato:contact_id (nome),
  conta:account_id (banco),
  cartao:card_id (nome),
  centro_custo:cost_center_id (nome)
`

export async function getTransactionsByPeriod(
  companyId: string,
  startDate: string,
  endDate: string,
): Promise<TransactionRow[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('transactions')
    .select(SELECT)
    .eq('company_id', companyId)
    .gte('data_competencia', startDate)
    .lte('data_competencia', endDate)
    .order('data_vencimento', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as unknown as TransactionRow[]
}

export async function getAllTransactions(
  companyId: string,
  tipo?: 'pagamento' | 'recebimento',
): Promise<TransactionRow[]> {
  const admin = createAdminClient()
  let query = admin
    .from('transactions')
    .select(SELECT)
    .eq('company_id', companyId)
    .order('data_vencimento', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (tipo) query = query.eq('tipo', tipo)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as unknown as TransactionRow[]
}
