import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { IndicadorCard } from '@/components/modules/dashboard/indicador-card'
import { ListCard, type ListItem } from '@/components/modules/dashboard/list-card'
import { exigirAcessoPagina } from '@/lib/auth/acesso'
import { getAllTransactions } from './fluxo-de-caixa/queries'
import { getBankAccounts } from './contas-cartoes/queries'
import { getCardInvoices } from './faturas/queries'

export const dynamic = 'force-dynamic'

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtDataBr(d: string) {
  const [y, m, day] = d.slice(0, 10).split('-')
  return `${day}/${m}/${y}`
}
function variacaoTexto(atual: number, anterior: number) {
  if (!anterior) return 'sem comparação com o mês anterior'
  const pct = Math.round(((atual - anterior) / anterior) * 100)
  return `${pct >= 0 ? '+' : ''}${pct}% vs mês anterior`
}

// Dashboard de Financeiro: saldo, entradas/saídas do mês, lançamentos pendentes e faturas em aberto
export default async function FinanceiroDashboardPage() {
  await exigirAcessoPagina('financeiro.dashboard')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const companyId = (await cookies()).get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  const [transactions, bankAccounts, invoices] = await Promise.all([
    getAllTransactions(companyId),
    getBankAccounts(companyId),
    getCardInvoices(companyId),
  ])

  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
  const mesAtual = hoje.slice(0, 7)
  const now = new Date()
  const mesAnteriorDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const mesAnterior = `${mesAnteriorDate.getFullYear()}-${String(mesAnteriorDate.getMonth() + 1).padStart(2, '0')}`

  const somaTipoMes = (tipo: 'recebimento' | 'pagamento', mes: string) =>
    transactions.filter((t) => t.tipo === tipo && t.data_competencia.slice(0, 7) === mes).reduce((s, t) => s + t.valor, 0)

  const entradasMes = somaTipoMes('recebimento', mesAtual)
  const entradasMesAnterior = somaTipoMes('recebimento', mesAnterior)
  const saidasMes = somaTipoMes('pagamento', mesAtual)
  const saidasMesAnterior = somaTipoMes('pagamento', mesAnterior)

  const contasAtivas = bankAccounts.filter((a) => a.ativo)
  const saldoEmContas = contasAtivas.reduce((s, a) => s + (a.saldo_atual ?? 0), 0)

  const pendentes = transactions.filter((t) => t.status === 'pendente')
  const vencidos = pendentes.filter((t) => t.data_vencimento && t.data_vencimento < hoje)
  const proximos = pendentes
    .filter((t) => !t.data_vencimento || t.data_vencimento >= hoje)
    .sort((a, b) => (a.data_vencimento ?? a.data_competencia).localeCompare(b.data_vencimento ?? b.data_competencia))

  const faturasAbertas = invoices.filter((i) => i.status === 'aberta' || i.status === 'fechada')

  const itensProximos: ListItem[] = proximos.slice(0, 6).map((t) => ({
    key: t.id,
    title: t.descricao,
    subtitle: fmtDataBr(t.data_vencimento ?? t.data_competencia),
    badge: { label: `${t.tipo === 'pagamento' ? '-' : ''}${formatBRL(t.valor)}`, tone: t.tipo === 'pagamento' ? 'red' : 'green' },
    href: '/financeiro/fluxo-de-caixa',
  }))

  const itensVencidos: ListItem[] = vencidos.slice(0, 6).map((t) => ({
    key: t.id,
    title: t.descricao,
    subtitle: `Venceu em ${fmtDataBr(t.data_vencimento!)}`,
    badge: { label: formatBRL(t.valor), tone: 'red' },
    href: '/financeiro/fluxo-de-caixa',
  }))

  const itensFaturas: ListItem[] = faturasAbertas.slice(0, 6).map((i) => ({
    key: i.id,
    title: i.cartao?.nome ?? 'Cartão',
    subtitle: i.status === 'aberta' ? 'Em aberto' : 'Fechada, aguardando pagamento',
    badge: { label: formatBRL(i.valor_total ?? 0), tone: i.status === 'fechada' ? 'amber' : 'brand' },
    href: '/financeiro/faturas',
  }))

  return (
    <div className="w-full">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>Financeiro</h1>
        <Breadcrumb />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <IndicadorCard
          icon="wallet" titulo="Saldo em contas" valor={formatBRL(saldoEmContas)} href="/financeiro/configuracoes" delay={100}
          detalhe={`${contasAtivas.length} ${contasAtivas.length === 1 ? 'conta ativa' : 'contas ativas'}`}
        />
        <IndicadorCard
          icon="check" titulo="Entradas no mês" valor={formatBRL(entradasMes)} href="/financeiro/fluxo-de-caixa/recebimentos" delay={160}
          detalhe={variacaoTexto(entradasMes, entradasMesAnterior)}
        />
        <IndicadorCard
          icon="card" titulo="Saídas no mês" valor={formatBRL(saidasMes)} href="/financeiro/fluxo-de-caixa/pagamentos" delay={220}
          detalhe={variacaoTexto(saidasMes, saidasMesAnterior)}
        />
        <IndicadorCard
          icon="alarm" titulo="Vencidos" valor={vencidos.length} tom={vencidos.length ? 'atencao' : 'ok'} href="/financeiro/fluxo-de-caixa" delay={280}
          detalhe={vencidos.length ? 'pendentes, já vencidos' : 'Nenhum vencido'}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <ListCard title="Próximos lançamentos" icon="wallet" href="/financeiro/fluxo-de-caixa" emptyText="Nenhum lançamento pendente." items={itensProximos} delay={340} />
        <ListCard title="Vencidos" icon="alarm" href="/financeiro/fluxo-de-caixa" emptyText="Nenhum lançamento vencido." items={itensVencidos} delay={400} />
        <ListCard title="Faturas de cartão em aberto" icon="card" href="/financeiro/faturas" emptyText="Nenhuma fatura em aberto." items={itensFaturas} delay={460} />
      </div>
    </div>
  )
}
