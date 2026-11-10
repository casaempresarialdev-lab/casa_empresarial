import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { exigirAcessoPagina } from '@/lib/auth/acesso'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { SummaryCard } from '@/components/modules/dashboard/summary-card'
import { ListEmpty, ListItem } from '@/components/ui/list-item'
import { ICONE_TIPO_SS, RESULTADO_ASO, ROTULO_TIPO_SS, seloValidade, situacaoValidade, type TipoSS } from '@/lib/seguranca'

export const dynamic = 'force-dynamic'

type Registro = { id: string; tipo: TipoSS; titulo: string; data: string | null; data_vencimento: string | null; resultado: string | null; observacao: string | null }

const fmt = (d: string | null) => (d ? d.split('-').reverse().join('/') : null)

// Os próprios registros de segurança e saúde: ASOs, treinamentos, EPIs, vacinas e incidentes, com a validade
export default async function MinhaSaudePage() {
  await exigirAcessoPagina('visao-geral.bater-ponto')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const companyId = (await cookies()).get('active_company_id')?.value
  if (!companyId) redirect('/dashboard')

  const admin = createAdminClient()
  const { data: ficha } = await admin.from('employees').select('id').eq('company_id', companyId).eq('profile_id', user.id).not('status', 'in', '(inativo,demitido)').limit(1).maybeSingle()
  const { data } = ficha
    ? await admin.from('health_safety_records').select('id, tipo, titulo, data, data_vencimento, resultado, observacao').eq('company_id', companyId).eq('employee_id', ficha.id).order('data', { ascending: false, nullsFirst: false })
    : { data: [] }
  const registros = (data ?? []) as Registro[]

  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
  const pendentes = registros.filter((r) => ['vencido', 'vencendo'].includes(situacaoValidade(r.data_vencimento, hoje)))
  const proximo = registros.filter((r) => r.data_vencimento && r.data_vencimento >= hoje).sort((a, b) => a.data_vencimento!.localeCompare(b.data_vencimento!))[0]
  const ultimoAso = registros.find((r) => r.tipo === 'aso')
  const vencidos = registros.filter((r) => situacaoValidade(r.data_vencimento, hoje) === 'vencido').length

  // Vencidos e vencendo primeiro, depois o resto pela data
  const ordenados = [...pendentes.sort((a, b) => a.data_vencimento!.localeCompare(b.data_vencimento!)), ...registros.filter((r) => !pendentes.includes(r))]

  return (
    <div className="w-full">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>Minha saúde e segurança</h1>
        <Breadcrumb />
      </div>

      {!ficha ? (
        <div className="app-card p-5">
          <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-muted)' }}>Seu usuário não está ligado a uma ficha da Equipe.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <SummaryCard icon="stethoscope" title="Último ASO" value={ultimoAso ? (ultimoAso.resultado ? RESULTADO_ASO[ultimoAso.resultado] ?? ultimoAso.resultado : 'Registrado') : '—'} caption={ultimoAso ? `${ultimoAso.titulo}${ultimoAso.data ? ` · ${fmt(ultimoAso.data)}` : ''}` : 'Nenhum ASO registrado'} />
            <SummaryCard icon="calendar" title="Próximo vencimento" value={proximo ? fmt(proximo.data_vencimento)! : '—'} caption={proximo ? proximo.titulo : 'Nada para renovar'} accent={proximo && situacaoValidade(proximo.data_vencimento, hoje) === 'vencendo' ? 'yellow' : undefined} delay={60} />
            <SummaryCard icon="alarm" title="Vencidos" value={vencidos} caption={vencidos ? 'Procure a área de Pessoas' : 'Tudo em dia'} accent={vencidos ? 'red' : undefined} delay={120} />
          </div>

          <div className="app-card p-5 flex flex-col gap-4">
            <p className="text-sm font-semibold" style={{ color: 'var(--color-sidebar-text)' }}>
              {registros.length === 0 ? 'Nenhum registro ainda' : `${registros.length} ${registros.length === 1 ? 'registro' : 'registros'}`}
            </p>
            <ul className="flex flex-col gap-3">
              {registros.length === 0 && <ListEmpty>Seus exames, treinamentos, EPIs e vacinas aparecem aqui quando a área de Pessoas registrar.</ListEmpty>}
              {ordenados.map((r) => {
                const selo = seloValidade(r.data_vencimento, hoje)
                return (
                  <ListItem
                    key={r.id}
                    icon={ICONE_TIPO_SS[r.tipo] ?? 'file'}
                    title={r.titulo}
                    subtitle={[ROTULO_TIPO_SS[r.tipo] ?? r.tipo, fmt(r.data), r.resultado ? RESULTADO_ASO[r.resultado] ?? r.resultado : null, r.observacao].filter(Boolean).join(' · ')}
                    aside={selo ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap" style={{ backgroundColor: selo.fundo, color: selo.cor }}>{selo.texto}</span> : undefined}
                    actionsLabel={r.titulo}
                    actions={[]}
                  />
                )
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
