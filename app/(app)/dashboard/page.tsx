import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { SummaryCard } from '@/components/modules/dashboard/summary-card'
import { Icon } from '@/components/ui/icon'
import { getAccountBalances } from '@/lib/finance/balances'
import { CalendarioHome } from '../calendario/components/calendario-home'
import { getEventos, getAgendas } from '../calendario/queries'
import { getConfigFolha } from '../pessoas/folha-de-pagamento/queries'
import { Welcome } from '@/components/modules/dashboard/welcome'
import { Ferramentas } from '@/components/modules/dashboard/ferramentas'
import { IntroProvider } from '@/components/modules/dashboard/intro'
import { getPermissoes } from '@/lib/auth/acesso'
import { pode } from '@/lib/acesso/catalogo'

export const dynamic = 'force-dynamic'

function isoDate(d: Date) { return d.toISOString().split('T')[0] }

function offsetDate(days: number) {
  return isoDate(new Date(Date.now() + days * 86400000))
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Números do bloco "Sua casa hoje" */
async function carregarResumo(admin: ReturnType<typeof createAdminClient>, companyId: string) {
  // Datas no fuso do Brasil (o servidor roda em UTC)
  const today     = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
  const in30d     = offsetDate(30)
  const [ano, mes] = today.split('-').map(Number)
  const inicioMes = `${today.slice(0, 7)}-01`
  const fimMes    = isoDate(new Date(Date.UTC(ano, mes, 0)))

  const [
    { count: docsVencidosCount },
    { count: docsVencendoCount },
    { data: bankAccounts },
    balances,
    { count: empAtivosCount },
    { count: osAbertasCount },
    { count: vendasAbertasCount },
    { count: publicacoesMesCount },
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
  ])

  const docsVencidos = docsVencidosCount ?? 0
  return {
    docsVencidos,
    // Administrativo: vencidos + vencendo em 30 dias
    atencao: docsVencidos + (docsVencendoCount ?? 0),
    // Financeiro: saldo calculado a partir dos lançamentos quitados (lib/finance/balances.ts)
    saldoTotal: (bankAccounts ?? []).reduce((s, a) => s + (balances.get(a.id)?.saldo ?? 0), 0),
    empAtivos: empAtivosCount ?? 0,
    emAndamento: (osAbertasCount ?? 0) + (vendasAbertasCount ?? 0),
    publicacoes: publicacoesMesCount ?? 0,
  }
}

/**
 * Os lançadores são de quem ocupa um cargo da Estrutura: pela ficha da Equipe ou, sem ficha, pelo cargo do usuário
 * ('*': position_id vem das migrations 20261108000090/91)
 */
async function cargoDoUsuario(admin: ReturnType<typeof createAdminClient>, companyId: string, profileId: string) {
  const [{ data: fichas }, { data: membro }] = await Promise.all([
    admin.from('employees').select('*').eq('company_id', companyId).eq('profile_id', profileId).not('status', 'in', '(inativo,demitido)'),
    admin.from('company_members').select('*').eq('company_id', companyId).eq('profile_id', profileId).eq('status', 'active').maybeSingle(),
  ])
  const ids = [
    ...((fichas ?? []) as { position_id?: string | null }[]).map((f) => f.position_id),
    (membro as { position_id?: string | null } | null)?.position_id,
  ].filter((id): id is string => !!id)
  if (!ids.length) return { temCargo: false, batePonto: false }
  // '*': bate_ponto vem da migration 20261110000105; sem ela, todo cargo registra ponto
  const { data: cargos } = await admin.from('job_positions').select('*').in('id', ids)
  return { temCargo: true, batePonto: ((cargos ?? []) as { bate_ponto?: boolean | null }[]).some((c) => c.bate_ponto !== false) }
}

/**
 * Pesquisas ativas (no período) para quem tem ficha na Equipe e ainda não respondeu.
 * Sem a tabela de participação (migration 20261110000104), mostra todas as ativas.
 */
