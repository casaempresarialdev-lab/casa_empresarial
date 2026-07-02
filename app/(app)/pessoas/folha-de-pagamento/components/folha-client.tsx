'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { pdf } from '@react-pdf/renderer'
import { Button } from '@/components/ui/button'
import { RelatorioPdf } from './relatorio-folha-pdf'
import type { EmployeeForPayroll } from '../queries'
import type { AliquotaRow } from '../../encargos/queries'
import type { Company } from '../../../empresa/queries'

const DIAS_UTEIS = 22

// ── INSS empregado 2024 — tabela progressiva (estimativa da prévia) ──────────
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

// ── IRRF 2024 — estimativa após INSS e dedução por dependente ────────────────
const IRRF_FAIXAS = [
  { limite: 2259.20,  aliq: 0,     deduz: 0 },
  { limite: 2826.65,  aliq: 0.075, deduz: 169.44 },
  { limite: 3751.05,  aliq: 0.15,  deduz: 381.44 },
  { limite: 4664.68,  aliq: 0.225, deduz: 662.77 },
  { limite: Infinity, aliq: 0.275, deduz: 896.00 },
]
const DEP_DEDUCAO = 189.59
function calcIrrf(bruto: number, inss: number, dependentes: number): number {
  const base = bruto - inss - dependentes * DEP_DEDUCAO
  for (const f of IRRF_FAIXAS) {
    if (base <= f.limite) return Math.max(0, Math.round((base * f.aliq - f.deduz) * 100) / 100)
  }
  return 0
}

// ── Encargos / FGTS ──────────────────────────────────────────────────────────
const FALLBACK_ALIQUOTAS: AliquotaRow[] = [
  { id: '', company_id: '', nome: 'FGTS', percentual: 8.00, ativo: true, ordem: 1, created_at: '' },
  { id: '', company_id: '', nome: 'INSS Patronal', percentual: 20.00, ativo: true, ordem: 2, created_at: '' },
  { id: '', company_id: '', nome: 'RAT/FAP', percentual: 2.00, ativo: true, ordem: 3, created_at: '' },
  { id: '', company_id: '', nome: 'Sistema S', percentual: 5.80, ativo: true, ordem: 4, created_at: '' },
  { id: '', company_id: '', nome: '13º Salário', percentual: 8.33, ativo: true, ordem: 5, created_at: '' },
  { id: '', company_id: '', nome: 'Férias + 1/3', percentual: 11.11, ativo: true, ordem: 6, created_at: '' },
]

const RE_FGTS = /fgts/i
function fgtsPercentual(aliquotas: AliquotaRow[]): number {
  const f = aliquotas.find(a => a.ativo && RE_FGTS.test(a.nome))
  return f ? f.percentual : 8
}
function outrosEncargos(salario: number, aliquotas: AliquotaRow[]): number {
  return aliquotas
    .filter(a => a.ativo && !RE_FGTS.test(a.nome))
    .reduce((s, a) => s + salario * (a.percentual / 100), 0)
}

// ── VA / VT a partir dos benefícios vinculados (fonte da verdade) ────────────
const RE_VT = /transp|\bvt\b|v\.?t\b/i
const RE_VA = /aliment|refei|\bva\b|\bvr\b|v\.?[ar]\b/i

function benefCost(eb: EmployeeForPayroll['employee_benefits'][number]): number {
  const v = eb.valor_override ?? eb.benefit.valor
  return eb.benefit.por_dia_trabalhado ? v * DIAS_UTEIS : v
}
function custoBeneficio(benefits: EmployeeForPayroll['employee_benefits'], re: RegExp): number {
  return benefits.filter(b => re.test(b.benefit.nome)).reduce((s, b) => s + benefCost(b), 0)
}
function descontoVA(benefits: EmployeeForPayroll['employee_benefits']): number {
  return benefits
    .filter(b => RE_VA.test(b.benefit.nome) && b.benefit.desconta_salario)
    .reduce((s, b) => s + benefCost(b), 0)
}

function fmtCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function mesAnoLabel(mesAno: string) {
  const [ano, mes] = mesAno.split('-')
  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
  return `${meses[parseInt(mes) - 1]} ${ano}`
}

type PayrollRow = ReturnType<typeof buildRow>

