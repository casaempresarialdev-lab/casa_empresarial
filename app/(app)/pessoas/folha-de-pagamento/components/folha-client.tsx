'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ModalFolha } from './modal-folha'
import { deletePayrollEntryAction, generatePayrollForMonthAction } from '../actions'
import type { PayrollEntry, EmployeeForPayroll } from '../queries'
import type { AliquotaRow } from '../../encargos/queries'

// INSS empregado 2024 — tabela progressiva (usado na Prévia como estimativa)
const INSS_FAIXAS = [
  { limite: 1412.00, aliq: 0.075 },
  { limite: 2666.68, aliq: 0.09 },
  { limite: 4000.03, aliq: 0.12 },
  { limite: 7786.02, aliq: 0.14 },
]
function calcInssProgressivo(salario: number): number {
  let inss = 0
  let limiteAnterior = 0
  const base = Math.min(salario, 7786.02)
  for (const { limite, aliq } of INSS_FAIXAS) {
    if (base <= limiteAnterior) break
    inss += (Math.min(base, limite) - limiteAnterior) * aliq
    limiteAnterior = limite
  }
  return Math.round(inss * 100) / 100
}

const DIAS_UTEIS = 22

const FALLBACK_ALIQUOTAS: AliquotaRow[] = [
  { id: '', company_id: '', nome: 'FGTS', percentual: 8.00, ativo: true, ordem: 1, created_at: '' },
  { id: '', company_id: '', nome: 'INSS Patronal', percentual: 20.00, ativo: true, ordem: 2, created_at: '' },
  { id: '', company_id: '', nome: 'RAT/FAP', percentual: 2.00, ativo: true, ordem: 3, created_at: '' },
  { id: '', company_id: '', nome: 'Sistema S', percentual: 5.80, ativo: true, ordem: 4, created_at: '' },
  { id: '', company_id: '', nome: '13º Salário', percentual: 8.33, ativo: true, ordem: 5, created_at: '' },
  { id: '', company_id: '', nome: 'Férias + 1/3', percentual: 11.11, ativo: true, ordem: 6, created_at: '' },
]

function calcBenefDesc(benefits: EmployeeForPayroll['employee_benefits']): number {
  return benefits
    .filter(eb => eb.benefit.desconta_salario)
    .reduce((s, eb) => {
      const v = eb.valor_override ?? eb.benefit.valor
      return s + (eb.benefit.por_dia_trabalhado ? v * DIAS_UTEIS : v)
    }, 0)
}

function calcBenefPatronal(benefits: EmployeeForPayroll['employee_benefits']): number {
  return benefits
    .filter(eb => !eb.benefit.desconta_salario)
    .reduce((s, eb) => {
      const v = eb.valor_override ?? eb.benefit.valor
      return s + (eb.benefit.por_dia_trabalhado ? v * DIAS_UTEIS : v)
    }, 0)
}

function calcEncargos(salario: number, aliquotas: AliquotaRow[]): number {
  return aliquotas
    .filter(a => a.ativo)
    .reduce((s, a) => s + salario * (a.percentual / 100), 0)
}

function fmtCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function mesAnoLabel(mesAno: string) {
  const [ano, mes] = mesAno.split('-')
  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
  return `${meses[parseInt(mes) - 1]} ${ano}`
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  rascunho: { label: 'Rascunho', bg: '#F4F6F7', text: '#717D7E' },
  fechado:  { label: 'Fechado',  bg: '#EBF5FB', text: '#2471A3' },
  pago:     { label: 'Pago',     bg: '#E9F7EF', text: '#1E8449' },
}

// ── CSV Export ──────────────────────────────────────────────────────────────
function buildCsv(entries: PayrollEntry[], mesAno: string): string {
  const header = [
    'Mês/Ano', 'Funcionário', 'Cargo',
    'Sal. Base', 'Periculosidade', 'HE Conv.', 'HE Feriado', 'Ad. Noturno', 'Outros Adic.',
    'INSS', 'IRRF', 'Vale-Transporte', 'Adiantamento', 'Faltas', 'Outros Desc.',
    'Sal. Líquido', 'Dias Trab.', 'Status',
  ].join(';')

  const rows = entries.map(e => [
    mesAno,
    e.employee?.nome ?? '',
    e.employee?.cargo ?? '',
    e.salario_base.toFixed(2).replace('.', ','),
    (e.periculosidade_valor ?? 0).toFixed(2).replace('.', ','),
    e.horas_extras.toFixed(2).replace('.', ','),
    (e.horas_extras_feriado ?? 0).toFixed(2).replace('.', ','),
    e.adicional_noturno.toFixed(2).replace('.', ','),
    e.bonus.toFixed(2).replace('.', ','),
    e.desconto_inss.toFixed(2).replace('.', ','),
    e.desconto_irrf.toFixed(2).replace('.', ','),
    e.desconto_vt.toFixed(2).replace('.', ','),
    (e.desconto_adiantamento ?? 0).toFixed(2).replace('.', ','),
    e.desconto_faltas.toFixed(2).replace('.', ','),
    e.desconto_outros.toFixed(2).replace('.', ','),
    e.salario_liquido.toFixed(2).replace('.', ','),
    e.dias_trabalhados != null ? String(e.dias_trabalhados) : '',
    e.status,
  ].join(';'))

  return [header, ...rows].join('\n')
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  entries: PayrollEntry[]
  employees: EmployeeForPayroll[]
  aliquotas: AliquotaRow[]
  companyId: string
  mesAno: string
}

