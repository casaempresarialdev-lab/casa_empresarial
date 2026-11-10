'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { ModalFerias } from '@/components/modules/ferias/modal-ferias'
import { SummaryCard } from '@/components/modules/dashboard/summary-card'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { FilterResult, FilterSelect, SearchField } from '@/components/ui/filter-select'
import { Tabs } from '@/components/ui/form-steps'
import { ListEmpty, ListItem } from '@/components/ui/list-item'
import { Modal } from '@/components/ui/modal'
import { somarDias } from '@/lib/escala/periodo'
import { ROTULO_SITUACAO, ROTULO_STATUS, calcularPeriodos, fimDasFerias, fmt, type ConfigFerias } from '@/lib/ferias/regras'
import { toast } from '@/lib/toast'
import { cancelarFeriasAction, decidirFeriasAction, programarFeriasAction, reciboFeriasAction } from '../actions'
import { baixarHolerite } from '@/components/modules/folha/baixar-holerite'
import type { Company } from '../../../empresa/queries'
import type { FeriasEquipe, PessoaFerias } from '../queries'

const FMT_DATA_HORA = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })

function Selo({ texto, fundo, cor }: { texto: string; fundo: string; cor: string }) {
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap" style={{ backgroundColor: fundo, color: cor }}>{texto}</span>
}

const FILTRO_PROGRAMACAO = [
  { value: 'proximas', label: 'Em andamento e próximas' },
  { value: 'passadas', label: 'Concluídas' },
  { value: 'canceladas', label: 'Canceladas e recusadas' },
]

