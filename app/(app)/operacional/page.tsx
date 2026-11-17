import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { IndicadorCard } from '@/components/modules/dashboard/indicador-card'
import { ListCard, type ListItem } from '@/components/modules/dashboard/list-card'
import { exigirAcessoPagina } from '@/lib/auth/acesso'
import { getPurchaseOrders } from './pedidos-compra/queries'
import { getSaleOrders } from './pedidos-venda/queries'
import { getServiceOrders } from './ordens-de-servico/queries'
import { getProducts } from './produtos/queries'

export const dynamic = 'force-dynamic'

function formatBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// Dashboard de Operacional: pedidos em aberto, ordens de serviço e estoque baixo
export default async function OperacionalDashboardPage() {
  await exigirAcessoPagina('operacional.dashboard')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const companyId = (await cookies()).get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  const [pedidosCompra, pedidosVenda, ordensServico, produtos] = await Promise.all([
    getPurchaseOrders(companyId),
    getSaleOrders(companyId),
    getServiceOrders(companyId),
    getProducts(companyId),
  ])

  const compraAberto = pedidosCompra.filter((o) => ['rascunho', 'enviado', 'confirmado'].includes(o.status))
  const vendaAberto = pedidosVenda.filter((o) => ['rascunho', 'confirmado', 'em_producao', 'enviado'].includes(o.status))
  const osAbertas = ordensServico.filter((o) => o.status === 'aberta')
  const estoqueBaixo = produtos.filter((p) => p.tipo === 'produto' && p.ativo && p.estoque_atual <= p.estoque_minimo)

  const valorCompraAberto = compraAberto.reduce((s, o) => s + o.valor_total, 0)
  const valorVendaAberto = vendaAberto.reduce((s, o) => s + o.valor_total, 0)
  const valorOsAbertas = osAbertas.reduce((s, o) => s + o.valor_total, 0)

  const itensCompra: ListItem[] = compraAberto.slice(0, 6).map((o) => ({
    key: o.id,
    title: `Pedido #${String(o.numero).padStart(3, '0')}`,
    subtitle: o.fornecedor?.nome ?? 'Sem fornecedor',
    badge: { label: formatBRL(o.valor_total), tone: 'brand' },
    href: `/operacional/pedidos-compra/${o.id}`,
  }))

  const itensVenda: ListItem[] = vendaAberto.slice(0, 6).map((o) => ({
    key: o.id,
    title: `Pedido #${String(o.numero).padStart(3, '0')}`,
    subtitle: o.cliente?.nome ?? 'Sem cliente',
    badge: { label: formatBRL(o.valor_total), tone: 'brand' },
    href: `/operacional/pedidos-venda/${o.id}`,
  }))

  const itensEstoque: ListItem[] = estoqueBaixo.slice(0, 6).map((p) => ({
    key: p.id,
    title: p.nome,
    subtitle: `${p.estoque_atual} ${p.unidade_medida} · mínimo ${p.estoque_minimo}`,
    badge: { label: 'Baixo', tone: 'red' },
  }))

  return (
    <div className="w-full">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>Operacional</h1>
        <Breadcrumb />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <IndicadorCard
          icon="briefcase" titulo="Pedidos de Compra" valor={compraAberto.length} href="/operacional/pedidos-compra" delay={100}
          detalhe={compraAberto.length ? `${formatBRL(valorCompraAberto)} em aberto` : 'Nenhum pedido em aberto'}
        />
        <IndicadorCard
          icon="dollar" titulo="Pedidos de Venda" valor={vendaAberto.length} href="/operacional/pedidos-venda" delay={160}
          detalhe={vendaAberto.length ? `${formatBRL(valorVendaAberto)} em aberto` : 'Nenhum pedido em aberto'}
        />
        <IndicadorCard
          icon="file" titulo="Ordens de Serviço" valor={osAbertas.length} href="/operacional/ordens-de-servico" delay={220}
          detalhe={osAbertas.length ? `${formatBRL(valorOsAbertas)} em aberto` : 'Nenhuma ordem aberta'}
        />
        <IndicadorCard
          icon="info" titulo="Estoque baixo" valor={estoqueBaixo.length} tom={estoqueBaixo.length ? 'atencao' : 'ok'} href="/operacional/produtos" delay={280}
          detalhe={estoqueBaixo.length ? 'no mínimo ou abaixo' : 'Tudo em dia'}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <ListCard title="Pedidos de Compra em aberto" icon="briefcase" href="/operacional/pedidos-compra" emptyText="Nenhum pedido de compra em aberto." items={itensCompra} delay={340} />
        <ListCard title="Pedidos de Venda em aberto" icon="dollar" href="/operacional/pedidos-venda" emptyText="Nenhum pedido de venda em aberto." items={itensVenda} delay={400} />
        <ListCard title="Estoque baixo" icon="info" href="/operacional/produtos" emptyText="Nenhum produto com estoque baixo." items={itensEstoque} delay={460} />
      </div>
    </div>
  )
}
