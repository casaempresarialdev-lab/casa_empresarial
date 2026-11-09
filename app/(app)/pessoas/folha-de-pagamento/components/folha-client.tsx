'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { SummaryCard } from '@/components/modules/dashboard/summary-card'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { FilterResult, FilterSelect, SearchField } from '@/components/ui/filter-select'
import { Icon } from '@/components/ui/icon'
import { ListEmpty, ListItem } from '@/components/ui/list-item'
import { Modal } from '@/components/ui/modal'
import { toast } from '@/lib/toast'
import { calcularFolha, horas, type MotivoSemApuracao, type ResultadoFolha } from '@/lib/folha/calculo'
import { iniciais } from '../../funcionarios/components/ficha/ficha-config'
import type { Company } from '../../../empresa/queries'
import { fecharFolhaAction, reabrirFolhaAction } from '../actions'
import type { LinhaFolha } from '../queries'
import { ModalConferenciaFolha } from './modal-conferencia-folha'
import type { PayrollPdfRow } from './relatorio-folha-pdf'

interface Props {
  linhas: LinhaFolha[]
  fechada: boolean
  mesAno: string
  company: Company | null
  companyId: string
  readOnly: boolean
}

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

const SELO_MOTIVO: Partial<Record<MotivoSemApuracao, string>> = {
  sem_escala: 'Sem escala',
  sem_registros: 'Sem ponto no mês',
}

const FILTROS = [
  { value: 'todos', label: 'Todos' },
  { value: 'ocorrencias', label: 'Com ocorrências' },
  { value: 'atencao', label: 'Precisam de atenção' },
  { value: 'editados', label: 'Editados' },
]

type Item = LinhaFolha & { r: ResultadoFolha; editado: boolean; atencao: string | null; temOcorrencia: boolean }

function resumoPonto(l: Item) {
  const v = l.r.valores
  const he = l.ponto.he50Min + l.ponto.heFeriadoMin + l.ponto.heDomingoMin
  const partes = [
    v.desconto_faltas > 0 && plural(v.desconto_faltas, 'falta', 'faltas'),
    v.atestados > 0 && plural(v.atestados, 'atestado', 'atestados'),
    l.ponto.atrasoMin > 0 && `${horas(l.ponto.atrasoMin)} de atraso`,
    he > 0 && `${horas(he)} de hora extra`,
  ].filter(Boolean)
  return partes.length ? partes.join(' · ') : l.employee.cargo ?? 'Sem ocorrências'
}

function Selo({ children, alerta }: { children: React.ReactNode; alerta?: boolean }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap" style={alerta ? { backgroundColor: '#FEF3C7', color: '#B45309' } : { backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}>
      {children}
    </span>
  )
}

function Valor({ rotulo, valor, forte }: { rotulo: string; valor: number; forte?: boolean }) {
  return (
    <span className="text-right">
      <span className="block text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{rotulo}</span>
      <span className={`block text-sm tabular-nums whitespace-nowrap ${forte ? 'font-bold' : 'font-semibold'}`} style={{ color: forte ? 'var(--color-brand)' : 'var(--color-text-primary)', fontFamily: forte ? 'Manrope' : undefined }}>{moeda(valor)}</span>
    </span>
  )
}

