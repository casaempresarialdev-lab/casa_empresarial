'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { SummaryCard } from '@/components/modules/dashboard/summary-card'
import { AddButton } from '@/components/ui/add-button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { FilterResult, FilterSelect } from '@/components/ui/filter-select'
import { Tabs } from '@/components/ui/form-steps'
import { Icon } from '@/components/ui/icon'
import { ListEmpty, ListItem } from '@/components/ui/list-item'
import { Modal } from '@/components/ui/modal'
import { toast } from '@/lib/toast'
import { generateMonth } from '@/lib/escala/generate'
import type { ScheduleRule, ScheduleException, DayResult } from '@/lib/escala/generate'
import type { FeriadoEmpresa } from '@/lib/escala/feriados'
import { minutosTrabalhados, rotuloBatida } from '@/lib/ponto'
import { faixasDeHorario, horaDe } from '@/lib/validations/ponto'
import { deleteTimeRecordAction } from '../actions'
import type { AjusteEquipe, AusenciaEquipe, TimeRecord } from '../queries'
import { AbaAusencias } from './aba-ausencias'
import { Aprovacoes } from './aprovacoes'
import { ModalPonto } from './modal-ponto'
import { LinkMapa, TextoLocal } from './texto-local'

interface Props {
  records: TimeRecord[]
  employees: { id: string; nome: string; cargo: string | null }[]
  rules: ScheduleRule[]
  exceptions: ScheduleException[]
  feriados: FeriadoEmpresa[]
  ajustes: AjusteEquipe[]
  ausencias: AusenciaEquipe[]
  companyId: string
  mes: number
  ano: number
  abaInicial: number
}

const MESES       = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DIAS_SEMANA = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

type Status =
  | 'ok'
  | 'atraso'
  | 'saida_antecipada'
  | 'incompleto'
  | 'em_andamento'
  | 'pendente'
  | 'ausente'
  | 'folga'
  | 'folga_extra'
  | 'ferias'
  | 'falta'
  | 'atestado'
  | 'previsto'
  | 'sem_escala'

type SituacaoInfo = { label: string; color: string; bg: string; status: Status }

type DayEntry = {
  empId: string
  empNome: string
  empCargo: string | null
  date: string
  dayResult: DayResult | null
  record: TimeRecord | null
  sit: SituacaoInfo
  isToday: boolean
  isFuture: boolean
}

type ModalState = { record: TimeRecord | null; empId?: string; date?: string; entrada?: string | null; saida?: string | null; tipo?: string }

const FILTRO_SITUACAO: { value: string; label: string }[] = [
  { value: 'todas', label: 'Todas as situações' },
  { value: 'ok', label: 'No prazo' },
  { value: 'atraso', label: 'Atraso' },
  { value: 'saida_antecipada', label: 'Saída antecipada' },
  { value: 'incompleto', label: 'Sem saída' },
  { value: 'ausente', label: 'Ausente' },
  { value: 'falta', label: 'Falta' },
  { value: 'atestado', label: 'Atestado' },
  { value: 'folga', label: 'Folga' },
  { value: 'ferias', label: 'Férias' },
]

const SKIP_METRICS = new Set<Status>(['folga', 'folga_extra', 'sem_escala', 'ferias', 'atestado', 'pendente'])

const BOTAO_CAIXA = 'inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border text-sm font-medium transition-colors hover:bg-gray-50 shrink-0'

const hora = (ts: string | null | undefined) => horaDe(ts) || '—'
const horariosDe = (r: TimeRecord | null) => (r?.batidas ?? []).map((b) => b.em)
/** A última batida só é saída quando o número de batidas é par */
const saidaDe = (h: string[]) => (h.length && h.length % 2 === 0 ? h[h.length - 1] : null)
const textoBatidas = (r: TimeRecord | null) => faixasDeHorario(horariosDe(r)).join('  ·  ') || '—'

/** Minutos do dia no horário de Brasília */
function minutosDoDia(ts: string) {
  const [h, m] = horaDe(ts).split(':').map(Number)
  return h * 60 + m
}