// Gestão de férias da equipe: pedidos para aprovar, programação e os períodos aquisitivos de cada pessoa
export function FeriasClient({ companyId, pessoas, ferias, config, company, responsavel }: {
  companyId: string; pessoas: PessoaFerias[]; ferias: FeriasEquipe[]; config: ConfigFerias; company: Company | null; responsavel: 'sistema' | 'contabilidade'
}) {
  async function baixarRecibo(f: FeriasEquipe) {
    try {
      await toast.promise((async () => {
        const r = await reciboFeriasAction(companyId, f.id)
        if ('error' in r) return r
        await baixarHolerite({ company, employee: r.employee, competencia: `Férias de ${fmt(f.data_inicio)} a ${fmt(fimDasFerias(f.data_inicio, f.dias))}`, documento: r.recibo, responsavel, pagamentoEm: r.recibo.resumo.pagamentoEm }, `recibo-ferias-${f.data_inicio}-${r.employee.nome.split(' ')[0].toLowerCase()}`)
        return { success: true as const }
      })(), { loading: 'Gerando o recibo…', success: 'Recibo de férias baixado.', error: 'Não foi possível gerar o recibo.' })
    } catch {
      // A mensagem de erro já apareceu
    }
  }

  const router = useRouter()
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
  const [aba, setAba] = useState(0)
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState('proximas')
  const [programar, setProgramar] = useState<PessoaFerias[] | null>(null)
  const [recusar, setRecusar] = useState<FeriasEquipe | null>(null)
  const [resposta, setResposta] = useState('')
  const [cancelar, setCancelar] = useState<FeriasEquipe | null>(null)
  const [processando, setProcessando] = useState<string | null>(null)

  const nomeDe = useMemo(() => new Map(pessoas.map((p) => [p.id, p.nome])), [pessoas])
  const feriasDe = useCallback((id: string) => ferias.filter((f) => f.employee_id === id), [ferias])
  const periodosDe = useMemo(() => new Map(pessoas.map((p) => [p.id, calcularPeriodos(p.data_admissao, hoje, feriasDe(p.id))])), [pessoas, hoje, feriasDe])

  const q = busca.trim().toLowerCase()
  const combina = (id: string) => !q || (nomeDe.get(id) ?? '').toLowerCase().includes(q)

  const pedidos = ferias.filter((f) => f.status === 'solicitada').sort((a, b) => a.data_inicio.localeCompare(b.data_inicio))
  const aprovadas = ferias.filter((f) => f.status === 'aprovada')
  const emFerias = aprovadas.filter((f) => f.data_inicio <= hoje && fimDasFerias(f.data_inicio, f.dias) >= hoje)
  const proximas30 = aprovadas.filter((f) => f.data_inicio > hoje && f.data_inicio <= somarDias(hoje, 30))
  const vencendo = pessoas.filter((p) => (periodosDe.get(p.id) ?? []).some((x) => x.situacao === 'vencendo'))

  const programacao = ferias.filter((f) => combina(f.employee_id)).filter((f) => {
    const fim = fimDasFerias(f.data_inicio, f.dias)
    if (filtro === 'canceladas') return f.status === 'cancelada' || f.status === 'recusada'
    if (f.status !== 'aprovada') return false
    return filtro === 'passadas' ? fim < hoje : fim >= hoje
  }).sort((a, b) => (filtro === 'passadas' ? b.data_inicio.localeCompare(a.data_inicio) : a.data_inicio.localeCompare(b.data_inicio)))

  async function decidir(f: FeriasEquipe, decisao: 'aprovada' | 'recusada', texto?: string) {
    setProcessando(f.id)
    const r = await toast.promise(decidirFeriasAction(companyId, f.id, decisao, texto), {
      loading: decisao === 'aprovada' ? 'Aprovando…' : 'Recusando…',
      success: decisao === 'aprovada' ? `Férias de ${nomeDe.get(f.employee_id)} aprovadas.` : 'Pedido recusado.',
      error: 'Não foi possível concluir.',
    })
    setProcessando(null)
    if ('error' in r) return
    setRecusar(null)
    setResposta('')
    router.refresh()
  }

  async function confirmarCancelar() {
    if (!cancelar) return
    setProcessando(cancelar.id)
    const r = await toast.promise(cancelarFeriasAction(companyId, cancelar.id), { loading: 'Cancelando…', success: 'Férias canceladas.', error: 'Não foi possível cancelar.' })
    setProcessando(null)
    setCancelar(null)
    if (!('error' in r)) router.refresh()
  }

  const periodoTexto = (f: FeriasEquipe) => `${fmt(f.data_inicio)} a ${fmt(fimDasFerias(f.data_inicio, f.dias))} · ${f.dias} dias${f.dias_abono ? ` · ${f.dias_abono} vendidos` : ''}`

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>Férias</h1>
        <Breadcrumb />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <SummaryCard icon="calendar" title="Em férias hoje" value={emFerias.length} caption={emFerias.length === 1 ? 'pessoa' : 'pessoas'} />
        <SummaryCard icon="info" title="Pedidos para aprovar" value={pedidos.length} caption="enviados pelos colaboradores" accent={pedidos.length ? 'yellow' : undefined} delay={60} />
        <SummaryCard icon="star" title="Começam em 30 dias" value={proximas30.length} caption="férias aprovadas" delay={120} />
        <SummaryCard icon="alarm" title="Períodos vencendo" value={vencendo.length} caption="prazo de concessão perto do fim" accent={vencendo.length ? 'red' : undefined} delay={180} />
      </div>

      <Tabs labels={[pedidos.length ? `Pedidos (${pedidos.length})` : 'Pedidos', 'Períodos aquisitivos', 'Programação']} step={aba} onSelect={setAba} />

      <div className="app-card p-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <SearchField value={busca} onChange={setBusca} placeholder="Pesquisar por nome..." />
          {aba === 2 && <FilterSelect value={filtro} onChange={setFiltro} label="Filtrar" options={FILTRO_PROGRAMACAO} />}
          {busca && <FilterResult total={aba === 0 ? pedidos.filter((f) => combina(f.employee_id)).length : aba === 1 ? pessoas.filter((p) => combina(p.id)).length : programacao.length} onClear={() => setBusca('')} />}
        </div>
        {aba === 1 && <p className="text-sm -mt-1" style={{ color: 'var(--color-text-muted)' }}>Para programar férias, use o botão Programar da pessoa.</p>}

        {aba === 0 && (
          <ul className="flex flex-col gap-3">
            {pedidos.filter((f) => combina(f.employee_id)).length === 0 && <ListEmpty>Nenhum pedido aguardando aprovação.</ListEmpty>}
            {pedidos.filter((f) => combina(f.employee_id)).map((f) => (
              <li key={f.id} className="rounded-xl border bg-white px-4 py-3.5 flex flex-col gap-3" style={{ borderColor: 'var(--color-card-border)' }}>
                <div>
                  <p className="font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>{nomeDe.get(f.employee_id) ?? 'Funcionário'}</p>
                  <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>{periodoTexto(f)}</p>
                  {f.periodo_inicio && <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Período aquisitivo que começou em {fmt(f.periodo_inicio)}</p>}
                  {f.observacao && <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>Observação: {f.observacao}</p>}
                  <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Pedido em {FMT_DATA_HORA.format(new Date(f.created_at))}</p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" size="sm" style={{ color: '#B91C1C' }} disabled={!!processando} onClick={() => setRecusar(f)}>Recusar</Button>
                  <Button type="button" size="sm" loading={processando === f.id} disabled={!!processando} onClick={() => decidir(f, 'aprovada')}>Aprovar</Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {aba === 2 && (
          <ul className="flex flex-col gap-3">
            {programacao.length === 0 && <ListEmpty>Nenhuma férias neste filtro.</ListEmpty>}
            {programacao.map((f) => {
              const fim = fimDasFerias(f.data_inicio, f.dias)
              const selo = f.status === 'aprovada'
                ? f.data_inicio <= hoje && fim >= hoje ? { texto: 'Em férias', fundo: '#DCFCE7', cor: '#15803D' } : fim < hoje ? { texto: 'Concluída', fundo: '#F3F4F6', cor: '#6B7280' } : { texto: 'Programada', fundo: 'var(--color-brand-light)', cor: 'var(--color-brand)' }
                : ROTULO_STATUS[f.status]
              return (
                <ListItem
                  key={f.id}
                  icon="calendar"
                  title={nomeDe.get(f.employee_id) ?? 'Funcionário'}
                  subtitle={`${periodoTexto(f)}${f.resposta ? ` · ${f.resposta}` : ''}`}
                  aside={<Selo {...selo} />}
                  actionsLabel={nomeDe.get(f.employee_id) ?? 'férias'}
                  onClick={f.status === 'aprovada' ? () => baixarRecibo(f) : undefined}
                  actions={[
                    ...(f.status === 'aprovada' ? [{ icon: 'download' as const, label: 'Baixar recibo de férias', onClick: () => baixarRecibo(f) }] : []),
                    ...(f.status === 'aprovada' && fim >= hoje ? [{ icon: 'trash' as const, label: 'Cancelar férias', tone: 'danger' as const, onClick: () => setCancelar(f) }] : []),
                  ]}
                />
              )
            })}
          </ul>
        )}

        {aba === 1 && (
          <ul className="flex flex-col gap-3">
            {pessoas.filter((p) => combina(p.id)).length === 0 && <ListEmpty>Ninguém encontrado.</ListEmpty>}
            {pessoas.filter((p) => combina(p.id)).map((p) => {
              const periodos = periodosDe.get(p.id) ?? []
              return (
                <li key={p.id} className="rounded-xl border bg-white px-4 py-3.5 flex flex-col gap-2" style={{ borderColor: 'var(--color-card-border)' }}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>{p.nome}</p>
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{p.data_admissao ? `Admissão em ${fmt(p.data_admissao)}` : 'Sem data de admissão na ficha'}</p>
                    </div>
                    {periodos.some((x) => x.saldo > 0) && <Button type="button" variant="secondary" size="sm" onClick={() => setProgramar([p])}>Programar</Button>}
                  </div>
                  {periodos.map((x) => (
                    <div key={x.inicio} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-secondary)' }}>
                      <span className="font-semibold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>{fmt(x.inicio)} a {fmt(x.fim)}</span>
                      <Selo {...ROTULO_SITUACAO[x.situacao]} />
                      <span>{x.situacao === 'em_aquisicao' ? `${x.mesesAdquiridos} de 12 meses` : `saldo de ${x.saldo} dias`}{x.reservados ? ` · ${x.reservados} em pedido` : ''}</span>
                      <span className="sm:ml-auto text-xs" style={{ color: 'var(--color-text-muted)' }}>conceder até {fmt(x.concessivoFim)}</span>
                    </div>
                  ))}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {programar && (
        <ModalFerias
          titulo="Programar férias"
          pessoas={programar}
          feriasDe={feriasDe}
          config={config}
          origem="gestor"
          acao={(d) => programarFeriasAction(companyId, d)}
          onClose={() => setProgramar(null)}
          onSalvo={() => { setProgramar(null); router.refresh() }}
        />
      )}

      <Modal open={!!recusar} onClose={() => { if (!processando) setRecusar(null) }} title="Recusar pedido de férias" description={recusar ? `${nomeDe.get(recusar.employee_id)} · ${periodoTexto(recusar)}` : undefined}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="ferias-resposta" className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Motivo da recusa (opcional)</label>
            <textarea id="ferias-resposta" rows={3} maxLength={500} value={resposta} onChange={(e) => setResposta(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]" style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', backgroundColor: '#fff' }} />
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>A pessoa vê esta resposta em Minhas férias.</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setRecusar(null)} disabled={!!processando}>Cancelar</Button>
            <Button type="button" variant="danger" loading={!!processando} onClick={() => recusar && decidir(recusar, 'recusada', resposta)}>Recusar</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!cancelar}
        onClose={() => { if (!processando) setCancelar(null) }}
        onConfirm={confirmarCancelar}
        loading={!!processando}
        title="Cancelar férias"
        confirmLabel="Cancelar férias"
        message={<p>Cancelar as férias de <strong>{cancelar ? nomeDe.get(cancelar.employee_id) : ''}</strong>? Os dias voltam ao saldo do período e contam normalmente no ponto, e o recibo de férias sai do fluxo de caixa.</p>}
      />
    </>
  )
}
