import { createAdminClient } from '@/lib/supabase/server'
import { getAccountBalances } from '@/lib/finance/balances'

export type BankAccount = {
  id: string
  company_id: string
  banco: string
  agencia: string | null
  numero: string | null
  digito: string | null
  tipo: 'corrente' | 'poupanca' | 'pagamento' | 'investimento' | 'caixa' | null
  saldo_inicial: number
  saldo_atual: number
  ativo: boolean
  created_at: string
}

export type CreditCard = {
  id: string
  company_id: string
  nome: string
  bandeira: 'visa' | 'mastercard' | 'elo' | 'amex' | 'hipercard' | 'outro' | null
  limite: number | null
  dia_vencimento: number | null
  dia_fechamento: number | null
  ativo: boolean
  created_at: string
}

export async function getBankAccounts(companyId: string): Promise<BankAccount[]> {
  const admin = createAdminClient()
  const [{ data, error }, balances] = await Promise.all([
    admin
      .from('bank_accounts')
      .select('*')
      .eq('company_id', companyId)
      .order('banco', { ascending: true }),
    getAccountBalances(companyId),
  ])

  if (error) throw error
  // saldo_atual calculado a partir dos lançamentos quitados (a coluna do banco não é atualizada)
  return ((data ?? []) as BankAccount[]).map((a) => ({
    ...a,
    saldo_atual: balances.get(a.id)?.saldo ?? Number(a.saldo_inicial ?? 0),
  }))
}

export async function getCreditCards(companyId: string): Promise<CreditCard[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('credit_cards')
    .select('*')
    .eq('company_id', companyId)
    .order('nome', { ascending: true })

  if (error) throw error
  return (data ?? []) as CreditCard[]
}