function getSituacao(
  record: TimeRecord | null,
  dayResult: DayResult | null,
  toleranciaMin: number,
  isToday: boolean,
  isFuture: boolean,
): SituacaoInfo {
  if (record?.tipo === 'ferias') return { label: 'Férias',  color: '#1E8449', bg: '#E9F7EF', status: 'ferias' }
  if (record?.tipo === 'falta')  return { label: 'Falta',   color: '#C0392B', bg: '#FDEDEC', status: 'falta'  }
  if (record?.tipo === 'atestado') return { label: 'Atestado', color: '#2471A3', bg: '#EBF5FB', status: 'atestado' }

  const noSchedule = !dayResult || dayResult.tipo === 'sem_regra'
  if (noSchedule) {
    if (!record) return { label: 'Sem escala', color: '#BDC3C7', bg: '#F8F9FA', status: 'sem_escala' }
    return { label: 'Normal', color: '#17A589', bg: '#EAF4F4', status: 'ok' }
  }

  if (dayResult.tipo === 'folga') {
    if (!record || record.tipo === 'folga')
      return { label: 'Folga', color: '#7F8C8D', bg: '#F2F3F4', status: 'folga' }
    return { label: 'Extra na folga', color: '#2471A3', bg: '#EBF5FB', status: 'folga_extra' }
  }

  const horarios = horariosDe(record)
  const saida = saidaDe(horarios)

  if (!record || !horarios.length) {
    if (isFuture) return { label: 'Previsto',   color: '#2471A3', bg: '#EBF5FB', status: 'previsto'   }
    if (isToday)  return { label: 'Pendente', color: '#7F8C8D', bg: '#F2F3F4', status: 'pendente' }
    return { label: 'Ausente', color: '#C0392B', bg: '#FDEDEC', status: 'ausente' }
  }

  if (!saida) {
    if (isToday) return { label: 'Em andamento', color: '#D35400', bg: '#FDEBD0', status: 'em_andamento' }
    return { label: 'Sem saída', color: '#E67E22', bg: '#FDEBD0', status: 'incompleto' }
  }

  if (record.tipo === 'folga') return { label: 'Folga não prevista', color: '#8E44AD', bg: '#F4ECF7', status: 'folga_extra' }

  let isLate = false, lateMin = 0, isEarlyOut = false

  if (dayResult.hora_entrada) {
    const [eh, em] = dayResult.hora_entrada.split(':').map(Number)
    lateMin = minutosDoDia(horarios[0]) - (eh * 60 + em)
    if (lateMin > toleranciaMin) isLate = true
  }

  if (dayResult.hora_saida) {
    const [sh, sm] = dayResult.hora_saida.split(':').map(Number)
    if (minutosDoDia(saida) < sh * 60 + sm) isEarlyOut = true
  }

  if (isLate)     return { label: `Atraso ${lateMin}min`, color: '#D35400', bg: '#FDEBD0', status: 'atraso'           }
  if (isEarlyOut) return { label: 'Saída antecipada',     color: '#D35400', bg: '#FDEBD0', status: 'saida_antecipada' }
  return { label: 'No prazo', color: '#17A589', bg: '#EAF4F4', status: 'ok' }
}

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return `${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')}/${y}`
}

function weekday(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return DIAS_SEMANA[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
}

function horasTrabalhadas(r: TimeRecord | null) {
  const total = minutosTrabalhados(horariosDe(r))
  if (!total) return '—'
  const h = Math.floor(total / 60), min = total % 60
  return min ? `${h}h ${String(min).padStart(2, '0')}min` : `${h}h`
}

function getPrevistoLabel(dayResult: DayResult | null): string {
  if (!dayResult || dayResult.tipo === 'sem_regra') return '—'
  if (dayResult.tipo === 'folga') return 'Folga'
  const h = dayResult.hora_entrada?.slice(0, 5) ?? '?'
  const s = dayResult.hora_saida?.slice(0, 5) ?? '?'
  return `${h}–${s}`
}

function Situacao({ sit }: { sit: SituacaoInfo }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap" style={{ backgroundColor: sit.bg, color: sit.color }}>
      {sit.label}
    </span>
  )
}

