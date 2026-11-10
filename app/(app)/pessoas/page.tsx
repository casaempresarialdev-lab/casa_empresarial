import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { IndicadorCard } from '@/components/modules/dashboard/indicador-card'
import { ListCard, type ListItem } from '@/components/modules/dashboard/list-card'
import { exigirAcessoPagina, getPermissoes } from '@/lib/auth/acesso'
import { getViewerContext } from '@/lib/auth/viewer'
import { pode } from '@/lib/acesso/catalogo'
import { somarDias } from '@/lib/escala/periodo'
import { calcularPeriodos, fimDasFerias } from '@/lib/ferias/regras'
import { fmtDataBr, vencimentosFolha } from '@/lib/folha/config'
import { getFeriadosEmpresa } from './escala-de-trabalho/queries'
import { getFeriasEquipe } from './ferias/queries'
import { getConfigFolha } from './folha-de-pagamento/queries'

export const dynamic = 'force-dynamic'

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const diasAte = (de: string, ate: string) => Math.round((Date.parse(ate) - Date.parse(de)) / 86400000)
const quando = (dias: number) => (dias === 0 ? 'hoje' : dias === 1 ? 'amanhã' : `em ${dias} dias`)
/** Contagem tolerante: sem a tabela (migration ainda não aplicada), zero */
const contar = (r: { count: number | null; error: unknown }) => (r.error ? 0 : r.count ?? 0)

const ATIVOS = ['ativo', 'experiencia', 'ferias', 'afastado']

type Pessoa = {
  id: string; nome: string; cargo: string | null; status: string; nascimento: string | null; data_admissao: string | null
  fim_experiencia_1: string | null; fim_experiencia_2: string | null
}

