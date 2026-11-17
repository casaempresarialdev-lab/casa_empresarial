import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { IndicadorCard } from '@/components/modules/dashboard/indicador-card'
import { ListCard, type ListItem } from '@/components/modules/dashboard/list-card'
import { exigirAcessoPagina } from '@/lib/auth/acesso'
import { canalLabel } from '@/lib/marketing/constantes'
import { getConteudosMarketing } from './calendario/queries'
import { getIdeiasMarketing } from './ideias/queries'
import { getCampanhasMarketing } from './campanhas/queries'
import { getDepoimentos } from './depoimentos/queries'

export const dynamic = 'force-dynamic'

function fmtDataBr(d: string) {
  const [y, m, day] = d.slice(0, 10).split('-')
  return `${day}/${m}/${y}`
}

function statusCampanhaAtiva(dataInicio: string, dataFim: string | null) {
  const hoje = new Date().toISOString().slice(0, 10)
  if (dataInicio && hoje < dataInicio) return false
  if (dataFim && hoje > dataFim) return false
  return true
}

// Dashboard de Marketing: publicações do mês, ideias aguardando, campanhas ativas e depoimentos
export default async function MarketingDashboardPage() {
  await exigirAcessoPagina('marketing.dashboard')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const companyId = (await cookies()).get('active_company_id')?.value
  if (!companyId) redirect('/empresa')

  const [conteudos, ideias, campanhas, depoimentos] = await Promise.all([
    getConteudosMarketing(companyId),
    getIdeiasMarketing(companyId),
    getCampanhasMarketing(companyId),
    getDepoimentos(companyId),
  ])

  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
  const mesAtual = hoje.slice(0, 7)

  const conteudosMes = conteudos.filter((c) => c.data_publicacao?.slice(0, 7) === mesAtual)
  const ideiasAguardando = ideias.filter((i) => i.status === 'ideia')
  const campanhasAtivas = campanhas.filter((c) => statusCampanhaAtiva(c.data_inicio, c.data_fim))

  const proximasPublicacoes = conteudos
    .filter((c) => c.status === 'agendado' && c.data_publicacao && c.data_publicacao >= hoje)
    .sort((a, b) => (a.data_publicacao ?? '').localeCompare(b.data_publicacao ?? ''))

  const itensProximas: ListItem[] = proximasPublicacoes.slice(0, 6).map((c) => ({
    key: c.id,
    title: c.titulo,
    subtitle: [fmtDataBr(c.data_publicacao!), c.canal && canalLabel(c.canal, c.canal_outro)].filter(Boolean).join(' · '),
    href: '/marketing/calendario',
  }))

  const itensCampanhas: ListItem[] = campanhasAtivas.slice(0, 6).map((c) => ({
    key: c.id,
    title: c.nome,
    subtitle: c.data_fim ? `até ${fmtDataBr(c.data_fim)}` : 'em diante',
    href: '/marketing/campanhas',
  }))

  const itensDepoimentos: ListItem[] = depoimentos.slice(0, 6).map((d) => ({
    key: d.id,
    title: d.cliente,
    subtitle: `"${d.texto}"`,
    href: '/marketing/depoimentos',
  }))

  return (
    <div className="w-full">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>Marketing</h1>
        <Breadcrumb />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <IndicadorCard
          icon="calendar" titulo="Conteúdos neste mês" valor={conteudosMes.length} href="/marketing/calendario" delay={100}
          detalhe={conteudosMes.length ? `${conteudosMes.length} publicação${conteudosMes.length === 1 ? '' : 'ões'}` : 'Nenhum conteúdo neste mês'}
        />
        <IndicadorCard
          icon="sparkle" titulo="Ideias aguardando" valor={ideiasAguardando.length} href="/marketing/ideias" delay={160}
          detalhe={ideiasAguardando.length ? 'aguardando virar post' : 'Nenhuma ideia solta no momento'}
        />
        <IndicadorCard
          icon="flag" titulo="Campanhas ativas" valor={campanhasAtivas.length} href="/marketing/campanhas" delay={220}
          detalhe={campanhasAtivas.length ? 'dentro do período' : 'Nenhuma campanha ativa agora'}
        />
        <IndicadorCard
          icon="star" titulo="Depoimentos" valor={depoimentos.length} href="/marketing/depoimentos" delay={280}
          detalhe={depoimentos.length ? 'registrados' : 'Nenhum depoimento ainda'}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <ListCard title="Próximas publicações" icon="calendar" href="/marketing/calendario" emptyText="Nenhuma publicação agendada no momento." items={itensProximas} delay={340} />
        <ListCard title="Campanhas ativas" icon="flag" href="/marketing/campanhas" emptyText="Nenhuma campanha ativa no momento." items={itensCampanhas} delay={400} />
        <ListCard title="Depoimentos" icon="star" href="/marketing/depoimentos" emptyText="Nenhum depoimento registrado ainda." items={itensDepoimentos} delay={460} />
      </div>
    </div>
  )
}
