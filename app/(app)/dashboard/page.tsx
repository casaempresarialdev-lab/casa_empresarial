import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { ModuleSection } from '@/components/modules/dashboard/module-section'

export const dynamic = 'force-dynamic'

function isoDate(d: Date) { return d.toISOString().split('T')[0] }

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

  const today    = isoDate(new Date())
  const in30d    = offsetDate(30)
  const now      = new Date()
  const inicioMes = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const fimMes    = isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0))

  const [
    // Administrativo — Documentação
    { count: docsCount },
    { count: docsVencidosCount },
    { data: docsVencendo },
    // Financeiro
    { data: bankAccounts },
    { data: receitasMes },
    { data: despesasMes },
    // Operacional
    { count: comprasAbertasCount },
    { count: vendasAbertasCount },
    { count: produtosCount },
    // Pessoas
    { count: empAtivosCount },
    { count: empAdmissaoCount },
    { data: empFeriasAlert },
    { data: empExamesAlert },
  ] = await Promise.all([
    // Administrativo — Documentação
    admin.from('documents').select('*', { count: 'exact', head: true })
      .eq('company_id', companyId),
    admin.from('documents').select('*', { count: 'exact', head: true })
      .eq('company_id', companyId).not('vencimento', 'is', null).lt('vencimento', today),
    admin.from('documents').select('descricao, nome, vencimento')
      .eq('company_id', companyId).not('vencimento', 'is', null)
      .gte('vencimento', today).lte('vencimento', in30d)
      .order('vencimento').limit(3),
    // Financeiro
    admin.from('bank_accounts').select('saldo_atual')
      .eq('company_id', companyId).eq('ativo', true),
    admin.from('transactions').select('valor')
      .eq('company_id', companyId).eq('tipo', 'receita')
      .gte('data_transacao', inicioMes).lte('data_transacao', fimMes),
    admin.from('transactions').select('valor')
      .eq('company_id', companyId).eq('tipo', 'despesa')
      .gte('data_transacao', inicioMes).lte('data_transacao', fimMes),
    // Operacional
    admin.from('purchase_orders').select('*', { count: 'exact', head: true })
      .eq('company_id', companyId).neq('status', 'recebido').neq('status', 'cancelado'),
    admin.from('sale_orders').select('*', { count: 'exact', head: true })
      .eq('company_id', companyId).neq('status', 'entregue').neq('status', 'cancelado'),
    admin.from('products').select('*', { count: 'exact', head: true })
      .eq('company_id', companyId),
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
  ])

  // Administrativo
  const totalDocs        = docsCount ?? 0
  const docsVencidos     = docsVencidosCount ?? 0
  const docsVencendoList = docsVencendo ?? []

  // Financeiro
  const saldoTotal   = (bankAccounts ?? []).reduce((s, a) => s + (a.saldo_atual ?? 0), 0)
  const totalReceitas = (receitasMes ?? []).reduce((s, t) => s + (t.valor ?? 0), 0)
  const totalDespesas = (despesasMes ?? []).reduce((s, t) => s + (t.valor ?? 0), 0)
  const resultado     = totalReceitas - totalDespesas

  // Operacional
  const comprasAbertas = comprasAbertasCount ?? 0
  const vendasAbertas  = vendasAbertasCount ?? 0
  const totalProdutos  = produtosCount ?? 0

  // Pessoas
  const empAtivos   = empAtivosCount ?? 0
  const empAdmissao = empAdmissaoCount ?? 0
  const feriasCount = (empFeriasAlert ?? []).length
  const examesCount = (empExamesAlert ?? []).length

  return (
    <div className="max-w-7xl mx-auto">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">

        {/* 1 — Administrativo: Documentação */}
        <ModuleSection
          icon="🏢"
          title="ADMINISTRATIVO"
          metrics={[
            { label: 'Documentos',         value: totalDocs },
            { label: 'Vencidos',           value: docsVencidos,           accent: docsVencidos           > 0 ? 'red'    : undefined },
            { label: 'Vencendo (30 dias)', value: docsVencendoList.length, accent: docsVencendoList.length > 0 ? 'yellow' : undefined },
          ]}
          href="/admin/documentacao"
          linkLabel="Ver documentação"
        />

        {/* 2 — Financeiro */}
        <ModuleSection
          icon="💰"
          title="FINANCEIRO"
          metrics={[
            { label: 'Saldo total',         value: formatCurrency(saldoTotal),   accent: saldoTotal   < 0 ? 'red' : undefined },
            { label: 'Receitas do mês',     value: formatCurrency(totalReceitas), accent: 'green' },
            { label: 'Despesas do mês',     value: formatCurrency(totalDespesas), accent: totalDespesas > 0 ? 'red' : undefined },
            { label: 'Resultado do mês',    value: formatCurrency(resultado),     accent: resultado < 0 ? 'red' : resultado > 0 ? 'green' : undefined },
          ]}
          href="/financeiro/fluxo"
          linkLabel="Ver fluxo de caixa"
        />

        {/* 3 — Operacional */}
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

        {/* 4 — Pessoas */}
        <ModuleSection
          icon="👥"
          title="PESSOAS"
          metrics={[
            { label: 'Funcionários ativos',        value: empAtivos },
            { label: 'Em admissão / experiência',  value: empAdmissao,  accent: empAdmissao  > 0 ? 'yellow' : undefined },
            { label: 'Férias vencendo (30 dias)',   value: feriasCount,  accent: feriasCount  > 0 ? 'yellow' : undefined },
            { label: 'Exames periódicos (30 dias)', value: examesCount,  accent: examesCount  > 0 ? 'yellow' : undefined },
          ]}
          href="/pessoas/funcionarios"
          linkLabel="Ver funcionários"
        />

        {/* 5 — Marketing (em branco) */}
        <ModuleSection
          icon="📣"
          title="MARKETING"
          metrics={[]}
          href="/marketing/calendario"
          linkLabel="Ver marketing"
        />

      </div>
    </div>
  )
}