function Dia({ date, hoje }: { date: string; hoje: boolean }) {
  return (
    <span className="w-11 text-center shrink-0">
      <span className="block text-lg font-extrabold leading-none" style={{ fontFamily: 'Manrope', color: hoje ? 'var(--color-brand)' : 'var(--color-text-primary)' }}>{date.slice(8)}</span>
      <span className="block text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{weekday(date)}</span>
    </span>
  )
}

function Campo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
      <div className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>{rotulo}</div>
      <div className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{valor}</div>
    </div>
  )
}

/** Localização e IP de cada batida: só aparecem aqui */
function OrigemBatidas({ r }: { r: TimeRecord }) {
  const legado = r.localizacao
  if (!r.batidas.length) return null
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>Registros e origem</p>
      {r.batidas.map((b, i) => {
        const o = b.origem
        return (
          <div key={i} className="p-3 rounded-xl text-sm" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
            <div className="flex justify-between gap-3 font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              <span>{rotuloBatida(i)}</span>
              <span className="tabular-nums">{hora(b.em)}</span>
            </div>
            {o ? (
              <div className="mt-1 flex flex-col gap-0.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                <span><TextoLocal local={o} /></span>
                <span>IP: {o.ip ?? 'não identificado'}</span>
              </div>
            ) : (
              <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>Sem localização e IP: lançamento manual ou registro anterior a este controle</p>
            )}
          </div>
        )
      })}
      {legado?.lat != null && legado.lng != null && (
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Localização do último registro (controle anterior): <LinkMapa lat={legado.lat} lng={legado.lng} texto={legado.endereco} />
        </p>
      )}
    </div>
  )
}

function ModalDetalhar({ entry, onClose }: { entry: DayEntry; onClose: () => void }) {
  const r = entry.record
  return (
    <Modal open onClose={onClose} title={entry.empNome} description={`${formatDate(entry.date)} · ${weekday(entry.date)}${entry.empCargo ? ` · ${entry.empCargo}` : ''}`}>
      <div className="flex flex-col gap-3">
        <div><Situacao sit={entry.sit} /></div>
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Previsto" valor={getPrevistoLabel(entry.dayResult)} />
          <Campo rotulo="Horas trabalhadas" valor={horasTrabalhadas(r)} />
        </div>
        {r?.observacao && <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Observação: {r.observacao}</p>}
        {r && <OrigemBatidas r={r} />}
      </div>
    </Modal>
  )
}

