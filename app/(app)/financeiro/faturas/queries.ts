import { createAdminClient } from '@/lib/supabase/server'

export type CardInvoice = {
  id: string
  company_id: string
  card_id: string
  mes_ano: string
  valor_total: number
  status: 'aberta' | 'fechada' | 'paga'
  data_vencimento: string | null
  data_pagamento: string | null
  created_at: string
  cartao: { nome: string; bandeira: string | null } | null
}

export async function getCardInvoices(companyId: string): Promise<CardInvoice[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('card_invoices')
    .select('*, cartao:card_id (nome, bandeira)')
    .eq('company_id', companyId)
    .order('mes_ano', { ascending: false })
    .order('card_id', { ascending: true })

  if (error) throw error
  return (data ?? []) as unknown as CardInvoice[]
}

export type InvoiceTransaction = {
  id: string
  descricao: string
  valor: number
  data_competencia: string
  status: string
  categoria: { nome: string; icone: string | null } | null
  contato: { nome: string } | null
}

export async function getInvoiceTransactions(
  companyId: string,
  cardId: string,
  mesAno: string,
): Promise<InvoiceTransaction[]> {
  const [ano, mes] = mesAno.split('-')
  const startDate = `${ano}-${mes}-01`
  const endDate = new Date(parseInt(ano), parseInt(mes), 0).toISOString().split('T')[0]

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('transactions')
    .select('id, descricao, valor, data_competencia, status, categoria:categoria_id (nome, icone), contato:contact_id (nome)')
    .eq('company_id', companyId)
    .eq('card_id', cardId)
    .gte('data_competencia', startDate)
    .lte('data_competencia', endDate)
    .order('data_competencia', { ascending: true })

  if (error) throw error
  return (data ?? []) as unknown as InvoiceTransaction[]
}
