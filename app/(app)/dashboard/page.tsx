import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { SummaryCard } from '@/components/modules/dashboard/summary-card'
import { Icon } from '@/components/ui/icon'
import { getAccountBalances } from '@/lib/finance/balances'
import { CalendarioHome } from '../calendario/components/calendario-home'
import { getEventos, getAgendas } from '../calendario/queries'
import { Welcome } from '@/components/modules/dashboard/welcome'
import { IntroProvider } from '@/components/modules/dashboard/intro'

export const dynamic = 'force-dynamic'

function isoDate(d: Date) { return d.toISOString().split('T')[0] }

function offsetDate(days: number) {
  return isoDate(new Date(Date.now() + days * 86400000))
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ evento?: string; agendas?: string }> }) {
  // ?evento=<id>: vindo de uma notificação, abre o evento no calendário; ?agendas=1 abre o painel de agendas
  const { evento: eventoAbertoId, agendas: abrirAgendas } = await searchParams
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
    // Pessoas
    { count: empAtivosCount },
    // Operacional
    { count: osAbertasCount },
    { count: vendasAbertasCount },
    // Marketing
    { count: publicacoesMesCount },
    // Calendário (meus eventos, convites e agendas que acompanho)
    eventos,
    agendas,
  ] = await Promise.all([
    admin.from('documents').select('*', { count: 'exact', head: true })
      .eq('company_id', companyId).not('vencimento', 'is', null).lt('vencimento', today),
    admin.from('documents').select('*', { count: 'exact', head: true })
      .eq('company_id', companyId).not('vencimento', 'is', null)
      .gte('vencimento', today).lte('vencimento', in30d),
    admin.from('bank_accounts').select('id')
      .eq('company_id', companyId).eq('ativo', true),
    getAccountBalances(companyId, inicioMes),
    admin.from('employees').select('*', { count: 'exact', head: true })
      .eq('company_id', companyId).eq('status', 'ativo'),
    admin.from('service_orders').select('*', { count: 'exact', head: true })
      .eq('company_id', companyId).eq('status', 'aberta'),
    admin.from('sale_orders').select('*', { count: 'exact', head: true })
      .eq('company_id', companyId).neq('status', 'entregue').neq('status', 'cancelado'),
    admin.from('editorial_calendar').select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .gte('data_publicacao', inicioMes).lte('data_publicacao', fimMes),
    getEventos(user.id),
    getAgendas(user.id),
  ])

  // Administrativo: vencidos + vencendo em 30 dias
  const docsVencidos = docsVencidosCount ?? 0
  const atencao      = docsVencidos + (docsVencendoCount ?? 0)

  // Financeiro: saldo calculado a partir dos lançamentos quitados (lib/finance/balances.ts)
  const contasAtivas = bankAccounts ?? []
  const saldoTotal   = contasAtivas.reduce((s, a) => s + (balances.get(a.id)?.saldo ?? 0), 0)

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

      {/* Calendário (sem título de seção, só o respiro acima) */}
      <section className="mt-12" aria-label="Calendário">
        <div className="animate-enter" style={{ animationDelay: '600ms' }}>
          <CalendarioHome eventos={eventos} eventoAbertoId={eventoAbertoId} agendas={agendas} abrirAgendas={abrirAgendas === "1"} />
        </div>
      </section>
    </IntroProvider>
  )
}