function buildRow(emp: EmployeeForPayroll, aliquotas: AliquotaRow[]) {
  const salario   = emp.salario ?? 0
  const pericul   = emp.tem_periculosidade ? Math.round(salario * 0.30 * 100) / 100 : 0
  const bruto     = salario + pericul
  const horaExtra = 0 // futuro: registro de ponto
  const brutoComExtra = bruto + horaExtra

  const inss = calcInssProgressivo(brutoComExtra)
  const irpf = calcIrrf(brutoComExtra, inss, emp.dependentes ?? 0)

  const custoVT = Math.round(custoBeneficio(emp.employee_benefits, RE_VT) * 100) / 100
  const custoVA = Math.round(custoBeneficio(emp.employee_benefits, RE_VA) * 100) / 100
  const desc6VT = Math.round(Math.min(salario * 0.06, custoVT) * 100) / 100
  const fixoVA  = Math.round(descontoVA(emp.employee_benefits) * 100) / 100

  const liquido = Math.max(0, brutoComExtra - inss - irpf - desc6VT - fixoVA)

  const fgtsPct = fgtsPercentual(aliquotas)
  const fgts    = Math.round(brutoComExtra * (fgtsPct / 100) * 100) / 100
  const outros  = Math.round(outrosEncargos(brutoComExtra, aliquotas) * 100) / 100

  const custoTotal = brutoComExtra + fgts + outros + custoVA + custoVT - desc6VT - fixoVA

  return {
    emp, salario, pericul, bruto: brutoComExtra, horaExtra,
    inss, irpf, desc6VT, fixoVA, liquido,
    fgts, fgtsPct, custoVA, custoVT, custoTotal,
  }
}


interface Props {
  employees: EmployeeForPayroll[]
  aliquotas: AliquotaRow[]
  mesAno: string
  company: Company | null
}