async function pesquisasParaResponder(admin: ReturnType<typeof createAdminClient>, companyId: string, profileId: string) {
  const { data: ficha } = await admin.from('employees').select('id').eq('company_id', companyId).eq('profile_id', profileId).not('status', 'in', '(inativo,demitido,admissao)').limit(1).maybeSingle()
  if (!ficha) return []
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
  const [{ data: ativas }, { data: respondidas }] = await Promise.all([
    admin.from('surveys').select('id, titulo, data_inicio, data_fim').eq('company_id', companyId).eq('status', 'ativo').order('created_at', { ascending: false }),
    admin.from('survey_participations').select('survey_id').eq('profile_id', profileId),
  ])
  const feitas = new Set(((respondidas ?? []) as { survey_id: string }[]).map((r) => r.survey_id))
  type Pesquisa = { id: string; titulo: string; data_inicio: string | null; data_fim: string | null }
  return ((ativas ?? []) as Pesquisa[])
    .filter((s) => !feitas.has(s.id) && (!s.data_inicio || s.data_inicio <= hoje) && (!s.data_fim || s.data_fim >= hoje))
    .map((s) => ({ id: s.id, titulo: s.titulo, fim: s.data_fim }))
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

  // O perfil de acesso escolhe os blocos. Colaborador vê só o Calendário: o resumo traz dados da empresa.
  const { permissoes } = await getPermissoes(companyId)
  const colaborador = rows.find(m => m.company_id === companyId)?.role === 'colaborador'
  const verSuaCasa = !colaborador && pode(permissoes, 'visao-geral.sua-casa')
  const verCalendario = colaborador || pode(permissoes, 'visao-geral.calendario')
  const verBaterPonto = colaborador || pode(permissoes, 'visao-geral.bater-ponto')

  // Calendário: meus eventos, convites e agendas que acompanho
  const [configFolha, resumo, eventos, agendas, pesquisas, cargo] = await Promise.all([
    verBaterPonto ? getConfigFolha(companyId) : null,
    verSuaCasa ? carregarResumo(admin, companyId) : null,
    verCalendario ? getEventos(user.id) : [],
    verCalendario ? getAgendas(user.id) : null,
    pesquisasParaResponder(admin, companyId, user.id),
    cargoDoUsuario(admin, companyId, user.id),
  ])
  const { atencao, docsVencidos, saldoTotal, empAtivos, emAndamento, publicacoes } = resumo ?? {
    atencao: 0, docsVencidos: 0, saldoTotal: 0, empAtivos: 0, emAndamento: 0, publicacoes: 0,
  }

  return (
    <IntroProvider play={cookieStore.get('play_intro')?.value === '1'}>
      <Welcome firstName={firstName} />

      {cargo.temCargo && <Ferramentas baterPonto={verBaterPonto} ponto={cargo.batePonto} holerite={!!configFolha?.holerite_ativo} pesquisas={pesquisas} />}

      {verSuaCasa && <section>
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
            // Cada card leva ao dashboard da área (por enquanto só o Administrativo tem)
            href="/admin"
            linkLabel="Ver dashboard"
          />
          <SummaryCard
            icon="dollar"
            title="Financeiro"
            delay={280}
            value={formatCurrency(saldoTotal)}
            caption="saldo atual em conta"
            accent={saldoTotal < 0 ? 'red' : undefined}
          />
          <SummaryCard
            icon="users"
            title="Pessoas"
            delay={360}
            value={empAtivos}
            caption={empAtivos === 1 ? 'pessoa na equipe' : 'pessoas na equipe'}
          />
          <SummaryCard
            icon="briefcase"
            title="Operacional"
            delay={440}
            value={emAndamento}
            caption="OS e pedidos em andamento"
          />
          <SummaryCard
            icon="megaphone"
            title="Marketing"
            delay={520}
            value={publicacoes}
            caption={publicacoes === 1 ? 'publicação neste mês' : 'publicações neste mês'}
          />
        </div>
      </section>}

      {/* Calendário (sem título de seção, só o respiro acima) */}
      {verCalendario && agendas && <section className={verSuaCasa ? 'mt-12' : undefined} aria-label="Calendário">
        <div className="animate-enter" style={{ animationDelay: '600ms' }}>
          <CalendarioHome eventos={eventos} eventoAbertoId={eventoAbertoId} agendas={agendas} abrirAgendas={abrirAgendas === "1"} />
        </div>
      </section>}

      {!verSuaCasa && !verCalendario && !verBaterPonto && (
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Seu perfil de acesso não tem itens na Visão geral.</p>
      )}
    </IntroProvider>
  )
}
