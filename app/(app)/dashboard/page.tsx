import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { SummaryCard } from '@/components/modules/dashboard/summary-card'
import { Icon } from '@/components/ui/icon'
import { StatCard } from '@/components/modules/dashboard/stat-card'
import { UpcomingPayments, type UpcomingPayment } from '@/components/modules/dashboard/upcoming-payments'
import { EmployeesList, type EmployeeRow } from '@/components/modules/dashboard/employees-list'
import { OpenReceivables, type OpenReceivable } from '@/components/modules/dashboard/open-receivables'
import { DocumentsValidity, type DocumentValidity } from '@/components/modules/dashboard/documents-validity'
import { ScheduledPosts, type ScheduledPost } from '@/components/modules/dashboard/scheduled-posts'
import { getAccountBalances } from '@/lib/finance/balances'
import { fetchAll } from '@/lib/supabase/fetch-all'
import { Welcome } from '@/components/modules/dashboard/welcome'
import { IntroProvider } from '@/components/modules/dashboard/intro'

export const dynamic = 'force-dynamic'

function isoDate(d: Date) { return d.toISOString().split('T')[0] }

// Pedido de venda ainda não entregue nem cancelado
const SALE_ORDER_OPEN_STATUSES = ['rascunho', 'confirmado', 'em_producao', 'enviado']