export function FolhaClient({ employees, aliquotas: rawAliquotas, mesAno, company }: Props) {
  const router = useRouter()
  const [mes, setMes] = useState(mesAno.split('-')[1])
  const [ano, setAno] = useState(mesAno.split('-')[0])

  const effectiveAliquotas = rawAliquotas.length > 0 ? rawAliquotas : FALLBACK_ALIQUOTAS
  const rows = employees.map(emp => buildRow(emp, effectiveAliquotas))
  const [pdfLoading, setPdfLoading] = useState(false)

  function navigate(newMes: string, newAno: string) {
    router.push(`/pessoas/folha-de-pagamento?mes=${newMes}&ano=${newAno}`)
  }
  function prevMonth() {
    const d = new Date(parseInt(ano), parseInt(mes) - 2, 1)
    const m = String(d.getMonth() + 1).padStart(2, '0'); const a = String(d.getFullYear())
    setMes(m); setAno(a); navigate(m, a)
  }
  function nextMonth() {
    const d = new Date(parseInt(ano), parseInt(mes), 1)
    const m = String(d.getMonth() + 1).padStart(2, '0'); const a = String(d.getFullYear())
    setMes(m); setAno(a); navigate(m, a)
  }
  async function handleExportPdf() {
    setPdfLoading(true)
    try {
      const label = mesAnoLabel(mesAno)
      const geradoEm = new Date().toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
      const pdfRows = rows.map(r => ({
        nome: r.emp.nome,
        cpf: r.emp.cpf,
        regime: r.emp.tipo_contrato ?? '',
        cargo: r.emp.cargo,
        bruto: r.bruto,
        inss: r.inss,
        irpf: r.irpf,
        desc6VT: r.desc6VT,
        fixoVA: r.fixoVA,
        liquido: r.liquido,
        fgts: r.fgts,
        custoVA: r.custoVA,
        custoVT: r.custoVT,
        custoTotal: r.custoTotal,
        statusContrato: r.emp.status_contrato,
        dataAdmissao: r.emp.data_admissao,
        vctoFerias: r.emp.vcto_ferias,
        concederAte: r.emp.conceder_ferias_ate,
        exame: r.emp.exame_periodico,
      }))
      const blob = await pdf(
        <RelatorioPdf
          company={company}
          rows={pdfRows}
          totals={tot}
          mesAnoLabel={label}
          geradoEm={geradoEm}
        />
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `folha-${label.replace(' ', '-')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setPdfLoading(false)
    }
  }

  const tot = rows.reduce(
    (t, r) => ({
      bruto:   t.bruto + r.bruto,
      inss:    t.inss + r.inss,
      irpf:    t.irpf + r.irpf,
      liquido: t.liquido + r.liquido,
      fgts:    t.fgts + r.fgts,
      custo:   t.custo + r.custoTotal,
    }),
    { bruto: 0, inss: 0, irpf: 0, liquido: 0, fgts: 0, custo: 0 }
  )

  const TH: React.CSSProperties = {
    color: 'var(--color-text-secondary)',
    fontSize: '0.68rem',
    fontWeight: 600,
    padding: '8px 12px',
    whiteSpace: 'nowrap',
    backgroundColor: 'var(--color-bg-surface)',
  }
  const TD: React.CSSProperties = { padding: '10px 12px', fontSize: '0.72rem', whiteSpace: 'nowrap' }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
            Folha de Pagamento
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Visão de folha e custo da equipe — gerada a partir do cadastro de funcionários
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
          {rows.length > 0 && (
            <Button variant="ghost" onClick={handleExportPdf} loading={pdfLoading}>↓ PDF</Button>
          )}
        </div>
      </div>

      {/* Aviso de estimativas */}
      <div className="mb-4 p-3 rounded-lg text-xs" style={{ backgroundColor: '#EBF5FB', color: '#2471A3' }}>
        Valores estimados a partir do cadastro. INSS e IRPF pela tabela progressiva 2024 (IRPF deduz dependentes). Periculosidade = 30% do salário quando configurada. VA/VT vêm dos benefícios vinculados; 6% Prop. VT = menor entre 6% do salário e o custo do VT. Hora extra será integrada ao registro de ponto.
        {rawAliquotas.length === 0 && ' Encargos usando alíquotas padrão CLT — personalize em Encargos.'}
      </div>

      {/* Grid de folha */}
      <div className="rounded-xl border overflow-x-auto" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th style={{ ...TH, textAlign: 'left', minWidth: 200 }}>Nome</th>
              <th style={{ ...TH, textAlign: 'right', minWidth: 120 }}>Salário Bruto</th>
              <th style={{ ...TH, textAlign: 'right', minWidth: 110 }}>Hora Extra</th>
              <th style={{ ...TH, textAlign: 'right', minWidth: 105 }}>Alimentação</th>
              <th style={{ ...TH, textAlign: 'right', minWidth: 105 }}>Transporte</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-12 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  Nenhum funcionário ativo com salário cadastrado.
                </td>
              </tr>
            )}
            {rows.map((r, idx) => {
              const rowBg = idx % 2 === 0 ? 'white' : '#FAFAFA'
              const muted = 'var(--color-text-muted)'
              return (
                <tr key={r.emp.id} className="border-t" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: rowBg }}>
                  <td style={{ ...TD, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                    {r.emp.nome}
                  </td>
                  <td style={{ ...TD, textAlign: 'right', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    {fmtCurrency(r.bruto)}
                    {r.pericul > 0 && <div style={{ fontSize: '0.6rem', color: '#E67E22', fontWeight: 500 }}>+peric. {fmtCurrency(r.pericul)}</div>}
                  </td>
                  <td style={{ ...TD, textAlign: 'right', color: muted }}>{r.horaExtra > 0 ? fmtCurrency(r.horaExtra) : '—'}</td>
                  <td style={{ ...TD, textAlign: 'right', color: r.custoVA > 0 ? 'var(--color-text-secondary)' : muted }}>{r.custoVA > 0 ? fmtCurrency(r.custoVA) : '—'}</td>
                  <td style={{ ...TD, textAlign: 'right', color: r.custoVT > 0 ? 'var(--color-text-secondary)' : muted }}>{r.custoVT > 0 ? fmtCurrency(r.custoVT) : '—'}</td>
                </tr>
              )
            })}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr style={{ backgroundColor: 'var(--color-bg-surface)', borderTop: '2px solid #E5E7EB' }}>
                <td style={{ ...TD, fontWeight: 700, color: 'var(--color-text-secondary)' }}>TOTAL — {rows.length}</td>
                <td style={{ ...TD, textAlign: 'right', fontWeight: 700, color: 'var(--color-text-primary)' }}>{fmtCurrency(tot.bruto)}</td>
                <td />
                <td />
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Exportar para contabilidade */}
      {rows.length > 0 && (
        <div className="mt-4 flex items-center justify-between p-4 rounded-xl border"
          style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Enviar para a contabilidade</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              Exporta a folha de {mesAnoLabel(mesAno)} com dados da empresa, resumo executivo e todas as seções.
            </p>
          </div>
          <Button variant="ghost" onClick={handleExportPdf} loading={pdfLoading}>↓ PDF</Button>
        </div>
      )}
    </>
  )
}