export function FolhaClient({ entries, employees, aliquotas: rawAliquotas, companyId, mesAno }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<'holerites' | 'previa'>('holerites')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<PayrollEntry | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [generateMsg, setGenerateMsg] = useState('')

  const [mes, setMes] = useState(mesAno.split('-')[1])
  const [ano, setAno] = useState(mesAno.split('-')[0])

  const effectiveAliquotas = rawAliquotas.length > 0 ? rawAliquotas : FALLBACK_ALIQUOTAS

  function navigate(newMes: string, newAno: string) {
    router.push(`/pessoas/folha-de-pagamento?mes=${newMes}&ano=${newAno}`)
  }

  function prevMonth() {
    const d = new Date(parseInt(ano), parseInt(mes) - 2, 1)
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const a = String(d.getFullYear())
    setMes(m); setAno(a); navigate(m, a)
  }

  function nextMonth() {
    const d = new Date(parseInt(ano), parseInt(mes), 1)
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const a = String(d.getFullYear())
    setMes(m); setAno(a); navigate(m, a)
  }

  function openAdd() { setEditingEntry(null); setModalOpen(true) }
  function openEdit(e: PayrollEntry) { setEditingEntry(e); setModalOpen(true) }

  async function handleDelete(e: PayrollEntry) {
    if (!confirm(`Excluir holerite de ${e.employee?.nome ?? 'este funcionário'}?`)) return
    setDeletingId(e.id)
    const result = await deletePayrollEntryAction(e.id)
    setDeletingId(null)
    if ('error' in result) alert(result.error)
    else router.refresh()
  }

  async function handleGenerate() {
    setGenerating(true)
    setGenerateMsg('')
    const result = await generatePayrollForMonthAction(companyId, mesAno)
    setGenerating(false)
    if ('error' in result) {
      setGenerateMsg(`Erro: ${result.error}`)
    } else {
      const created = result.created ?? 0
      const skipped = result.skipped ?? 0
      if (created > 0) {
        setGenerateMsg(`${created} holerite(s) criado(s) em rascunho.${skipped > 0 ? ` ${skipped} já existia(m).` : ''}`)
        router.refresh()
        setTab('holerites')
      } else {
        setGenerateMsg('Todos os funcionários já têm holerite neste mês.')
      }
    }
  }

  function handleExportCsv() {
    const csv = buildCsv(entries, mesAno)
    const label = mesAnoLabel(mesAno).replace(' ', '-')
    downloadCsv(csv, `folha-${label}.csv`)
  }

  // ── Summary totals ──
  const totalBruto = entries.reduce((s, e) =>
    s + e.salario_base + (e.periculosidade_valor ?? 0) + e.horas_extras + (e.horas_extras_feriado ?? 0) + e.adicional_noturno + e.bonus, 0)
  const totalDescontos = entries.reduce((s, e) =>
    s + e.desconto_faltas + e.desconto_inss + e.desconto_irrf + e.desconto_vt + (e.desconto_adiantamento ?? 0) + e.desconto_outros, 0)
  const totalLiquido = entries.reduce((s, e) => s + e.salario_liquido, 0)

  const counts = {
    rascunho: entries.filter(e => e.status === 'rascunho').length,
    fechado:  entries.filter(e => e.status === 'fechado').length,
    pago:     entries.filter(e => e.status === 'pago').length,
  }

  // ── Prévia tab ──
  const entryByEmployee = new Map(entries.map(e => [e.employee_id, e]))

  const previewRows = employees.map(emp => {
    const sal = emp.salario ?? 0
    const pericul = emp.tem_periculosidade ? Math.round(sal * 0.30 * 100) / 100 : 0
    const bruto = sal + pericul
    const inss = calcInssProgressivo(bruto)
    const outrosDesc = Math.round(calcBenefDesc(emp.employee_benefits) * 100) / 100
    const liquido = Math.max(0, bruto - inss - outrosDesc)
    const encargos = calcEncargos(bruto, effectiveAliquotas)
    const benefPatronal = Math.round(calcBenefPatronal(emp.employee_benefits) * 100) / 100
    const custoTotal = bruto + encargos + benefPatronal
    return { emp, sal, pericul, bruto, inss, outrosDesc, liquido, encargos, benefPatronal, custoTotal, entry: entryByEmployee.get(emp.id) }
  })

  const semHolerite = previewRows.filter(r => !r.entry).length
  const prevTotals = previewRows.reduce(
    (t, r) => ({
      bruto:       t.bruto + r.bruto,
      pericul:     t.pericul + r.pericul,
      inss:        t.inss + r.inss,
      outros:      t.outros + r.outrosDesc,
      liquido:     t.liquido + r.liquido,
      encargos:    t.encargos + r.encargos,
      benefPat:    t.benefPat + r.benefPatronal,
      custo:       t.custo + r.custoTotal,
    }),
    { bruto: 0, pericul: 0, inss: 0, outros: 0, liquido: 0, encargos: 0, benefPat: 0, custo: 0 }
  )

  const TAB_BTN = (active: boolean): React.CSSProperties => ({
    padding: '0.5rem 1.25rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: active ? 'var(--color-primary-darker)' : 'var(--color-text-muted)',
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    borderBottom: active ? '2px solid var(--color-primary-darker)' : '2px solid transparent',
  })

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
            Folha de Pagamento
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Holerites mensais da equipe
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5" style={{ borderColor: 'var(--color-bg-surface)' }}>
            <button onClick={prevMonth} className="text-sm font-bold hover:opacity-70" style={{ color: 'var(--color-text-muted)' }}>‹</button>
            <span className="text-sm font-semibold min-w-[140px] text-center" style={{ color: 'var(--color-text-primary)' }}>
              {mesAnoLabel(mesAno)}
            </span>
            <button onClick={nextMonth} className="text-sm font-bold hover:opacity-70" style={{ color: 'var(--color-text-muted)' }}>›</button>
          </div>
          {tab === 'holerites' && entries.length > 0 && (
            <Button variant="ghost" onClick={handleExportCsv}>
              ↓ Exportar CSV
            </Button>
          )}
          <Button onClick={openAdd}>+ Novo holerite</Button>
        </div>
      </div>

      {/* Feedback da geração */}
      {generateMsg && (
        <div className="mb-3 p-3 rounded-lg flex items-center justify-between"
          style={{ backgroundColor: generateMsg.startsWith('Erro') ? '#FDEDEC' : '#E9F7EF', borderLeft: `3px solid ${generateMsg.startsWith('Erro') ? '#C0392B' : '#1E8449'}` }}>
          <p className="text-sm" style={{ color: generateMsg.startsWith('Erro') ? '#C0392B' : '#1E8449' }}>{generateMsg}</p>
          <button onClick={() => setGenerateMsg('')} className="text-xs ml-4" style={{ opacity: 0.6 }}>✕</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b mb-5" style={{ borderColor: 'var(--color-bg-surface)' }}>
        <button style={TAB_BTN(tab === 'holerites')} onClick={() => setTab('holerites')}>
          Holerites{entries.length > 0 ? ` (${entries.length})` : ''}
        </button>
        <button style={TAB_BTN(tab === 'previa')} onClick={() => setTab('previa')}>
          Prévia do mês
          {semHolerite > 0 && (
            <span className="ml-2 px-1.5 py-0.5 rounded-full text-xs"
              style={{ backgroundColor: '#FEF9E7', color: '#9A7D0A', fontSize: '0.7rem' }}>
              {semHolerite} sem holerite
            </span>
          )}
        </button>
      </div>

      {/* ────── ABA HOLERITES ────── */}
      {tab === 'holerites' && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="p-4 rounded-xl border" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Total bruto</p>
              <p className="text-xl font-bold mt-1" style={{ color: 'var(--color-text-primary)' }}>{fmtCurrency(totalBruto)}</p>
            </div>
            <div className="p-4 rounded-xl border" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Total descontos</p>
              <p className="text-xl font-bold mt-1" style={{ color: '#C0392B' }}>{fmtCurrency(totalDescontos)}</p>
            </div>
            <div className="p-4 rounded-xl border" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Total líquido</p>
              <p className="text-xl font-bold mt-1" style={{ color: '#1E8449' }}>{fmtCurrency(totalLiquido)}</p>
            </div>
          </div>

          <div className="flex gap-2 mb-4">
            {(['rascunho', 'fechado', 'pago'] as const).map(s =>
              counts[s] > 0 ? (
                <span key={s} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{ backgroundColor: STATUS_CONFIG[s].bg, color: STATUS_CONFIG[s].text }}>
                  {counts[s]} {STATUS_CONFIG[s].label}{counts[s] > 1 ? 's' : ''}
                </span>
              ) : null
            )}
          </div>

          <div className="rounded-xl border overflow-x-auto" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
            <table className="w-full min-w-[780px] text-sm">
              <thead style={{ backgroundColor: 'var(--color-bg-surface)' }}>
                <tr>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Funcionário</th>
                  <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Sal. base</th>
                  <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Proventos</th>
                  <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Descontos</th>
                  <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Líquido</th>
                  <th className="text-center px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Dias</th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                      Nenhum holerite para {mesAnoLabel(mesAno)}.
                    </td>
                  </tr>
                )}
                {entries.map(e => {
                  const cfg = STATUS_CONFIG[e.status]
                  const proventos = (e.periculosidade_valor ?? 0) + e.horas_extras + (e.horas_extras_feriado ?? 0) + e.adicional_noturno + e.bonus
                  const descontos = e.desconto_faltas + e.desconto_inss + e.desconto_irrf + e.desconto_vt + (e.desconto_adiantamento ?? 0) + e.desconto_outros
                  return (
                    <tr key={e.id} className="border-t" style={{ borderColor: 'var(--color-bg-surface)' }}>
                      <td className="px-4 py-3" style={{ color: 'var(--color-text-primary)' }}>
                        <div className="font-medium">{e.employee?.nome ?? '—'}</div>
                        {e.employee?.cargo && <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{e.employee.cargo}</div>}
                      </td>
                      <td className="px-4 py-3 text-right" style={{ color: 'var(--color-text-primary)' }}>{fmtCurrency(e.salario_base)}</td>
                      <td className="px-4 py-3 text-right" style={{ color: proventos > 0 ? '#1E8449' : 'var(--color-text-muted)' }}>
                        {proventos > 0 ? `+${fmtCurrency(proventos)}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right" style={{ color: descontos > 0 ? '#C0392B' : 'var(--color-text-muted)' }}>
                        {descontos > 0 ? `-${fmtCurrency(descontos)}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                        {fmtCurrency(e.salario_liquido)}
                      </td>
                      <td className="px-4 py-3 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {e.dias_trabalhados != null ? e.dias_trabalhados : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ backgroundColor: cfg.bg, color: cfg.text }}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(e)}>Editar</Button>
                          <Button variant="danger" size="sm" loading={deletingId === e.id} onClick={() => handleDelete(e)}>Excluir</Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Exportar para contabilidade */}
          {entries.length > 0 && (
            <div className="mt-4 flex items-center justify-between p-4 rounded-xl border"
              style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  Enviar para a contabilidade
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                  Exporta a folha do mês em CSV com todos os campos — envie para o contador processar.
                </p>
              </div>
              <Button variant="ghost" onClick={handleExportCsv}>
                ↓ Exportar CSV
              </Button>
            </div>
          )}
        </>
      )}

      {/* ────── ABA PRÉVIA ────── */}
      {tab === 'previa' && (
        <>
          <div className="grid grid-cols-4 gap-3 mb-5">
            <div className="p-4 rounded-xl border" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Total a pagar (líquido)</p>
              <p className="text-xl font-bold mt-1" style={{ color: '#1E8449' }}>{fmtCurrency(prevTotals.liquido)}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>o que o funcionário recebe</p>
            </div>
            <div className="p-4 rounded-xl border" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Bruto total (est.)</p>
              <p className="text-xl font-bold mt-1" style={{ color: 'var(--color-text-primary)' }}>{fmtCurrency(prevTotals.bruto)}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>inclui periculosidade</p>
            </div>
            <div className="p-4 rounded-xl border" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Encargos patronais (est.)</p>
              <p className="text-xl font-bold mt-1" style={{ color: '#C0392B' }}>{fmtCurrency(prevTotals.encargos)}</p>
            </div>
            <div className="p-4 rounded-xl border" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Custo total empresa</p>
              <p className="text-xl font-bold mt-1" style={{ color: 'var(--color-text-primary)' }}>{fmtCurrency(prevTotals.custo)}</p>
            </div>
          </div>

          <div className="mb-4 p-3 rounded-lg text-xs" style={{ backgroundColor: '#EBF5FB', color: '#2471A3' }}>
            Estimativas baseadas nos dados cadastrados. INSS calculado sobre o bruto (inclui periculosidade) pela tabela progressiva 2024. IRRF não estimado (varia com dependentes). Periculosidade = 30% do salário quando configurado no cadastro.
            {rawAliquotas.length === 0 && ' Encargos usando alíquotas padrão CLT — inicialize em Encargos para personalizar.'}
          </div>

          <div className="rounded-xl border overflow-x-auto mb-4" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
            <table className="w-full min-w-[900px] text-sm">
              <thead style={{ backgroundColor: 'var(--color-bg-surface)' }}>
                <tr>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Funcionário</th>
                  <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Salário</th>
                  <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Pericul.</th>
                  <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>INSS (est.)</th>
                  <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Outros desc.</th>
                  <th className="text-right px-4 py-3 font-medium" style={{ color: '#1E8449' }}>Líquido</th>
                  <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Custo total emp.</th>
                  <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Holerite</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                      Nenhum funcionário ativo com salário cadastrado.
                    </td>
                  </tr>
                )}
                {previewRows.map(({ emp, sal, pericul, inss, outrosDesc, liquido, custoTotal, entry }) => (
                  <tr key={emp.id} className="border-t" style={{ borderColor: 'var(--color-bg-surface)' }}>
                    <td className="px-4 py-3" style={{ color: 'var(--color-text-primary)' }}>
                      <div className="font-medium">{emp.nome}</div>
                      {emp.cargo && <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{emp.cargo}</div>}
                    </td>
                    <td className="px-4 py-3 text-right" style={{ color: 'var(--color-text-primary)' }}>{fmtCurrency(sal)}</td>
                    <td className="px-4 py-3 text-right text-xs" style={{ color: pericul > 0 ? '#E67E22' : 'var(--color-text-muted)' }}>
                      {pericul > 0 ? `+${fmtCurrency(pericul)}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-xs" style={{ color: '#C0392B' }}>-{fmtCurrency(inss)}</td>
                    <td className="px-4 py-3 text-right text-xs" style={{ color: outrosDesc > 0 ? '#C0392B' : 'var(--color-text-muted)' }}>
                      {outrosDesc > 0 ? `-${fmtCurrency(outrosDesc)}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-bold" style={{ color: '#1E8449' }}>
                      {fmtCurrency(liquido)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                      {fmtCurrency(custoTotal)}
                    </td>
                    <td className="px-4 py-3">
                      {entry ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ backgroundColor: STATUS_CONFIG[entry.status]?.bg ?? '#F4F6F7', color: STATUS_CONFIG[entry.status]?.text ?? '#717D7E' }}>
                          {STATUS_CONFIG[entry.status]?.label ?? entry.status}
                        </span>
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Sem holerite</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot style={{ backgroundColor: 'var(--color-bg-surface)' }}>
                <tr>
                  <td className="px-4 py-3 text-right font-semibold text-xs" colSpan={2} style={{ color: 'var(--color-text-secondary)' }}>TOTAIS</td>
                  <td className="px-4 py-3 text-right font-bold text-xs" style={{ color: '#E67E22' }}>
                    {prevTotals.pericul > 0 ? `+${fmtCurrency(prevTotals.pericul)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-xs" style={{ color: '#C0392B' }}>-{fmtCurrency(prevTotals.inss)}</td>
                  <td className="px-4 py-3 text-right font-bold text-xs" style={{ color: '#C0392B' }}>
                    {prevTotals.outros > 0 ? `-${fmtCurrency(prevTotals.outros)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-xs" style={{ color: '#1E8449' }}>{fmtCurrency(prevTotals.liquido)}</td>
                  <td className="px-4 py-3 text-right font-bold text-xs" style={{ color: 'var(--color-text-primary)' }}>{fmtCurrency(prevTotals.custo)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl border"
            style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                Gerar holerites em rascunho
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                {semHolerite > 0
                  ? `Cria ${semHolerite} holerite(s) com os valores estimados acima (periculosidade inclusa). Status: Rascunho.`
                  : 'Todos os funcionários já têm holerite neste mês.'}
              </p>
            </div>
            <Button onClick={handleGenerate} loading={generating} disabled={semHolerite === 0}>
              Gerar {semHolerite > 0 ? `${semHolerite} holerite(s)` : ''}
            </Button>
          </div>
        </>
      )}

      <ModalFolha
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        companyId={companyId}
        entry={editingEntry}
        employees={employees}
        mesAno={mesAno}
      />
    </>
  )
}
