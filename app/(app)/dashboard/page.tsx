import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/utils'
import { MetricCard } from '@/components/modules/dashboard/metric-card'

export const dynamic = 'force-dynamic'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

function startOfMonth() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]
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
  const companies: Company[] = rows.flatMap((m) => {
    const c = m.companies
    if (!c) return []
    return Array.isArray(c) ? c : [c]
  })

  if (companies.length === 0) redirect('/cadastro/passo-2')

  const activeCompany =
    companies.find((c) => c.id === cookieCompanyId) ?? companies[0]
  const companyId = activeCompany.id

  const monthStart = startOfMonth()

  const [
    { data: bankAccounts },
    { data: receitasMes },
    { data: despesasMes },
    { count: pendentesCount },
    { data: profile },
  ] = await Promise.all([
    admin.from('bank_accounts').select('saldo_inicial').eq('company_id', companyId).eq('ativo', true),
    admin.from('transactions').select('valor').eq('company_id', companyId).eq('tipo', 'recebimento').eq('status', 'pago').gte('data_competencia', monthStart),
    admin.from('transactions').select('valor').eq('company_id', companyId).eq('tipo', 'pagamento').eq('status', 'pago').gte('data_competencia', monthStart),
    admin.from('transactions').select('*', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'pendente').lte('data_vencimento', new Date().toISOString().split('T')[0]),
    admin.from('profiles').select('name').eq('id', user.id).single(),
  ])

  const saldoTotal = (bankAccounts ?? []).reduce((s, a) => s + (a.saldo_inicial ?? 0), 0)
  const totalReceitas = (receitasMes ?? []).reduce((s, t) => s + (t.valor ?? 0), 0)
  const totalDespesas = (despesasMes ?? []).reduce((s, t) => s + (t.valor ?? 0), 0)
  const pendentes = pendentesCount ?? 0

  const userName = profile?.name ?? user.email ?? ''
  const firstName = userName.split(' ')[0]
  const companyLabel = activeCompany.nome_fantasia ?? activeCompany.razao_social

  return (
    <div className="max-w-7xl mx-auto">
      {/* Boas-vindas */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}
          >
            {greeting()}, {firstName}! 👋
          </h1>
        </div>
      </div>

      {/* Métricas financeiras */}
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
          title="Despesas do Mês"
          value={formatCurrency(totalDespesas)}
          subtitle="Pagamentos confirmados"
          icon="📉"
          href="/financeiro/fluxo-de-caixa/pagamentos"
          accent="red"
          empty={totalDespesas === 0}
        />
        <MetricCard
          title="A Vencer / Vencidos"
          value={String(pendentes)}
          subtitle={pendentes > 0 ? 'lançamentos pendentes' : 'Nenhum pendente'}
          icon="⏰"
          href="/financeiro/fluxo-de-caixa"
          accent={Number(pendentes) > 0 ? 'red' : 'default'}
          empty={Number(pendentes) === 0}
        />
      </div>
    </div>
  )
}
