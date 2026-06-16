'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createPayrollEntryAction, updatePayrollEntryAction } from '../actions'
import type { PayrollEntry, EmployeeForPayroll, BenefitForPayroll } from '../queries'

const DIAS_UTEIS_MES = 22

function benefitValue(eb: BenefitForPayroll): number {
  const v = eb.valor_override ?? eb.benefit.valor
  return eb.benefit.por_dia_trabalhado ? v * DIAS_UTEIS_MES : v
}

function calcBenefDesc(emp: EmployeeForPayroll): number {
  return emp.employee_benefits
    .filter(eb => eb.benefit.desconta_salario)
    .reduce((s, eb) => s + benefitValue(eb), 0)
}

function calcBenefPatronal(emp: EmployeeForPayroll): number {
  return emp.employee_benefits
    .filter(eb => !eb.benefit.desconta_salario)
    .reduce((s, eb) => s + benefitValue(eb), 0)
}

interface Props {
  open: boolean
  onClose: () => void
  companyId: string
  entry: PayrollEntry | null
  employees: EmployeeForPayroll[]
  mesAno: string
}

function fmt(n: number): string {
  return n > 0 ? n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''
}

function fmtCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function parseNum(s: string): number {
  return parseFloat(s.replace(',', '.')) || 0
}

