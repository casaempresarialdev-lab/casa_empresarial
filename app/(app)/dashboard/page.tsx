import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/utils'
import { MetricCard } from '@/components/modules/dashboard/metric-card'
import { ModuleSection } from '@/components/modules/dashboard/module-section'
import { AlertList, type AlertItem } from '@/components/modules/dashboard/alert-list'

export const dynamic = 'force-dynamic'

function isoDate(d: Date) { return d.toISOString().split('T')[0] }

function offsetDate(days: number) {
  return isoDate(new Date(Date.now() + days * 86400000))
}

function startOfMonth() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]
}

function fmtDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR')
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const cookieStore = await cookies()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieCompanyId = cookieStore.get('active_company_id')?.value
  const admin = createAdminClient()

  const { data: memberships } = await admin
    .from('company_members')
    .select('company_id, role, companies(id, razao_social, nome_fantasia)')
    .eq('profile_id', user.id)
    .eq('status', 'active')

  type Company = { id: string; razao_social: string; nome_fantasia: string | null }
  type Membership = { company_id: string; role: string; companies: Company | Company[] | null }

  const rows = (memberships ?? []) as unknown as Membership[]
  const companies: Company[] = rows.flatMap(m => {
    const c = m.companies
    if (!c) return []
    return Array.isArray(c) ? c : [c]
  })

  if (companies.length === 0) {
    return (
      <div className="max-w-xl mx-auto mt-12 text-center">
        <div className="text-5xl mb-6">🏢</div>
        <h1 className="text-2xl font-bold mb-2"
          style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
          Bem-vindo ao Casa Empresarial!
        </h1>
        <p className="text-sm mb-8" style={{ color: 'var(--color-text-muted)' }}>
          Cadastre sua empresa para começar a usar o sistema.
        </p>
        <Link href="/empresa"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold"
          style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-darker)' }}>
          Cadastrar minha empresa →
        </Link>
      </div>
    )
  }

  const activeCompany = companies.find(c => c.id === cookieCompanyId) ?? companies[0]
  const companyId = activeCompany.id

  const today      = isoDate(new Date())
  const monthStart = startOfMonth()
  const in7d       = offsetDate(7)
  const in30d      = offsetDate(30)

  const [
    // Financeiro
    { data: bankAccounts },
    { data: receitasMes },
    { data: despesasMes },
    { count: vencidosCount },
    { data: transVencidas },
    // Pessoas
    { count: empAtivosCount },
    { count: empAdmissaoCount },
    { data: empFeriasAlert },
    { data: empExamesAlert },
    { data: empExpRaw },
    // Operacional
    { count: comprasAbertasCount },
    { count: vendasAbertasCount },
    { count: produtosCount },
  ] = await Promise.all([
    // Financeiro
    admin.from('bank_accounts').select('saldo_inicial')
      .eq('company_id', companyId).eq('ativo', true),
    admin.from('transactions').select('valor')
      .eq('company_id', companyId).eq('tipo', 'recebimento').eq('status', 'pago')
      .gte('data_competencia', monthStart),
    admin.from('transactions').select('valor')
      .eq('company_id', companyId).eq('tipo', 'pagamento').eq('status', 'pago')
      .gte('data_competencia', monthStart),
    admin.from('transactions').select('*', { count: 'exact', head: true })
      .eq('company_id', companyId).eq('status', 'pendente').lt('data_vencimento', today),
    admin.from('transactions').select('descricao, valor, tipo, data_vencimento')
      .eq('company_id', companyId).eq('status', 'pendente').lt('data_vencimento', today)
      .order('data_vencimento').limit(3),
    // Pessoas
    admin.from('employees').select('*', { count: 'exact', head: true })
      .eq('company_id', companyId).eq('status', 'ativo'),
    admin.from('employees').select('*', { count: 'exact', head: true })
      .eq('company_id', companyId).in('status', ['admissao', 'experiencia']),
    admin.from('employees').select('nome, vcto_ferias')
      .eq('company_id', companyId).eq('status', 'ativo')
      .not('vcto_ferias', 'is', null)
      .gte('vcto_ferias', today).lte('vcto_ferias', in30d)
      .order('vcto_ferias').limit(3),
    admin.from('employees').select('nome, exame_periodico')
      .eq('company_id', companyId).eq('status', 'ativo')
      .not('exame_periodico', 'is', null)
      .gte('exame_periodico', today).lte('exame_periodico', in30d)
      .order('exame_periodico').limit(3),
    admin.from('employees').select('nome, fim_experiencia_1, fim_experiencia_2')
      .eq('company_id', companyId).in('status', ['admissao', 'experiencia']).limit(20),
    // Operacional
    admin.from('purchase_orders').select('*', { count: 'exact', head: true })
      .eq('company_id', companyId).neq('status', 'recebido').neq('status', 'cancelado'),
    admin.from('sale_orders').select('*', { count: 'exact', head: true })
      .eq('company_id', companyId).neq('status', 'entregue').neq('status', 'cancelado'),
    admin.from('products').select('*', { count: 'exact', head: true })
      .eq('company_id', companyId),
  ])

  // Computações financeiras
  const saldoTotal    = (bankAccounts ?? []).reduce((s, a) => s + (a.saldo_inicial ?? 0), 0)
  const totalReceitas = (receitasMes ?? []).reduce((s, t) => s + (t.valor ?? 0), 0)
  const totalDespesas = (despesasMes ?? []).reduce((s, t) => s + (t.valor ?? 0), 0)
  const resultado     = totalReceitas - totalDespesas
  const vencidos      = vencidosCount ?? 0

  // Computações pessoas
  const empAtivos   = empAtivosCount ?? 0
  const empAdmissao = empAdmissaoCount ?? 0
  const feriasCount = (empFeriasAlert ?? []).length
  const examesCount = (empExamesAlert ?? []).length

  // Fim de experiência nos próximos 7 dias
  const expProximos = (empExpRaw ?? []).filter(e => {
    const fim = e.fim_experiencia_2 ?? e.fim_experiencia_1
    return fim && fim <= in7d
  })

  // Computações operacional
  const comprasAbertas = comprasAbertasCount ?? 0
  const vendasAbertas  = vendasAbertasCount ?? 0
  const totalProdutos  = produtosCount ?? 0
  const pedidosAbertos = comprasAbertas + vendasAbertas

  // Montar alertas ordenados por severidade
  const alerts: AlertItem[] = []

  // Transações vencidas (perigo — impacto financeiro direto)
  for (const t of transVencidas ?? []) {
    alerts.push({
      icon: t.tipo === 'pagamento' ? '🔴' : '🟡',
      text: `${t.descricao ?? 'Lançamento'} — ${formatCurrency(t.valor ?? 0)} · venceu em ${fmtDate(t.data_vencimento)}`,
      href: t.tipo === 'pagamento'
        ? '/financeiro/fluxo-de-caixa/pagamentos'
        : '/financeiro/fluxo-de-caixa/recebimentos',
      level: 'danger',
    })
  }

  // Fim de experiência próximo (perigo — prazo legal)
  for (const e of expProximos) {
    const fim = e.fim_experiencia_2 ?? e.fim_experiencia_1
    alerts.push({
      icon: '📋',
      text: `${e.nome} — fim de experiência em ${fmtDate(fim!)}`,
      href: '/pessoas/admissao',
      level: 'danger',
    })
  }

  // Exames periódicos nos próximos 30 dias (atenção)
  for (const e of empExamesAlert ?? []) {
    alerts.push({
      icon: '🩺',
      text: `${e.nome} — exame periódico em ${fmtDate(e.exame_periodico!)}`,
      href: '/pessoas/funcionarios',
      level: 'warning',
    })
  }

  // Férias vencendo nos próximos 30 dias (atenção)
  for (const e of empFeriasAlert ?? []) {
    alerts.push({
      icon: '🏖️',
      text: `${e.nome} — férias vencem em ${fmtDate(e.vcto_ferias!)}`,
      href: '/pessoas/funcionarios',
      level: 'warning',
    })
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5">

      {/* 4 KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Saldo Total"
          value={formatCurrency(saldoTotal)}
          subtitle="Soma das contas bancárias"
          icon="🏦"
          href="/financeiro/contas-cartoes"
          empty={saldoTotal === 0}
        />
        <MetricCard
          title="Receitas do Mês"
          value={formatCurrency(totalReceitas)}
          subtitle="Recebimentos confirmados"
          icon="📈"
          href="/financeiro/fluxo-de-caixa/recebimentos"
          accent="green"
          empty={totalReceitas === 0}
        />
        <MetricCard
          title="Funcionários Ativos"
          value={String(empAtivos)}
          subtitle={empAdmissao > 0 ? `+ ${empAdmissao} em admissão/experiência` : 'em dia'}
          icon="👥"
          href="/pessoas/funcionarios"
          empty={empAtivos === 0}
        />
        <MetricCard
          title="Pedidos Abertos"
          value={String(pedidosAbertos)}
          subtitle={pedidosAbertos > 0
            ? `${comprasAbertas} compra · ${vendasAbertas} venda`
            : 'Nenhum pendente'}
          icon="📦"
          href="/operacional/pedidos-compra"
          accent={pedidosAbertos > 0 ? 'blue' : 'default'}
          empty={pedidosAbertos === 0}
        />
      </div>

      {/* 3 seções por módulo */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ModuleSection
          icon="💰"
          title="FINANCEIRO"
          metrics={[
            { label: 'Receitas do mês',  value: formatCurrency(totalReceitas), accent: totalReceitas > 0 ? 'green' : undefined },
            { label: 'Despesas do mês',  value: formatCurrency(totalDespesas), accent: totalDespesas > 0 ? 'red'   : undefined },
            { label: 'Resultado',        value: formatCurrency(resultado),     accent: resultado >= 0 ? 'green' : 'red' },
            { label: 'Vencidos',         value: `${vencidos} lançamento${vencidos !== 1 ? 's' : ''}`, accent: vencidos > 0 ? 'red' : undefined },
          ]}
          href="/financeiro/fluxo-de-caixa"
          linkLabel="Ver fluxo de caixa"
        />
        <ModuleSection
          icon="👥"
          title="PESSOAS"
          metrics={[
            { label: 'Funcionários ativos',         value: empAtivos },
            { label: 'Em admissão / experiência',   value: empAdmissao,  accent: empAdmissao  > 0 ? 'yellow' : undefined },
            { label: 'Férias vencendo (30 dias)',    value: feriasCount,  accent: feriasCount  > 0 ? 'yellow' : undefined },
            { label: 'Exames periódicos (30 dias)',  value: examesCount,  accent: examesCount  > 0 ? 'yellow' : undefined },
          ]}
          href="/pessoas/funcionarios"
          linkLabel="Ver funcionários"
        />
        <ModuleSection
          icon="📦"
          title="OPERACIONAL"
          metrics={[
            { label: 'Compras em aberto', value: comprasAbertas, accent: comprasAbertas > 0 ? 'yellow' : undefined },
            { label: 'Vendas em aberto',  value: vendasAbertas,  accent: vendasAbertas  > 0 ? 'yellow' : undefined },
            { label: 'Total de produtos', value: totalProdutos },
          ]}
          href="/operacional/pedidos-compra"
          linkLabel="Ver pedidos"
        />
      </div>

      {/* Alertas consolidados */}
      <AlertList alerts={alerts} />

    </div>
  )
}