function offsetDate(days: number) {
  return isoDate(new Date(Date.now() + days * 86400000))
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const cookieStore = await cookies()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieCompanyId = cookieStore.get('active_company_id')?.value
  const admin = createAdminClient()

  const [{ data: memberships }, { data: profile }] = await Promise.all([
    admin
      .from('company_members')
      .select('company_id, role, companies(id, razao_social, nome_fantasia)')
      .eq('profile_id', user.id)
      .eq('status', 'active'),
    admin.from('profiles').select('name').eq('id', user.id).single(),
  ])
  // Primeiro nome para a saudação
  const firstName = profile?.name?.trim().split(/\s+/)[0] || null

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

  // Datas no fuso do Brasil (o servidor roda em UTC)
  const today     = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
  const in30d     = offsetDate(30)
  const [ano, mes] = today.split('-').map(Number)
  const inicioMes = `${today.slice(0, 7)}-01`
  const fimMes    = isoDate(new Date(Date.UTC(ano, mes, 0)))

  const [
    // Administrativo — Documentação
    { count: docsVencidosCount },
    { count: docsVencendoCount },
    // Financeiro
    { data: bankAccounts },
    balances,
    { data: pagamentosPendentes },
    // Pessoas — vencimentos e lista
    { data: empDatas },
    { data: empLista },
    { data: convitesPendentes },
    // Pessoas
    { count: empAtivosCount },
    // Operacional
    { count: osAbertasCount },
    { count: vendasAbertasCount },
    // Marketing
    { count: publicacoesMesCount },
    // Seções detalhadas — Operacional, Administrativo e Marketing
    { data: vendasAbertas },
    recebimentosPendentes,
    { data: documentos },
    { data: postagens },
  ] = await Promise.all([
    // Administrativo — Documentação
    admin.from('documents').select('*', { count: 'exact', head: true })
      .eq('company_id', companyId).not('vencimento', 'is', null).lt('vencimento', today),
    admin.from('documents').select('*', { count: 'exact', head: true })
      .eq('company_id', companyId).not('vencimento', 'is', null)
      .gte('vencimento', today).lte('vencimento', in30d),
    // Financeiro
    admin.from('bank_accounts').select('id')
      .eq('company_id', companyId).eq('ativo', true),
    getAccountBalances(companyId, inicioMes),
    admin.from('transactions').select('id, descricao, valor, data_vencimento, contacts(nome)')
      .eq('company_id', companyId).eq('tipo', 'pagamento').eq('status', 'pendente')
      .order('data_vencimento', { ascending: true, nullsFirst: false })
      .limit(5),
    // Pessoas — vencimentos e lista
    admin.from('employees')
      .select('id, vcto_ferias, exame_periodico, fim_experiencia_1, fim_experiencia_2, data_experiencia_fim')
      .eq('company_id', companyId).not('status', 'in', '(inativo,demitido)'),
    admin.from('employees').select('id, nome, cargo, status')
      .eq('company_id', companyId).not('status', 'in', '(inativo,demitido)')
      .order('nome').limit(5),
    admin.from('invitations').select('employee_id')
      .eq('company_id', companyId).eq('status', 'pending')
      .gt('expires_at', new Date().toISOString()).not('employee_id', 'is', null),
    // Pessoas
    admin.from('employees').select('*', { count: 'exact', head: true })
      .eq('company_id', companyId).eq('status', 'ativo'),
    // Operacional
    admin.from('service_orders').select('*', { count: 'exact', head: true })
      .eq('company_id', companyId).eq('status', 'aberta'),
    admin.from('sale_orders').select('*', { count: 'exact', head: true })
      .eq('company_id', companyId).neq('status', 'entregue').neq('status', 'cancelado'),
    // Marketing
    admin.from('editorial_calendar').select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .gte('data_publicacao', inicioMes).lte('data_publicacao', fimMes),
    // Seções detalhadas — Operacional, Administrativo e Marketing
    admin.from('sale_orders').select('valor_total')
      .eq('company_id', companyId).in('status', SALE_ORDER_OPEN_STATUSES),
    fetchAll((from, to) =>
      admin.from('transactions').select('contact_id, valor, data_vencimento, contacts(nome)')
        .eq('company_id', companyId).eq('tipo', 'recebimento').eq('status', 'pendente')
        .not('contact_id', 'is', null)
        .order('id').range(from, to),
    ),
    admin.from('documents').select('id, nome, descricao, vencimento')
      .eq('company_id', companyId)
      .order('vencimento', { ascending: true, nullsFirst: false })
      .limit(5),
    admin.from('editorial_calendar').select('id, titulo, plataforma, data_publicacao, status')
      .eq('company_id', companyId).neq('status', 'publicado')
      .gte('data_publicacao', today)
      .order('data_publicacao').limit(5),
  ])

  // Administrativo: vencidos + vencendo em 30 dias
  const docsVencidos = docsVencidosCount ?? 0
  const atencao      = docsVencidos + (docsVencendoCount ?? 0)

  // Operacional: pedidos de venda em aberto e o valor somado
  const qtdVendasAbertas  = (vendasAbertas ?? []).length
  const valorVendasAbertas = (vendasAbertas ?? []).reduce((s, v) => s + Number(v.valor_total ?? 0), 0)

  // Clientes com recebimentos pendentes, agrupados (maiores valores primeiro)
  type RecebimentoRow = { contact_id: string; valor: number; data_vencimento: string | null; contacts: { nome: string } | { nome: string }[] | null }
  const porCliente = new Map<string, OpenReceivable>()
  for (const r of recebimentosPendentes as unknown as RecebimentoRow[]) {
    const contato = Array.isArray(r.contacts) ? r.contacts[0] : r.contacts
    const c = porCliente.get(r.contact_id) ?? { contactId: r.contact_id, nome: contato?.nome ?? 'Cliente', parcelas: 0, vencidas: 0, total: 0 }
    c.parcelas += 1
    c.total += Number(r.valor ?? 0)
    if (r.data_vencimento && r.data_vencimento < today) c.vencidas += 1
    porCliente.set(r.contact_id, c)
  }
  const clientesEmAberto = [...porCliente.values()].sort((a, b) => b.total - a.total).slice(0, 5)

  const docsValidade: DocumentValidity[] = (documentos ?? []).map((d) => ({
    id: d.id, nome: d.descricao || d.nome, vencimento: d.vencimento,
  }))

  // Financeiro: saldo calculado a partir dos lançamentos quitados (lib/finance/balances.ts)
  const contasAtivas = bankAccounts ?? []
  const saldoTotal   = contasAtivas.reduce((s, a) => s + (balances.get(a.id)?.saldo ?? 0), 0)
  const movimentoMes = contasAtivas.reduce((s, a) => s + (balances.get(a.id)?.movimentoDesde ?? 0), 0)
  const saldoInicioMes = saldoTotal - movimentoMes
  const variacaoMes  = saldoInicioMes !== 0 ? (movimentoMes / Math.abs(saldoInicioMes)) * 100 : null
  const sinal        = movimentoMes > 0 ? '+' : movimentoMes < 0 ? '−' : ''
  const variacaoLabel =
    movimentoMes === 0 ? 'sem movimentação no mês'
    : variacaoMes !== null ? `${sinal}${Math.abs(variacaoMes).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% no mês`
    : `${sinal}${formatCurrency(Math.abs(movimentoMes))} no mês`

  type PagamentoRow = { id: string; descricao: string; valor: number; data_vencimento: string | null; contacts: { nome: string } | { nome: string }[] | null }
  const pagamentos: UpcomingPayment[] = ((pagamentosPendentes ?? []) as unknown as PagamentoRow[]).map((p) => {
    const c = Array.isArray(p.contacts) ? p.contacts[0] : p.contacts
    return { id: p.id, descricao: p.descricao, valor: Number(p.valor), data_vencimento: p.data_vencimento, contato: c?.nome ?? null }
  })

  // Pessoas: quem tem férias, exame periódico ou fim de experiência nos próximos 15 dias
  const in15d = isoDate(new Date(Date.UTC(ano, mes - 1, Number(today.slice(8, 10)) + 15)))
  const DATAS_VENCIMENTO = ['vcto_ferias', 'exame_periodico', 'fim_experiencia_1', 'fim_experiencia_2', 'data_experiencia_fim'] as const
  const pessoasVencendo = (empDatas ?? []).filter((e) =>
    DATAS_VENCIMENTO.some((k) => {
      const d = e[k] as string | null
      return d && d >= today && d <= in15d
    }),
  ).length

  const comConvite = new Set((convitesPendentes ?? []).map((c) => c.employee_id as string))
  const funcionarios: EmployeeRow[] = (empLista ?? []).map((e) => ({
    id: e.id, nome: e.nome, cargo: e.cargo, status: e.status, convitePendente: comConvite.has(e.id),
  }))

  const empAtivos    = empAtivosCount ?? 0
  const emAndamento  = (osAbertasCount ?? 0) + (vendasAbertasCount ?? 0)
  const publicacoes  = publicacoesMesCount ?? 0

  return (
    <IntroProvider play={cookieStore.get('play_intro')?.value === '1'}>
      <Welcome firstName={firstName} />

      <section>
        <h2
          className="animate-enter flex items-center gap-2 text-lg font-bold mb-4"
          style={{ fontFamily: 'Manrope', color: 'var(--color-brand)', animationDelay: '100ms' }}
        >
          <Icon name="grid" />
          Sua casa hoje
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <SummaryCard
            icon="file"
            title="Administrativo"
            delay={200}
            value={atencao}
            caption={atencao === 1 ? 'item pedindo atenção' : 'itens pedindo atenção'}
            accent={docsVencidos > 0 ? 'red' : atencao > 0 ? 'yellow' : undefined}
            href="/admin/documentacao"
            linkLabel="Ver documentação"
          />
          <SummaryCard
            icon="dollar"
            title="Financeiro"
            delay={280}
            value={formatCurrency(saldoTotal)}
            caption="saldo atual em conta"
            accent={saldoTotal < 0 ? 'red' : undefined}
            href="/financeiro/fluxo-de-caixa"
            linkLabel="Ver fluxo de caixa"
          />
          <SummaryCard
            icon="users"
            title="Pessoas"
            delay={360}
            value={empAtivos}
            caption={empAtivos === 1 ? 'pessoa na equipe' : 'pessoas na equipe'}
            href="/pessoas/funcionarios"
            linkLabel="Ver equipe"
          />
          <SummaryCard
            icon="briefcase"
            title="Operacional"
            delay={440}
            value={emAndamento}
            caption="OS e pedidos em andamento"
            href="/operacional/ordens-de-servico"
            linkLabel="Ver ordens de serviço"
          />
          <SummaryCard
            icon="megaphone"
            title="Marketing"
            delay={520}
            value={publicacoes}
            caption={publicacoes === 1 ? 'publicação neste mês' : 'publicações neste mês'}
            href="/marketing/calendario"
            linkLabel="Ver calendário"
          />
        </div>
      </section>

      <section className="mt-8">
        <h2
          className="animate-enter flex items-center gap-2 text-lg font-bold mb-4"
          style={{ fontFamily: 'Manrope', color: 'var(--color-brand)', animationDelay: '600ms' }}
        >
          <Icon name="wallet" />
          Financeiro
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
            <StatCard
              title="Saldo em conta"
              value={formatCurrency(saldoTotal)}
              caption={variacaoLabel}
              captionTone={movimentoMes > 0 ? 'positive' : movimentoMes < 0 ? 'negative' : undefined}
              href="/financeiro/contas-cartoes"
              delay={680}
            />
            <StatCard
              title="Contas bancárias"
              value={`${contasAtivas.length} ${contasAtivas.length === 1 ? 'conta' : 'contas'}`}
              caption={`${formatCurrency(saldoTotal)} no total`}
              href="/financeiro/contas-cartoes"
              delay={760}
            />
          </div>
          <div className="lg:col-span-2">
            <UpcomingPayments payments={pagamentos} today={today} delay={840} />
          </div>
        </div>
      </section>

      <section className="mt-8">
        <h2
          className="animate-enter flex items-center gap-2 text-lg font-bold mb-4"
          style={{ fontFamily: 'Manrope', color: 'var(--color-brand)', animationDelay: '920ms' }}
        >
          <Icon name="users" />
          Pessoas
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
          <StatCard
            title="Vencimentos"
            value={`${pessoasVencendo} ${pessoasVencendo === 1 ? 'pessoa' : 'pessoas'}`}
            caption="férias, exames ou experiência nos próximos 15 dias"
            captionTone={pessoasVencendo > 0 ? 'negative' : undefined}
            href="/pessoas/funcionarios"
            delay={1000}
          />
          <div className="lg:col-span-2">
            <EmployeesList employees={funcionarios} delay={1080} />
          </div>
        </div>
      </section>

      <section className="mt-8">
        <h2
          className="animate-enter flex items-center gap-2 text-lg font-bold mb-4"
          style={{ fontFamily: 'Manrope', color: 'var(--color-brand)', animationDelay: '1160ms' }}
        >
          <Icon name="briefcase" />
          Operacional
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
          <StatCard
            title="Vendas em aberto"
            value={`${qtdVendasAbertas} ${qtdVendasAbertas === 1 ? 'pedido' : 'pedidos'}`}
            caption={`${formatCurrency(valorVendasAbertas)} em negociação`}
            href="/operacional/pedidos-venda"
            delay={1240}
          />
          <div className="lg:col-span-2">
            <OpenReceivables clients={clientesEmAberto} delay={1320} />
          </div>
        </div>
      </section>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="flex flex-col">
          <h2
            className="animate-enter flex items-center gap-2 text-lg font-bold mb-4"
            style={{ fontFamily: 'Manrope', color: 'var(--color-brand)', animationDelay: '1400ms' }}
          >
            <Icon name="file" />
            Administrativo
          </h2>
          <div className="flex-1">
            <DocumentsValidity documents={docsValidade} today={today} delay={1480} />
          </div>
        </section>

        <section className="flex flex-col">
          <h2
            className="animate-enter flex items-center gap-2 text-lg font-bold mb-4"
            style={{ fontFamily: 'Manrope', color: 'var(--color-brand)', animationDelay: '1400ms' }}
          >
            <Icon name="megaphone" />
            Marketing
          </h2>
          <div className="flex-1">
            <ScheduledPosts posts={(postagens ?? []) as ScheduledPost[]} today={today} delay={1560} />
          </div>
        </section>
      </div>
    </IntroProvider>
  )
}