export function ModalFolha({ open, onClose, companyId, entry, employees, mesAno }: Props) {
  const router = useRouter()
  const isEdit = !!entry

  // Proventos
  const [employeeId, setEmployeeId]               = useState('')
  const [salarioBase, setSalarioBase]             = useState('')
  const [periculosidade, setPericulosidade]       = useState('')
  const [horasExtras, setHorasExtras]             = useState('')
  const [horasExtrasFeriado, setHorasExtrasFer]  = useState('')
  const [adicionalNoturno, setAdicionalNoturno]   = useState('')
  const [bonus, setBonus]                         = useState('')
  // Descontos
  const [descontoInss, setDescontoInss]           = useState('')
  const [descontoIrrf, setDescontoIrrf]           = useState('')
  const [descontoVt, setDescontoVt]               = useState('')
  const [descontoAdiant, setDescontoAdiant]       = useState('')
  const [descontoFaltas, setDescontoFaltas]       = useState('')
  const [descontoOutros, setDescontoOutros]       = useState('')
  // Geral
  const [diasTrabalhados, setDiasTrabalhados]     = useState('')
  const [status, setStatus]                       = useState('rascunho')
  const [observacao, setObservacao]               = useState('')
  const [loading, setLoading]                     = useState(false)
  const [error, setError]                         = useState('')

  // Derived
  const baseNum    = parseNum(salarioBase)
  const pericNum   = parseNum(periculosidade)
  const extrasNum  = parseNum(horasExtras)
  const extFerNum  = parseNum(horasExtrasFeriado)
  const noturnoNum = parseNum(adicionalNoturno)
  const bonusNum   = parseNum(bonus)
  const inssNum    = parseNum(descontoInss)
  const irrfNum    = parseNum(descontoIrrf)
  const vtNum      = parseNum(descontoVt)
  const adiantNum  = parseNum(descontoAdiant)
  const faltasNum  = parseNum(descontoFaltas)
  const outrosNum  = parseNum(descontoOutros)

  const bruto  = baseNum + pericNum + extrasNum + extFerNum + noturnoNum + bonusNum
  const descontos = inssNum + irrfNum + vtNum + adiantNum + faltasNum + outrosNum
  const liquido = Math.max(0, bruto - descontos)

  const selectedEmp = employees.find(e => e.id === employeeId) ?? null

  function onEmployeeChange(id: string) {
    setEmployeeId(id)
    const emp = employees.find(e => e.id === id)
    if (emp && !isEdit) {
      const sal = emp.salario ?? 0
      setSalarioBase(sal > 0 ? fmt(sal) : '')
      // Auto-calc periculosidade (30% se aplicável)
      if (emp.tem_periculosidade && sal > 0) {
        setPericulosidade(fmt(Math.round(sal * 0.30 * 100) / 100))
      } else {
        setPericulosidade('')
      }
      const disc = calcBenefDesc(emp)
      setDescontoOutros(disc > 0 ? fmt(disc) : '')
    }
  }

  useEffect(() => {
    if (!open) return
    setError('')
    if (entry) {
      setEmployeeId(entry.employee_id)
      setSalarioBase(fmt(entry.salario_base))
      setPericulosidade(fmt(entry.periculosidade_valor ?? 0))
      setHorasExtras(fmt(entry.horas_extras))
      setHorasExtrasFer(fmt(entry.horas_extras_feriado ?? 0))
      setAdicionalNoturno(fmt(entry.adicional_noturno))
      setBonus(fmt(entry.bonus))
      setDescontoInss(fmt(entry.desconto_inss))
      setDescontoIrrf(fmt(entry.desconto_irrf))
      setDescontoVt(fmt(entry.desconto_vt))
      setDescontoAdiant(fmt(entry.desconto_adiantamento ?? 0))
      setDescontoFaltas(fmt(entry.desconto_faltas))
      setDescontoOutros(fmt(entry.desconto_outros))
      setDiasTrabalhados(entry.dias_trabalhados != null ? String(entry.dias_trabalhados) : '')
      setStatus(entry.status)
      setObservacao(entry.observacao ?? '')
    } else {
      setEmployeeId(''); setSalarioBase(''); setPericulosidade('')
      setHorasExtras(''); setHorasExtrasFer(''); setAdicionalNoturno(''); setBonus('')
      setDescontoInss(''); setDescontoIrrf(''); setDescontoVt(''); setDescontoAdiant('')
      setDescontoFaltas(''); setDescontoOutros(''); setDiasTrabalhados('')
      setStatus('rascunho'); setObservacao('')
    }
  }, [open, entry])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const fd = new FormData()
    fd.set('employee_id',          employeeId)
    fd.set('mes_ano',              mesAno)
    fd.set('salario_base',         salarioBase)
    fd.set('periculosidade_valor', periculosidade)
    fd.set('horas_extras',         horasExtras)
    fd.set('horas_extras_feriado', horasExtrasFeriado)
    fd.set('adicional_noturno',    adicionalNoturno)
    fd.set('bonus',                bonus)
    fd.set('desconto_inss',        descontoInss)
    fd.set('desconto_irrf',        descontoIrrf)
    fd.set('desconto_vt',          descontoVt)
    fd.set('desconto_adiantamento',descontoAdiant)
    fd.set('desconto_faltas',      descontoFaltas)
    fd.set('desconto_outros',      descontoOutros)
    fd.set('dias_trabalhados',     diasTrabalhados)
    fd.set('status',               status)
    fd.set('observacao',           observacao)

    const result = isEdit
      ? await updatePayrollEntryAction(entry!.id, fd)
      : await createPayrollEntryAction(companyId, fd)

    setLoading(false)
    if ('error' in result) { setError(result.error ?? 'Erro ao salvar.'); return }
    router.refresh()
    onClose()
  }

  const labelStyle: React.CSSProperties = {
    color: 'var(--color-text-secondary)',
    fontSize: '0.75rem',
    fontWeight: 500,
    marginBottom: 4,
    display: 'block',
  }

  const sectionStyle: React.CSSProperties = {
    padding: '0.75rem',
    borderRadius: '0.5rem',
    backgroundColor: 'var(--color-bg-surface)',
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Editar Holerite' : 'Novo Holerite'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Funcionário */}
        {!isEdit && (
          <div>
            <label style={labelStyle}>Funcionário *</label>
            <select
              value={employeeId}
              onChange={e => onEmployeeChange(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border text-sm"
              style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
            >
              <option value="">Selecione...</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>{e.nome}{e.cargo ? ` — ${e.cargo}` : ''}</option>
              ))}
            </select>
          </div>
        )}

        {/* PROVENTOS */}
        <div style={sectionStyle}>
          <p className="text-xs font-semibold mb-3" style={{ color: 'var(--color-text-secondary)' }}>
            PROVENTOS
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>Salário base *</label>
              <Input value={salarioBase} onChange={e => setSalarioBase(e.target.value)} placeholder="0,00" inputMode="decimal" required />
            </div>
            <div>
              <label style={labelStyle}>
                Periculosidade
                <span style={{ fontWeight: 400, opacity: 0.65 }}> (30% — se aplicável)</span>
              </label>
              <Input value={periculosidade} onChange={e => setPericulosidade(e.target.value)} placeholder="0,00" inputMode="decimal" />
            </div>
            <div>
              <label style={labelStyle}>Horas extras conv. (50%)</label>
              <Input value={horasExtras} onChange={e => setHorasExtras(e.target.value)} placeholder="0,00" inputMode="decimal" />
            </div>
            <div>
              <label style={labelStyle}>Horas extras feriado (100%)</label>
              <Input value={horasExtrasFeriado} onChange={e => setHorasExtrasFer(e.target.value)} placeholder="0,00" inputMode="decimal" />
            </div>
            <div>
              <label style={labelStyle}>Adicional noturno</label>
              <Input value={adicionalNoturno} onChange={e => setAdicionalNoturno(e.target.value)} placeholder="0,00" inputMode="decimal" />
            </div>
            <div>
              <label style={labelStyle}>Outros adicionais</label>
              <Input value={bonus} onChange={e => setBonus(e.target.value)} placeholder="0,00" inputMode="decimal" />
            </div>
          </div>
          {bruto > 0 && (
            <div className="mt-2 pt-2 border-t flex justify-between text-xs" style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-secondary)' }}>
              <span>Total proventos</span>
              <span className="font-semibold" style={{ color: '#1E8449' }}>{fmtCurrency(bruto)}</span>
            </div>
          )}
        </div>

        {/* DESCONTOS */}
        <div style={sectionStyle}>
          <p className="text-xs font-semibold mb-1" style={{ color: 'var(--color-text-secondary)' }}>
            DESCONTOS
          </p>
          <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>
            INSS e IRRF preenchidos após retorno da contabilidade.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>INSS</label>
              <Input value={descontoInss} onChange={e => setDescontoInss(e.target.value)} placeholder="0,00" inputMode="decimal" />
            </div>
            <div>
              <label style={labelStyle}>IRRF</label>
              <Input value={descontoIrrf} onChange={e => setDescontoIrrf(e.target.value)} placeholder="0,00" inputMode="decimal" />
            </div>
            <div>
              <label style={labelStyle}>Vale-transporte (desconto 6%)</label>
              <Input value={descontoVt} onChange={e => setDescontoVt(e.target.value)} placeholder="0,00" inputMode="decimal" />
            </div>
            <div>
              <label style={labelStyle}>Adiantamento salarial</label>
              <Input value={descontoAdiant} onChange={e => setDescontoAdiant(e.target.value)} placeholder="0,00" inputMode="decimal" />
            </div>
            <div>
              <label style={labelStyle}>Faltas / atrasos</label>
              <Input value={descontoFaltas} onChange={e => setDescontoFaltas(e.target.value)} placeholder="0,00" inputMode="decimal" />
            </div>
            <div>
              <label style={labelStyle}>Outros descontos</label>
              <Input value={descontoOutros} onChange={e => setDescontoOutros(e.target.value)} placeholder="0,00" inputMode="decimal" />
            </div>
          </div>
          {descontos > 0 && (
            <div className="mt-2 pt-2 border-t flex justify-between text-xs" style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-secondary)' }}>
              <span>Total descontos</span>
              <span className="font-semibold" style={{ color: '#C0392B' }}>-{fmtCurrency(descontos)}</span>
            </div>
          )}
        </div>

        {/* Benefícios do catálogo */}
        {selectedEmp && selectedEmp.employee_benefits.length > 0 && (
          <div className="rounded-lg border p-3 space-y-1.5" style={{ borderColor: '#E8DAEF', backgroundColor: '#F9F0FF' }}>
            <p className="text-xs font-semibold" style={{ color: '#6C3483' }}>BENEFÍCIOS (catálogo)</p>
            {selectedEmp.employee_benefits
              .filter(eb => eb.benefit.desconta_salario)
              .map(eb => (
                <div key={eb.benefit_id} className="flex justify-between text-xs" style={{ color: '#6C3483' }}>
                  <span>{eb.benefit.nome} <span className="opacity-60">(desconto funcionário)</span></span>
                  <span>-{fmt(benefitValue(eb))}</span>
                </div>
              ))}
            {selectedEmp.employee_benefits
              .filter(eb => !eb.benefit.desconta_salario)
              .map(eb => (
                <div key={eb.benefit_id} className="flex justify-between text-xs" style={{ color: '#8E44AD' }}>
                  <span>{eb.benefit.nome} <span className="opacity-60">(patronal)</span></span>
                  <span>{fmt(benefitValue(eb))}</span>
                </div>
              ))}
            {calcBenefDesc(selectedEmp) > 0 && (
              <p className="text-xs pt-1 border-t" style={{ borderColor: '#D7BDE2', color: '#6C3483' }}>
                Descontos de benefícios pré-carregados em &quot;Outros descontos&quot; (editável).
              </p>
            )}
            {calcBenefPatronal(selectedEmp) > 0 && (
              <p className="text-xs" style={{ color: '#8E44AD' }}>
                Custo patronal: <strong>{fmtCurrency(calcBenefPatronal(selectedEmp))}</strong>
              </p>
            )}
          </div>
        )}

        {/* Salário Líquido */}
        <div className="flex items-center justify-between px-4 py-3 rounded-xl"
          style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-darker)' }}>
          <span className="font-semibold text-sm">Salário Líquido</span>
          <span className="font-bold text-lg">{fmtCurrency(liquido)}</span>
        </div>

        {/* Dias e Status */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label style={labelStyle}>Dias trabalhados</label>
            <Input
              type="number"
              min={0}
              max={31}
              value={diasTrabalhados}
              onChange={e => setDiasTrabalhados(e.target.value)}
              placeholder="22"
            />
          </div>
          <div>
            <label style={labelStyle}>Status</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border text-sm"
              style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
            >
              <option value="rascunho">Rascunho</option>
              <option value="fechado">Fechado</option>
              <option value="pago">Pago</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Observação</label>
            <Input value={observacao} onChange={e => setObservacao(e.target.value)} placeholder="Opcional" />
          </div>
        </div>

        {error && (
          <p className="text-sm p-3 rounded-lg bg-red-50" style={{ color: 'var(--color-error)' }}>{error}</p>
        )}
        <div className="flex gap-3 justify-end pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading}>{isEdit ? 'Salvar alterações' : 'Criar holerite'}</Button>
        </div>
      </form>
    </Modal>
  )
}
