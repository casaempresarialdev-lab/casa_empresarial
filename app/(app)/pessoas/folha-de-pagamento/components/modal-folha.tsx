'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createPayrollEntryAction, updatePayrollEntryAction } from '../actions'
import type { PayrollEntry, EmployeeForPayroll, BenefitForPayroll } from '../queries'

const DIAS_UTEIS_MES = 22

// INSS empregado 2024 — tabela progressiva
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

export function ModalFolha({ open, onClose, companyId, entry, employees, mesAno }: Props) {
  const router = useRouter()
  const isEdit = !!entry

  const [employeeId, setEmployeeId] = useState('')
  const [salarioBase, setSalarioBase] = useState('')
  const [horasExtras, setHorasExtras] = useState('')
  const [adicionalNoturno, setAdicionalNoturno] = useState('')
  const [bonus, setBonus] = useState('')
  const [descontoFaltas, setDescontoFaltas] = useState('')
  const [descontoInss, setDescontoInss] = useState('')
  const [descontoIrrf, setDescontoIrrf] = useState('')
  const [descontoVt, setDescontoVt] = useState('')
  const [descontoOutros, setDescontoOutros] = useState('')
  const [status, setStatus] = useState('rascunho')
  const [observacao, setObservacao] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const baseNum = parseFloat(salarioBase.replace(',', '.')) || 0
  const extras = parseFloat(horasExtras.replace(',', '.')) || 0
  const noturno = parseFloat(adicionalNoturno.replace(',', '.')) || 0
  const bonusNum = parseFloat(bonus.replace(',', '.')) || 0
  const faltas = parseFloat(descontoFaltas.replace(',', '.')) || 0
  const inss = parseFloat(descontoInss.replace(',', '.')) || 0
  const irrf = parseFloat(descontoIrrf.replace(',', '.')) || 0
  const vt = parseFloat(descontoVt.replace(',', '.')) || 0
  const outros = parseFloat(descontoOutros.replace(',', '.')) || 0
  const liquido = Math.max(0, baseNum + extras + noturno + bonusNum - faltas - inss - irrf - vt - outros)

  const selectedEmp = employees.find(e => e.id === employeeId) ?? null

  function onEmployeeChange(id: string) {
    setEmployeeId(id)
    const emp = employees.find(e => e.id === id)
    if (emp && !isEdit) {
      const sal = emp.salario ?? 0
      setSalarioBase(sal > 0 ? fmt(sal) : '')
      const inss = calcInssProgressivo(sal)
      setDescontoInss(inss > 0 ? fmt(inss) : '')
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
      setHorasExtras(fmt(entry.horas_extras))
      setAdicionalNoturno(fmt(entry.adicional_noturno))
      setBonus(fmt(entry.bonus))
      setDescontoFaltas(fmt(entry.desconto_faltas))
      setDescontoInss(fmt(entry.desconto_inss))
      setDescontoIrrf(fmt(entry.desconto_irrf))
      setDescontoVt(fmt(entry.desconto_vt))
      setDescontoOutros(fmt(entry.desconto_outros))
      setStatus(entry.status)
      setObservacao(entry.observacao ?? '')
    } else {
      setEmployeeId(''); setSalarioBase(''); setHorasExtras(''); setAdicionalNoturno('')
      setBonus(''); setDescontoFaltas(''); setDescontoInss(''); setDescontoIrrf('')
      setDescontoVt(''); setDescontoOutros(''); setStatus('rascunho'); setObservacao('')
    }
  }, [open, entry])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const fd = new FormData()
    fd.set('employee_id', employeeId)
    fd.set('mes_ano', mesAno)
    fd.set('salario_base', salarioBase)
    fd.set('horas_extras', horasExtras)
    fd.set('adicional_noturno', adicionalNoturno)
    fd.set('bonus', bonus)
    fd.set('desconto_faltas', descontoFaltas)
    fd.set('desconto_inss', descontoInss)
    fd.set('desconto_irrf', descontoIrrf)
    fd.set('desconto_vt', descontoVt)
    fd.set('desconto_outros', descontoOutros)
    fd.set('status', status)
    fd.set('observacao', observacao)

    const result = isEdit
      ? await updatePayrollEntryAction(entry!.id, fd)
      : await createPayrollEntryAction(companyId, fd)

    setLoading(false)
    if ('error' in result) { setError(result.error ?? 'Erro ao salvar.'); return }
    router.refresh()
    onClose()
  }

  const labelStyle = { color: 'var(--color-text-secondary)', fontSize: '0.75rem', fontWeight: 500, marginBottom: 4, display: 'block' }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Editar Holerite' : 'Novo Holerite'}>
      <form onSubmit={handleSubmit} className="space-y-4">
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

        {/* Proventos */}
        <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
          <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>PROVENTOS</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>Salário base *</label>
              <Input value={salarioBase} onChange={e => setSalarioBase(e.target.value)} placeholder="0,00" inputMode="decimal" required />
            </div>
            <div>
              <label style={labelStyle}>Horas extras</label>
              <Input value={horasExtras} onChange={e => setHorasExtras(e.target.value)} placeholder="0,00" inputMode="decimal" />
            </div>
            <div>
              <label style={labelStyle}>Adicional noturno</label>
              <Input value={adicionalNoturno} onChange={e => setAdicionalNoturno(e.target.value)} placeholder="0,00" inputMode="decimal" />
            </div>
            <div>
              <label style={labelStyle}>Bônus / comissão</label>
              <Input value={bonus} onChange={e => setBonus(e.target.value)} placeholder="0,00" inputMode="decimal" />
            </div>
          </div>
        </div>

        {/* Descontos */}
        <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
          <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-secondary)' }}>DESCONTOS</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>INSS <span style={{ fontWeight: 400, opacity: 0.7 }}>(pré-calculado)</span></label>
              <Input value={descontoInss} onChange={e => setDescontoInss(e.target.value)} placeholder="0,00" inputMode="decimal" />
            </div>
            <div>
              <label style={labelStyle}>IRRF</label>
              <Input value={descontoIrrf} onChange={e => setDescontoIrrf(e.target.value)} placeholder="0,00" inputMode="decimal" />
            </div>
            <div>
              <label style={labelStyle}>Vale-transporte</label>
              <Input value={descontoVt} onChange={e => setDescontoVt(e.target.value)} placeholder="0,00" inputMode="decimal" />
            </div>
            <div>
              <label style={labelStyle}>Faltas</label>
              <Input value={descontoFaltas} onChange={e => setDescontoFaltas(e.target.value)} placeholder="0,00" inputMode="decimal" />
            </div>
            <div>
              <label style={labelStyle}>Outros descontos</label>
              <Input value={descontoOutros} onChange={e => setDescontoOutros(e.target.value)} placeholder="0,00" inputMode="decimal" />
            </div>
          </div>
        </div>

        {/* Benefícios do catálogo (referência) */}
        {selectedEmp && selectedEmp.employee_benefits.length > 0 && (
          <div className="rounded-lg border p-3 space-y-2" style={{ borderColor: '#E8DAEF', backgroundColor: '#F9F0FF' }}>
            <p className="text-xs font-semibold" style={{ color: '#6C3483' }}>BENEFÍCIOS (catálogo)</p>
            {selectedEmp.employee_benefits
              .filter(eb => eb.benefit.desconta_salario)
              .map(eb => (
                <div key={eb.benefit_id} className="flex justify-between text-xs" style={{ color: '#6C3483' }}>
                  <span>{eb.benefit.nome} <span className="opacity-60">(desconto do funcionário)</span></span>
                  <span>-{fmt(benefitValue(eb))}</span>
                </div>
              ))}
            {selectedEmp.employee_benefits
              .filter(eb => !eb.benefit.desconta_salario)
              .map(eb => (
                <div key={eb.benefit_id} className="flex justify-between text-xs" style={{ color: '#8E44AD' }}>
                  <span>{eb.benefit.nome} <span className="opacity-60">(custo patronal)</span></span>
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
                Custo patronal total em benefícios:{' '}
                <strong>{calcBenefPatronal(selectedEmp).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
              </p>
            )}
          </div>
        )}

        {/* Líquido calculado */}
        <div className="flex items-center justify-between px-4 py-3 rounded-xl"
          style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-darker)' }}>
          <span className="font-semibold text-sm">Salário Líquido</span>
          <span className="font-bold text-lg">
            {liquido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
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
