import { createAdminClient } from '@/lib/supabase/server'
import { fetchAll } from '@/lib/supabase/fetch-all'

// Lançamentos que já movimentaram a conta
const SETTLED_STATUSES = ['pago', 'conciliado']

export type AccountBalance = {
  /** Saldo atual: saldo_inicial + recebimentos − pagamentos quitados */
  saldo: number
  /** Movimentação líquida quitada a partir de `since` (inclusive) */
  movimentoDesde: number
}

/**
 * Saldo real por conta bancária, calculado a partir dos lançamentos quitados.
 * O campo bank_accounts.saldo_atual não é atualizado pelos lançamentos (não há trigger),
 * então não deve ser usado como saldo.
 *
 * @param since data ISO (yyyy-mm-dd) para calcular a movimentação do período (ex.: início do mês)
 */
export async function getAccountBalances(
  companyId: string,
  since?: string,
): Promise<Map<string, AccountBalance>> {
  const admin = createAdminClient()

  const [accountsRes, transactions] = await Promise.all([
    admin.from('bank_accounts').select('id, saldo_inicial').eq('company_id', companyId),
    fetchAll((from, to) =>
      admin
        .from('transactions')
        .select('account_id, tipo, valor, data_pagamento, data_competencia')
        .eq('company_id', companyId)
        .in('status', SETTLED_STATUSES)
        .not('account_id', 'is', null)
        .order('id')
        .range(from, to),
    ),
  ])

  if (accountsRes.error) throw accountsRes.error

  const balances = new Map<string, AccountBalance>()
  for (const a of accountsRes.data ?? []) {
    balances.set(a.id, { saldo: Number(a.saldo_inicial ?? 0), movimentoDesde: 0 })
  }

  for (const tx of transactions) {
    const b = balances.get(tx.account_id)
    if (!b) continue
    const valor = Number(tx.valor ?? 0)
    const delta = tx.tipo === 'recebimento' ? valor : -valor
    b.saldo += delta
    const data = tx.data_pagamento ?? tx.data_competencia
    if (since && data && data >= since) b.movimentoDesde += delta
  }

  return balances
}