// Folha do mês: tudo vem do ponto, da escala e dos benefícios; aqui só se confere, edita e fecha
export function FolhaClient({ linhas, fechada, mesAno, company, companyId, readOnly }: Props) {
  const router = useRouter()
  const [ano, mes] = mesAno.split('-').map(Number)
  const rotuloMes = `${MESES[mes - 1]} ${ano}`

  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState('todos')
  const [conferindo, setConferindo] = useState<LinhaFolha | null>(null)
  const [gerandoPdf, setGerandoPdf] = useState(false)
  const [confirmar, setConfirmar] = useState<'fechar' | 'reabrir' | null>(null)
  const [processando, setProcessando] = useState(false)

  const itens = useMemo<Item[]>(() => linhas.map((l) => {
    const r = calcularFolha(l.insumos, l.ponto, l.ajustes)
    const v = r.valores
    return {
      ...l,
      r,
      editado: Object.keys(l.ajustes).length > 0,
      atencao: l.ponto.incompletos > 0 ? plural(l.ponto.incompletos, 'ponto incompleto', 'pontos incompletos') : (l.ponto.motivo && SELO_MOTIVO[l.ponto.motivo]) || null,
      temOcorrencia: v.desconto_faltas + v.atestados + l.ponto.atrasoMin + l.ponto.he50Min + l.ponto.heFeriadoMin + l.ponto.heDomingoMin > 0,
    }
  }), [linhas])

  const totais = useMemo(() => itens.reduce((t, { r }) => ({
    bruto: t.bruto + r.bruto,
    descontos: t.descontos + r.descontos,
    liquido: t.liquido + r.liquido,
    encargos: t.encargos + r.fgts + r.outrosEncargos,
    fgts: t.fgts + r.fgts,
    custo: t.custo + r.custoTotal,
  }), { bruto: 0, descontos: 0, liquido: 0, encargos: 0, fgts: 0, custo: 0 }), [itens])

  const q = busca.toLowerCase()
  const visiveis = itens
    .filter((l) => !q || l.employee.nome.toLowerCase().includes(q) || (l.employee.cargo ?? '').toLowerCase().includes(q))
    .filter((l) => filtro === 'todos' || (filtro === 'ocorrencias' && l.temOcorrencia) || (filtro === 'atencao' && !!l.atencao) || (filtro === 'editados' && l.editado))

  const comAtencao = itens.filter((l) => l.atencao).length

  function navegar(delta: number) {
    const d = new Date(Date.UTC(ano, mes - 1 + delta, 1))
    router.push(`/pessoas/folha-de-pagamento?mes=${String(d.getUTCMonth() + 1).padStart(2, '0')}&ano=${d.getUTCFullYear()}`)
  }

  async function exportarPdf() {
    setGerandoPdf(true)
    try {
      const [{ pdf }, { RelatorioPdf }] = await Promise.all([import('@react-pdf/renderer'), import('./relatorio-folha-pdf')])
      const geradoEm = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date())
      const rows: PayrollPdfRow[] = itens.map(({ employee: e, insumos, ponto, r, observacao }) => ({
        nome: e.nome,
        cargo: e.cargo,
        salario: insumos.salario + r.periculosidade,
        diasTrabalhados: ponto.motivo ? null : ponto.diasTrabalhados,
        faltas: r.valores.desconto_faltas,
        atestados: r.valores.atestados,
        atrasos: r.valores.desconto_atrasos,
        atrasoMin: ponto.atrasoMin,
        he50: r.valores.horas_extras,
        he50Min: ponto.he50Min,
        heFeriado: r.valores.horas_extras_feriado,
        heFeriadoMin: ponto.heFeriadoMin,
        heDomingo: r.valores.horas_extras_domingo,
        heDomingoMin: ponto.heDomingoMin,
        comissao: r.valores.bonus,
        alimentacao: r.alimentacao,
        transporte: r.transporte,
        bruto: r.bruto,
        inss: r.inss,
        irrf: r.irrf,
        descVT: r.valores.desconto_vt,
        descVR: r.valores.desconto_vr,
        descOutros: r.valores.desconto_outros,
        adiantamento: r.valores.desconto_adiantamento,
        liquido: r.liquido,
        fgts: r.fgts,
        encargos: r.outrosEncargos,
        custoTotal: r.custoTotal,
        observacao,
      }))
      const blob = await pdf(<RelatorioPdf company={company} rows={rows} mesAnoLabel={rotuloMes} geradoEm={geradoEm} fechada={fechada} />).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `folha-${mesAno}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('[folha] PDF:', e)
      toast.error('Não foi possível gerar o PDF.')
    } finally {
      setGerandoPdf(false)
    }
  }

  async function executar() {
    const acao = confirmar
    if (!acao) return
    setProcessando(true)
    const r = await toast.promise(acao === 'fechar' ? fecharFolhaAction(companyId, mesAno) : reabrirFolhaAction(companyId, mesAno), {
      loading: acao === 'fechar' ? 'Fechando a folha…' : 'Reabrindo a folha…',
      success: acao === 'fechar' ? `Folha de ${rotuloMes} fechada.` : `Folha de ${rotuloMes} reaberta.`,
      error: 'Não foi possível concluir.',
    })
    setProcessando(false)
    setConfirmar(null)
    if (!('error' in r)) router.refresh()
  }

  const seta = 'w-9 h-9 rounded-lg flex items-center justify-center transition-colors hover:bg-gray-100'

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>Folha de Pagamento</h1>
        <Breadcrumb />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 gap-4 mb-6">
        <SummaryCard icon="users" title="Salários brutos" value={moeda(totais.bruto)} caption={plural(itens.length, 'pessoa na folha', 'pessoas na folha')} />
        <SummaryCard icon="wallet" title="Líquido a pagar" value={moeda(totais.liquido)} caption={`${moeda(totais.descontos)} de descontos`} delay={60} />
        <SummaryCard icon="file" title="FGTS e encargos" value={moeda(totais.encargos)} caption={`FGTS ${moeda(totais.fgts)}`} delay={120} />
        <SummaryCard icon="dollar" title="Custo total da empresa" value={moeda(totais.custo)} caption="Inclui encargos e benefícios" delay={180} />
      </div>

      <div className="app-card p-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1" style={{ color: 'var(--color-sidebar-text)' }}>
            <button type="button" onClick={() => navegar(-1)} aria-label="Mês anterior" className={seta}><Icon name="chevron-left" size={18} /></button>
            <span className="w-36 text-center text-sm font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>{rotuloMes}</span>
            <button type="button" onClick={() => navegar(1)} aria-label="Próximo mês" className={seta}><Icon name="chevron-right" size={18} /></button>
            <span className="ml-2"><Selo alerta={!fechada}>{fechada ? 'Fechada' : 'Em conferência'}</Selo></span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {itens.length > 0 && <Button type="button" variant="secondary" size="sm" loading={gerandoPdf} onClick={exportarPdf}><Icon name="download" size={16} /> Baixar PDF</Button>}
            {!readOnly && itens.length > 0 && (
              fechada
                ? <Button type="button" variant="secondary" size="sm" onClick={() => setConfirmar('reabrir')}>Reabrir folha</Button>
                : <Button type="button" size="sm" onClick={() => setConfirmar('fechar')}>Fechar folha</Button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect value={filtro} onChange={setFiltro} label="Filtrar" options={FILTROS} />
          <SearchField value={busca} onChange={setBusca} placeholder="Pesquisar por nome ou cargo..." />
          {(filtro !== 'todos' || busca) && <FilterResult total={visiveis.length} onClear={() => { setFiltro('todos'); setBusca('') }} />}
        </div>

        {!fechada && comAtencao > 0 && (
          <p className="text-sm rounded-lg px-3 py-2" style={{ backgroundColor: '#FEF3C7', color: '#B45309' }}>
            {plural(comAtencao, 'pessoa precisa', 'pessoas precisam')} de atenção antes do fechamento: há ponto incompleto, sem escala ou sem batidas no mês.
          </p>
        )}

        <ul className="flex flex-col gap-3">
          {visiveis.length === 0 && <ListEmpty>{itens.length === 0 ? 'Nenhum funcionário ativo com salário cadastrado.' : 'Nenhum funcionário encontrado.'}</ListEmpty>}
          {visiveis.map((l) => (
            <ListItem
              key={l.employee.id}
              media={
                <span className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold" style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}>
                  {iniciais(l.employee.nome)}
                </span>
              }
              title={l.employee.nome}
              subtitle={resumoPonto(l)}
              aside={
                <>
                  {l.atencao && <Selo alerta>{l.atencao}</Selo>}
                  {l.editado && <span className="hidden sm:inline"><Selo>Editado</Selo></span>}
                  <span className="hidden xl:grid grid-cols-2 gap-4 w-56">
                    <Valor rotulo="Bruto" valor={l.r.bruto} />
                    <Valor rotulo="Descontos" valor={l.r.descontos} />
                  </span>
                  <span className="xl:w-28"><Valor rotulo="Líquido" valor={l.r.liquido} forte /></span>
                </>
              }
              onClick={() => setConferindo(l)}
              actionsLabel={l.employee.nome}
              actions={[{ icon: fechada || readOnly ? 'eye' : 'pencil', label: fechada || readOnly ? 'Ver detalhes' : 'Conferir e editar', onClick: () => setConferindo(l) }]}
            />
          ))}
        </ul>

        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Estimativa para envio à contabilidade, com INSS e IRRF pelas tabelas de 2026. DSR, adicional noturno, férias e 13º não entram no cálculo.
        </p>
      </div>

      {conferindo && (
        <ModalConferenciaFolha
          key={conferindo.employee.id}
          linha={conferindo}
          companyId={companyId}
          mesAno={mesAno}
          somenteLeitura={fechada || readOnly}
          onClose={() => setConferindo(null)}
        />
      )}

      <Modal open={confirmar !== null} onClose={() => { if (!processando) setConfirmar(null) }} title={confirmar === 'fechar' ? `Fechar a folha de ${rotuloMes}` : `Reabrir a folha de ${rotuloMes}`}>
        <div className="flex flex-col gap-4">
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {confirmar === 'fechar'
              ? `Os valores ficam congelados e ${moeda(totais.liquido)} de salários, além dos benefícios, entram no fluxo de caixa como pagamentos pendentes.`
              : 'Os lançamentos pendentes desta folha saem do fluxo de caixa e os valores voltam a acompanhar o ponto.'}
          </p>
          {confirmar === 'fechar' && comAtencao > 0 && (
            <p className="text-sm rounded-lg px-3 py-2" style={{ backgroundColor: '#FEF3C7', color: '#B45309' }}>
              {plural(comAtencao, 'pessoa ainda precisa', 'pessoas ainda precisam')} de atenção. Os dias com ponto incompleto não entram no cálculo.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setConfirmar(null)} disabled={processando}>Cancelar</Button>
            <Button type="button" loading={processando} onClick={executar}>{confirmar === 'fechar' ? 'Fechar folha' : 'Reabrir folha'}</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