// Registro de ponto da equipe: lista do mês e aprovação dos ajustes pedidos pelos colaboradores
export function PontoClient({ records, employees, rules, exceptions, feriados, ajustes, ausencias, companyId, mes, ano, abaInicial }: Props) {
  const router = useRouter()

  const [aba, setAba] = useState(abaInicial)
  const [tolerancia, setTolerancia] = useState(10)
  const [filterEmployee, setFilterEmployee] = useState('')
  const [filterSituacao, setFilterSituacao] = useState('todas')
  const [modal, setModal] = useState<ModalState | null>(null)
  const [detalhe, setDetalhe] = useState<DayEntry | null>(null)
  const [excluir, setExcluir] = useState<DayEntry | null>(null)
  const [excluindo, setExcluindo] = useState(false)

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())

  const scheduleMap = useMemo(() => {
    const map = new Map<string, DayResult>()
    for (const emp of employees) {
      for (const d of generateMonth(rules, exceptions, mes, ano, emp.id, feriados)) map.set(`${emp.id}|${d.date}`, d)
    }
    return map
  }, [employees, rules, exceptions, feriados, mes, ano])

  const recordsMap = useMemo(() => {
    const map = new Map<string, TimeRecord>()
    for (const r of records) map.set(`${r.employee_id}|${r.data}`, r)
    return map
  }, [records])

  const dayEntries = useMemo(() => {
    const totalDias = new Date(ano, mes, 0).getDate()
    const emps = filterEmployee ? employees.filter(e => e.id === filterEmployee) : employees
    const entries: DayEntry[] = []

    for (const emp of emps) {
      for (let d = 1; d <= totalDias; d++) {
        const dateStr   = `${ano}-${String(mes).padStart(2,'0')}-${String(d).padStart(2,'0')}`
        const isToday   = dateStr === today
        const isFuture  = dateStr > today
        const dayResult = scheduleMap.get(`${emp.id}|${dateStr}`) ?? null
        const record    = recordsMap.get(`${emp.id}|${dateStr}`) ?? null
        const hasSchedule = dayResult && dayResult.tipo !== 'sem_regra'

        if (!hasSchedule && !record) continue
        if (!filterEmployee && (isFuture || (dayResult?.tipo === 'folga' && !record))) continue

        const sit = getSituacao(record, dayResult, tolerancia, isToday, isFuture)
        entries.push({ empId: emp.id, empNome: emp.nome, empCargo: emp.cargo, date: dateStr, dayResult, record, sit, isToday, isFuture })
      }
    }

    entries.sort((a, b) => b.date.localeCompare(a.date) || a.empNome.localeCompare(b.empNome))
    return entries
  }, [employees, scheduleMap, recordsMap, mes, ano, filterEmployee, tolerancia, today])

  const metrics = useMemo(() => {
    let expected = 0, present = 0, absent = 0, late = 0
    for (const e of dayEntries) {
      if (e.isFuture) continue
      if (SKIP_METRICS.has(e.sit.status)) continue
      expected++
      if (e.sit.status === 'ausente' || e.sit.status === 'falta') { absent++; continue }
      present++
      if (e.sit.status === 'atraso') late++
    }
    const rate = expected > 0 ? Math.round(present / expected * 100) : 100
    return { expected, present, absent, late, rate }
  }, [dayEntries])

  const visiveis = filterSituacao === 'todas' ? dayEntries : dayEntries.filter(e => e.sit.status === filterSituacao)
  const pendentes = ajustes.filter(a => a.status === 'pendente').length
  const ausenciasPendentes = ausencias.filter(a => a.status === 'pendente').length

  function navMes(delta: number) {
    let m = mes + delta, a = ano
    if (m < 1)  { m = 12; a-- }
    if (m > 12) { m = 1;  a++ }
    router.push(`/pessoas/registro-de-ponto?mes=${m}&ano=${a}`)
  }

  function abrirLancamento(e: DayEntry) {
    if (e.record) { setModal({ record: e.record }); return }
    setModal({
      record: null,
      empId: e.empId,
      date: e.date,
      entrada: e.dayResult?.hora_entrada ?? null,
      saida: e.dayResult?.hora_saida ?? null,
      tipo: e.dayResult?.tipo === 'folga' ? 'folga' : 'normal',
    })
  }

  async function confirmarExclusao() {
    const id = excluir?.record?.id
    if (!id) return
    setExcluindo(true)
    const r = await toast.promise(deleteTimeRecordAction(id), {
      loading: 'Excluindo o registro…',
      success: 'Registro de ponto excluído.',
      error: 'Não foi possível excluir o registro.',
    })
    setExcluindo(false)
    setExcluir(null)
    if (!('error' in r)) router.refresh()
  }

  async function exportarPDF() {
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ orientation: 'landscape' })
    doc.setFontSize(14)
    doc.text(`Registro de Ponto — ${MESES[mes - 1]} ${ano}`, 14, 16)

    const hasFuncCol = !filterEmployee
    const headers = [
      ...(hasFuncCol ? ['Funcionário'] : []),
      'Data', 'Previsto', 'Registros', 'Horas', 'Situação',
    ]
    const rows = visiveis.map(e => [
      ...(hasFuncCol ? [e.empNome] : []),
      `${formatDate(e.date)} ${weekday(e.date)}`,
      getPrevistoLabel(e.dayResult),
      textoBatidas(e.record),
      horasTrabalhadas(e.record),
      e.sit.label,
    ])

    const colW = hasFuncCol ? [44, 30, 24, 110, 22, 28] : [30, 24, 150, 22, 28]
    const rowH = 7
    let y = 24
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    let x = 10
    headers.forEach((h, i) => { doc.text(h, x + 2, y + 5); x += colW[i] })
    y += rowH
    doc.setFont('helvetica', 'normal')
    rows.forEach(row => {
      if (y > 190) { doc.addPage(); y = 14 }
      x = 10
      row.forEach((cell, i) => {
        doc.text(String(cell).slice(0, Math.floor(colW[i] / 1.5)), x + 2, y + 5)
        x += colW[i]
      })
      y += rowH
    })
    doc.save(`registro-ponto-${mes}-${ano}.pdf`)
  }

  async function exportarExcel() {
    const XLSX = await import('xlsx')
    const hasFuncCol = !filterEmployee
    const headers = [
      ...(hasFuncCol ? ['Funcionário'] : []),
      'Data', 'Dia', 'Previsto', 'Registros', 'Horas', 'Situação',
    ]
    const rows = visiveis.map(e => [
      ...(hasFuncCol ? [e.empNome] : []),
      formatDate(e.date),
      weekday(e.date),
      getPrevistoLabel(e.dayResult),
      textoBatidas(e.record),
      horasTrabalhadas(e.record),
      e.sit.label,
    ])
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Ponto')
    XLSX.writeFile(wb, `registro-ponto-${mes}-${ano}.xlsx`)
  }

  const seta = 'w-9 h-9 rounded-lg flex items-center justify-center transition-colors hover:bg-gray-100'
  const estiloBotao = { borderColor: 'var(--color-card-border)', color: 'var(--color-text-secondary)' }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>Registro de Ponto</h1>
        <Breadcrumb />
      </div>

      <Tabs
        labels={['Registros', pendentes ? `Aprovações (${pendentes})` : 'Aprovações', ausenciasPendentes ? `Atestados e ausências (${ausenciasPendentes})` : 'Atestados e ausências']}
        step={aba}
        onSelect={setAba}
      />

      {aba === 1 && <Aprovacoes ajustes={ajustes} companyId={companyId} />}
      {aba === 2 && <AbaAusencias ausencias={ausencias} employees={employees} companyId={companyId} />}
      {aba === 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
          <SummaryCard icon="star" title="Presença" value={`${metrics.rate}%`} caption="dos dias esperados" accent={metrics.rate < 75 ? 'red' : metrics.rate < 90 ? 'yellow' : undefined} />
          <SummaryCard icon="calendar" title="Dias esperados" value={metrics.expected} caption={`até hoje em ${MESES[mes - 1].toLowerCase()}`} delay={60} />
          <SummaryCard icon="check" title="Presentes" value={metrics.present} caption="dias com ponto" delay={120} />
          <SummaryCard icon="info" title="Ausências" value={metrics.absent} caption="faltas e dias sem ponto" accent={metrics.absent > 0 ? 'red' : undefined} delay={180} />
          <SummaryCard icon="alarm" title="Atrasos" value={metrics.late} caption={`acima de ${tolerancia} min de tolerância`} accent={metrics.late > 0 ? 'yellow' : undefined} delay={240} />
        </div>
      )}

      <div className={aba === 0 ? 'app-card p-5 flex flex-col gap-4' : 'hidden'}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1" style={{ color: 'var(--color-sidebar-text)' }}>
            <button type="button" onClick={() => navMes(-1)} aria-label="Mês anterior" className={seta}><Icon name="chevron-left" size={18} /></button>
            <span className="w-36 text-center text-sm font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>{MESES[mes - 1]} {ano}</span>
            <button type="button" onClick={() => navMes(1)} aria-label="Próximo mês" className={seta}><Icon name="chevron-right" size={18} /></button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={exportarPDF} className={BOTAO_CAIXA} style={estiloBotao}><Icon name="download" size={16} /> PDF</button>
            <button type="button" onClick={exportarExcel} className={BOTAO_CAIXA} style={estiloBotao}><Icon name="download" size={16} /> Excel</button>
            <AddButton onClick={() => setModal({ record: null })} label="Lançar ponto" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect
            value={filterEmployee}
            onChange={setFilterEmployee}
            label="Filtrar por funcionário"
            options={[{ value: '', label: 'Todos os funcionários' }, ...employees.map(e => ({ value: e.id, label: e.nome }))]}
          />
          <FilterSelect value={filterSituacao} onChange={setFilterSituacao} label="Filtrar por situação" options={FILTRO_SITUACAO} />
          <label className="flex items-center gap-1.5 h-9 px-3 rounded-lg border text-sm" style={estiloBotao}>
            Tolerância
            <input
              type="number" min="0" max="60" value={tolerancia}
              onChange={e => setTolerancia(parseInt(e.target.value) || 0)}
              className="w-10 text-center border-0 outline-none font-semibold bg-transparent"
              style={{ color: 'var(--color-text-primary)' }}
            />
            min
          </label>
          {(filterEmployee || filterSituacao !== 'todas') && (
            <FilterResult total={visiveis.length} onClear={() => { setFilterEmployee(''); setFilterSituacao('todas') }} />
          )}
        </div>

        <ul className="flex flex-col gap-3">
          {visiveis.length === 0 && <ListEmpty>Nenhum registro em {MESES[mes - 1]} de {ano}.</ListEmpty>}
          {visiveis.map(e => {
            const r = e.record
            const faixas = faixasDeHorario(horariosDe(r))
            const previsto = `Previsto ${getPrevistoLabel(e.dayResult)} · ${horasTrabalhadas(r)} trabalhadas`
            return (
              <ListItem
                key={`${e.empId}|${e.date}`}
                media={<Dia date={e.date} hoje={e.isToday} />}
                title={e.empNome}
                subtitle={<><span className="lg:hidden">{faixas.join(' · ') || 'Sem registros'}</span><span className="hidden lg:inline">{previsto}</span></>}
                aside={
                  <>
                    <span className="hidden lg:flex flex-wrap justify-end gap-x-4 gap-y-0.5 w-80 text-sm font-semibold tabular-nums" style={{ color: faixas.length ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
                      {faixas.length ? faixas.map((f, i) => <span key={i}>{f}</span>) : <span>--:--</span>}
                    </span>
                    <span className="lg:w-32 flex justify-end"><Situacao sit={e.sit} /></span>
                  </>
                }
                onClick={() => abrirLancamento(e)}
                actionsLabel={`${e.empNome} em ${formatDate(e.date)}`}
                actions={[
                  ...(r ? [{ icon: 'eye' as const, label: 'Detalhar', onClick: () => setDetalhe(e) }] : []),
                  { icon: 'pencil' as const, label: r ? 'Editar' : 'Lançar ponto', onClick: () => abrirLancamento(e) },
                  ...(r ? [{ icon: 'trash' as const, label: 'Excluir', tone: 'danger' as const, onClick: () => setExcluir(e) }] : []),
                ]}
              />
            )
          })}
        </ul>
      </div>

      <ModalPonto
        open={!!modal}
        onClose={() => setModal(null)}
        companyId={companyId}
        record={modal?.record ?? null}
        employees={employees}
        rules={rules}
        exceptions={exceptions}
        feriados={feriados}
        defaultMes={mes}
        defaultAno={ano}
        defaultEmployeeId={modal?.empId ?? null}
        defaultDate={modal?.date ?? null}
        defaultEntrada={modal?.entrada ?? null}
        defaultSaida={modal?.saida ?? null}
        defaultTipo={modal?.tipo ?? 'normal'}
      />

      {detalhe && <ModalDetalhar entry={detalhe} onClose={() => setDetalhe(null)} />}

      <ConfirmDialog
        open={!!excluir}
        onClose={() => { if (!excluindo) setExcluir(null) }}
        onConfirm={confirmarExclusao}
        loading={excluindo}
        title="Excluir registro de ponto"
        confirmLabel="Excluir"
        message={<p>Excluir o ponto de <strong>{excluir?.empNome}</strong> em {excluir ? formatDate(excluir.date) : ''}?</p>}
      />
    </>
  )
}
