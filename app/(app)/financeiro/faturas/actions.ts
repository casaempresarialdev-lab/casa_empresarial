'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function updateInvoiceStatusAction(
  invoiceId: string,
  status: 'aberta' | 'fechada' | 'paga',
  dataPagamento?: string,
) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const admin = createAdminClient()
  const { error } = await admin.from('card_invoices').update({
    status,
    data_pagamento: status === 'paga' ? (dataPagamento ?? new Date().toISOString().split('T')[0]) : null,
  }).eq('id', invoiceId)

  if (error) return { error: error.message }
  revalidatePath('/financeiro/faturas')
  return { success: true }
}

export async function syncInvoiceAction(companyId: string, cardId: string, mesAno: string) {
  const user = await getAuthUser()
  if (!user) return { error: 'Não autenticado' }

  const [ano, mes] = mesAno.split('-')
  const startDate = `${ano}-${mes}-01`
  const endDate = new Date(parseInt(ano), parseInt(mes), 0).toISOString().split('T')[0]

  const admin = createAdminClient()
  const { data: txs } = await admin
    .from('transactions')
    .select('valor')
    .eq('company_id', companyId)
    .eq('card_id', cardId)
    .gte('data_competencia', startDate)
    .lte('data_competencia', endDate)
    .neq('status', 'cancelado')

  const valorTotal = (txs ?? []).reduce((s: number, t: { valor: number }) => s + t.valor, 0)

  const { error } = await admin.from('card_invoices').upsert({
    company_id: companyId,
    card_id: cardId,
    mes_ano: mesAno,
    valor_total: valorTotal,
  }, { onConflict: 'card_id,mes_ano' })

  if (error) return { error: error.message }
  revalidatePath('/financeiro/faturas')
  return { success: true }
}
