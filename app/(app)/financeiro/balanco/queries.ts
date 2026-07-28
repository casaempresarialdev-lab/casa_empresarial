import { createAdminClient } from '@/lib/supabase/server'

export type BPTipo =
  | 'ativo_circulante'
  | 'ativo_nao_circulante'
  | 'passivo_circulante'
  | 'passivo_nao_circulante'
  | 'pl'

export type BPLancamento = {
  id: string
  tipo: BPTipo
  descricao: string
  valor: number
}

export type BPData = {
  caixa: number              // soma dos saldos das contas ativas
  contas_receber: number     // tx pendente receita com vencimento <= dataBase
  contas_pagar: number       // tx pendente despesa com vencimento <= dataBase
  resultado_exercicio: number // pago/conciliado receitas - despesas no exercício até dataBase
  lancamentos: BPLancamento[]
}

export async function getBPData(
  companyId: string,
  dataBase: string,        // ex: '2026-07-31'
  inicioExercicio: string, // ex: '2026-01-01'
): Promise<BPData> {
  const admin = createAdminClient()

  const [contasRes, txRes, lancamentosRes] = await Promise.all([
    admin
      .from('bank_accounts')
      .select('saldo_atual')
      .eq('company_id', companyId)
      .eq('ativo', true),

    admin
      .from('transactions')
      .select('tipo, valor, status, data_vencimento, data_competencia')
      .eq('company_id', companyId),

    admin
      .from('bp_lancamentos')
      .select('id, tipo, descricao, valor')
      .eq('company_id', companyId)
      .order('tipo')
      .order('descricao'),
  ])

  if (contasRes.error) throw contasRes.error
  if (txRes.error) throw txRes.error
  if (lancamentosRes.error) throw lancamentosRes.error

  const caixa = (contasRes.data ?? []).reduce((s, c) => s + (c.saldo_atual ?? 0), 0)

  let contasReceber = 0
  let contasPagar = 0
  let receitasRealizadas = 0
  let despesasRealizadas = 0

  for (const tx of txRes.data ?? []) {
    const venc = tx.data_vencimento as string | null
    const comp = tx.data_competencia as string | null

    if (tx.status === 'pendente' && tx.tipo === 'receita' && venc && venc <= dataBase) {
      contasReceber += tx.valor as number
    }

    if (tx.status === 'pendente' && tx.tipo === 'despesa' && venc && venc <= dataBase) {
      contasPagar += tx.valor as number
    }

    if (
      (tx.status === 'pago' || tx.status === 'conciliado') &&
      comp && comp >= inicioExercicio && comp <= dataBase
    ) {
      if (tx.tipo === 'receita') receitasRealizadas += tx.valor as number
      else despesasRealizadas += tx.valor as number
    }
  }

  return {
    caixa,
    contas_receber: contasReceber,
    contas_pagar:   contasPagar,
    resultado_exercicio: receitasRealizadas - despesasRealizadas,
    lancamentos: (lancamentosRes.data ?? []) as BPLancamento[],
  }
}
