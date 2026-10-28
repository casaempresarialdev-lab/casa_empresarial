import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { Icon, type IconName } from '@/components/ui/icon'
import { DASHBOARD_CARD_CLASS, DASHBOARD_CARD_TITLE_CLASS, DASHBOARD_CARD_TITLE_STYLE } from '@/components/modules/dashboard/summary-card'
import { ListCard, type BadgeTone } from '@/components/modules/dashboard/list-card'
import { daysBetween, formatDate } from '@/components/modules/dashboard/format'

export const dynamic = 'force-dynamic'

// Vencendo em breve = vence nos próximos 30 dias (mesmo critério do dashboard principal)
const VENCENDO_DIAS = 30

// Card de indicador: ícone e seta no topo, rótulo e valor; leva à tela correspondente
function IndicadorCard({ icon, titulo, valor, detalhe, tom, href, delay }: {
  icon: IconName; titulo: string; valor: string | number; detalhe?: string
  tom?: 'atencao' | 'ok'; href: string; delay: number
}) {
  const cor = tom === 'atencao' ? '#B45309' : tom === 'ok' ? '#15803D' : 'var(--color-text-primary)'
  return (
    <Link href={href} className={`${DASHBOARD_CARD_CLASS} group flex flex-col`} style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-start justify-between gap-3">
        <span style={{ color: 'var(--color-brand)' }}><Icon name={icon} size={22} /></span>
        <span className="transition-transform group-hover:translate-x-0.5" style={{ color: 'var(--color-sidebar-text)' }}>
          <Icon name="chevron-right" size={16} />
        </span>
      </div>
      <p className={`${DASHBOARD_CARD_TITLE_CLASS} mt-4`} style={DASHBOARD_CARD_TITLE_STYLE}>{titulo}</p>
      <p className="text-2xl font-extrabold mt-1 truncate" style={{ fontFamily: 'Manrope', color: cor }}>{valor}</p>
      {detalhe && <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-text-muted)' }}>{detalhe}</p>}
    </Link>
  )
}

function statusValidade(venc: string, hoje: string): { label: string; tone: BadgeTone; subtitle: string } {
  const dias = daysBetween(hoje, venc)
  if (dias < 0) return { label: 'Vencido', tone: 'red', subtitle: `venceu em ${formatDate(venc)}` }
  if (dias <= VENCENDO_DIAS) {
    return { label: 'Vencendo', tone: 'amber', subtitle: dias === 0 ? 'vence hoje' : dias === 1 ? 'vence amanhã' : `vence em ${dias} dias` }
  }
  return { label: 'Válido', tone: 'green', subtitle: `válido até ${formatDate(venc)}` }
}

// Dashboard do Administrativo: indicadores de Documentação, Quadro Societário e Certificado digital
export default async function AdminDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value
  if (!companyId) redirect('/empresa')
  if (!/^[0-9a-f-]{36}$/i.test(companyId)) redirect('/empresa')

  const admin = createAdminClient()
  // Datas no fuso do Brasil (o servidor roda em UTC)
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
  const limite = new Date(Date.parse(hoje) + VENCENDO_DIAS * 86400000).toISOString().slice(0, 10)

  const [
    { count: pastas },
    { count: documentos },
    { count: socios },
    { count: certificados },
    { data: comValidade },
  ] = await Promise.all([
    // Pastas padrão do sistema + pastas da empresa
    admin.from('document_folders').select('*', { count: 'exact', head: true }).or(`company_id.is.null,company_id.eq.${companyId}`),
    admin.from('documents').select('*', { count: 'exact', head: true }).eq('company_id', companyId),
    admin.from('socios').select('*', { count: 'exact', head: true }).eq('company_id', companyId),
    admin.from('company_certificates').select('*', { count: 'exact', head: true }).eq('company_id', companyId),
    admin.from('documents').select('id, nome, descricao, vencimento')
      .eq('company_id', companyId).not('vencimento', 'is', null)
      .order('vencimento', { ascending: true }).limit(50),
  ])

  type Doc = { id: string; nome: string; descricao: string | null; vencimento: string }
  const docs = (comValidade ?? []) as Doc[]
  const item = (d: Doc) => {
    const s = statusValidade(d.vencimento, hoje)
    return { key: d.id, title: d.descricao || d.nome, subtitle: s.subtitle, badge: { label: s.label, tone: s.tone }, href: '/admin/documentacao' }
  }
  const porValidade = docs.slice(0, 8).map(item)
  const vencendo = docs.filter((d) => d.vencimento >= hoje && d.vencimento <= limite).map(item)

  const qtdCert = certificados ?? 0

  return (
    <div className="w-full">
      <div className="mb-6">
        {/* Título e breadcrumb */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>
            Administrativo
          </h1>
          <Breadcrumb />
        </div>
        <p className="text-sm mt-1 animate-enter" style={{ color: 'var(--color-text-muted)', animationDelay: '60ms' }}>
          Documentação, sócios e certificados da empresa
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <IndicadorCard icon="folder" titulo="Pastas" valor={pastas ?? 0} href="/admin/documentacao" delay={100} />
        <IndicadorCard icon="file" titulo="Documentos arquivados" valor={documentos ?? 0} href="/admin/documentacao" delay={160} />
        <IndicadorCard icon="users" titulo="Sócios cadastrados" valor={socios ?? 0} href="/admin/quadro-societario" delay={220} />
        <IndicadorCard
          icon="shield"
          titulo="Certificado digital"
          valor={qtdCert === 0 ? 'Atenção' : 'Em dia'}
          detalhe={qtdCert === 0 ? 'Nenhum certificado cadastrado' : `${qtdCert} ${qtdCert === 1 ? 'certificado cadastrado' : 'certificados cadastrados'}`}
          tom={qtdCert === 0 ? 'atencao' : 'ok'}
          href="/admin/certificado-digital"
          delay={280}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4 items-start">
        <ListCard
          title="Documentos por validade"
          icon="file"
          href="/admin/documentacao"
          emptyText="Nenhum documento com validade cadastrada ainda."
          items={porValidade}
          delay={340}
        />
        <ListCard
          title="Vencendo em breve"
          icon="calendar"
          href="/admin/documentacao"
          emptyText="Nenhum documento vencendo no momento."
          items={vencendo}
          delay={400}
        />
      </div>
    </div>
  )
}