// Dashboard de Pessoas: equipe, pendências para decidir, folha do mês e o que vence nos próximos dias
export default async function PessoasDashboardPage() {
  await exigirAcessoPagina('pessoas.dashboard')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const companyId = (await cookies()).get('active_company_id')?.value
  if (!companyId) redirect('/empresa')
  if ((await getViewerContext(companyId))?.isColaborador) redirect('/dashboard')

  const admin = createAdminClient()
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
  const em30 = somarDias(hoje, 30)
  const mesAno = hoje.slice(0, 7)

  const [{ permissoes }, { data: pessoasData }, ajustes, ausencias, rescisoes, folhaFechada, { data: seguranca }, ferias, config, feriados] = await Promise.all([
    getPermissoes(companyId),
    admin.from('employees').select('*').eq('company_id', companyId).not('status', 'in', '(inativo,demitido)').order('nome'),
    admin.from('time_adjustments').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'pendente'),
    admin.from('time_absences').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'pendente'),
    admin.from('employee_terminations').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'em_andamento'),
    admin.from('payroll_entries').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('mes_ano', mesAno).neq('status', 'rascunho'),
    admin.from('health_safety_records').select('id, titulo, data_vencimento, employee:employee_id (nome)').eq('company_id', companyId).not('data_vencimento', 'is', null).lte('data_vencimento', em30).order('data_vencimento'),
    getFeriasEquipe(companyId),
    getConfigFolha(companyId),
    getFeriadosEmpresa(companyId),
  ])
  const ve = (item: string) => pode(permissoes, item)

  const pessoas = (pessoasData ?? []) as Pessoa[]
  const equipe = pessoas.filter((p) => ATIVOS.includes(p.status))
  const emExperiencia = equipe.filter((p) => p.status === 'experiencia').length
  const afastados = equipe.filter((p) => p.status === 'afastado').length
  const admissoes = pessoas.filter((p) => p.status === 'admissao').length
  const nomeDe = new Map(pessoas.map((p) => [p.id, p.nome]))

  const nAjustes = contar(ajustes)
  const nAusencias = contar(ausencias)
  const pedidosFerias = ferias.filter((f) => f.status === 'solicitada').length
  const pendencias = nAjustes + nAusencias + pedidosFerias
  const nRescisoes = contar(rescisoes)
  const fechada = contar(folhaFechada) > 0
  const pagamento = vencimentosFolha(mesAno, config, feriados).salario

  // ── Atenção nos próximos 30 dias: experiência, férias a conceder e segurança ──
  type Alerta = ListItem & { data: string }
  const alertas: Alerta[] = []
  for (const p of equipe.filter((p) => p.status === 'experiencia')) {
    const fim = [p.fim_experiencia_1, p.fim_experiencia_2].find((d) => d && d >= hoje && d <= em30)
    if (fim) {
      const primeiro = fim === p.fim_experiencia_1
      alertas.push({ key: `exp-${p.id}`, data: fim, title: p.nome, subtitle: `${primeiro ? '1º' : '2º'} período de experiência termina ${quando(diasAte(hoje, fim))}`, badge: { label: 'Experiência', tone: 'blue' }, href: `/pessoas/funcionarios/${p.id}` })
    }
  }
  if (ve('pessoas.ferias')) {
    for (const p of equipe) {
      const vencendo = calcularPeriodos(p.data_admissao, hoje, ferias.filter((f) => f.employee_id === p.id)).find((x) => x.situacao === 'vencendo' && x.saldo > 0)
      if (vencendo) alertas.push({ key: `fer-${p.id}`, data: vencendo.concessivoFim, title: p.nome, subtitle: `${vencendo.saldo} dias de férias para conceder até ${fmtDataBr(vencendo.concessivoFim)}`, badge: { label: 'Férias', tone: 'amber' }, href: '/pessoas/ferias' })
    }
  }
  if (ve('pessoas.seguranca-saude')) {
    type Registro = { id: string; titulo: string; data_vencimento: string; employee: { nome: string } | null }
    for (const r of (seguranca ?? []) as unknown as Registro[]) {
      const dias = diasAte(hoje, r.data_vencimento)
      alertas.push({
        key: `ss-${r.id}`, data: r.data_vencimento, title: r.titulo,
        subtitle: `${r.employee?.nome ?? 'Empresa'} · ${dias < 0 ? `venceu em ${fmtDataBr(r.data_vencimento)}` : `vence ${quando(dias)}`}`,
        badge: dias < 0 ? { label: 'Vencido', tone: 'red' } : { label: 'Vencendo', tone: 'amber' }, href: '/pessoas/seguranca-saude',
      })
    }
  }
  alertas.sort((a, b) => a.data.localeCompare(b.data))

  // ── Férias: quem está fora e quem sai nos próximos 30 dias ──
  const aprovadas = ferias.filter((f) => f.status === 'aprovada')
  const itensFerias: ListItem[] = [
    ...aprovadas
      .filter((f) => f.data_inicio <= hoje && fimDasFerias(f.data_inicio, f.dias) >= hoje)
      .map((f) => ({ key: f.id, title: nomeDe.get(f.employee_id) ?? 'Funcionário', subtitle: `Volta em ${fmtDataBr(somarDias(fimDasFerias(f.data_inicio, f.dias), 1))}`, badge: { label: 'Em férias', tone: 'green' as const }, href: '/pessoas/ferias' })),
    ...aprovadas
      .filter((f) => f.data_inicio > hoje && f.data_inicio <= em30)
      .sort((a, b) => a.data_inicio.localeCompare(b.data_inicio))
      .map((f) => ({ key: f.id, title: nomeDe.get(f.employee_id) ?? 'Funcionário', subtitle: `${plural(f.dias, 'dia', 'dias')} a partir de ${fmtDataBr(f.data_inicio)}`, badge: { label: dm(f.data_inicio), tone: 'brand' as const }, href: '/pessoas/ferias' })),
  ]

  // ── Aniversariantes do mês ──
  const mes = hoje.slice(5, 7)
  const aniversariantes: ListItem[] = equipe
    .filter((p) => p.nascimento?.slice(5, 7) === mes)
    .sort((a, b) => a.nascimento!.slice(8).localeCompare(b.nascimento!.slice(8)))
    .map((p) => {
      const dia = p.nascimento!.slice(8, 10)
      const hojeE = dia === hoje.slice(8, 10)
      return { key: p.id, title: p.nome, subtitle: [`${dia}/${mes}`, p.cargo].filter(Boolean).join(' · '), badge: hojeE ? { label: 'Hoje', tone: 'brand' as const } : dia < hoje.slice(8, 10) ? { label: 'Já foi', tone: 'neutral' as const } : undefined, href: `/pessoas/funcionarios/${p.id}` }
    })

  const hrefPendencias = nAjustes + nAusencias > 0 && ve('pessoas.registro-de-ponto') ? '/pessoas/registro-de-ponto?aba=aprovacoes' : '/pessoas/ferias'

  return (
    <div className="w-full">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>Pessoas</h1>
        <Breadcrumb />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <IndicadorCard
          icon="users" titulo="Equipe" valor={equipe.length} href="/pessoas/funcionarios" delay={100}
          detalhe={[emExperiencia && `${emExperiencia} em experiência`, afastados && plural(afastados, 'afastado', 'afastados')].filter(Boolean).join(' · ') || 'pessoas na empresa'}
        />
        <IndicadorCard
          icon="check" titulo="Para aprovar" valor={pendencias === 0 ? 'Em dia' : pendencias} tom={pendencias ? 'atencao' : 'ok'} href={hrefPendencias} delay={160}
          detalhe={pendencias ? [nAjustes && plural(nAjustes, 'ajuste de ponto', 'ajustes de ponto'), nAusencias && plural(nAusencias, 'atestado', 'atestados'), pedidosFerias && plural(pedidosFerias, 'pedido de férias', 'pedidos de férias')].filter(Boolean).join(' · ') : 'Nenhum pedido aguardando'}
        />
        <IndicadorCard
          icon="briefcase" titulo="Admissões em andamento" valor={admissoes} href="/pessoas/admissao" delay={220}
          detalhe={nRescisoes ? `${plural(nRescisoes, 'rescisão', 'rescisões')} em andamento` : 'Nenhuma rescisão em andamento'}
        />
        <IndicadorCard
          icon="wallet" titulo={`Folha de ${MESES[Number(mes) - 1]}`} valor={fechada ? 'Fechada' : 'Em conferência'} tom={fechada ? 'ok' : undefined} href="/pessoas/folha-de-pagamento" delay={280}
          detalhe={`Pagamento em ${fmtDataBr(pagamento)}`}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <ListCard title="Atenção nos próximos 30 dias" icon="alarm" href="/pessoas/funcionarios" emptyText="Nada vencendo nos próximos 30 dias." items={alertas.slice(0, 8)} delay={340} />
        <ListCard title="Férias" icon="calendar" href="/pessoas/ferias" emptyText="Ninguém em férias nem saindo nos próximos 30 dias." items={itensFerias.slice(0, 8)} delay={400} />
        <ListCard title={`Aniversariantes de ${MESES[Number(mes) - 1]}`} icon="star" href="/pessoas/funcionarios" emptyText="Nenhum aniversariante neste mês." items={aniversariantes.slice(0, 8)} delay={460} />
      </div>
    </div>
  )
}
