'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ModalFolha } from './modal-folha'
import { deletePayrollEntryAction } from '../actions'
import type { PayrollEntry, EmployeeForPayroll } from '../queries'

interface Props {
  entries: PayrollEntry[]
  employees: EmployeeForPayroll[]
  companyId: string
  mesAno: string
}

const STATUS_CONFIG = {
  rascunho: { label: 'Rascunho', bg: '#F4F6F7', text: '#717D7E' },
  fechado:  { label: 'Fechado',  bg: '#EBF5FB', text: '#2471A3' },
  pago:     { label: 'Pago',     bg: '#E9F7EF', text: '#1E8449' },
}

function fmtCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function mesAnoLabel(mesAno: string) {
  const [ano, mes] = mesAno.split('-')
  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
  return `${meses[parseInt(mes) - 1]} ${ano}`
}

export function FolhaClient({ entries, employees, companyId, mesAno }: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<PayrollEntry | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [mes, setMes] = useState(mesAno.split('-')[1])
  const [ano, setAno] = useState(mesAno.split('-')[0])

  function navigate(newMes: string, newAno: string) {
    router.push(`/pessoas/folha-de-pagamento?mes=${newMes}&ano=${newAno}`)
  }

  function prevMonth() {
    const d = new Date(parseInt(ano), parseInt(mes) - 2, 1)
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const a = String(d.getFullYear())
    setMes(m); setAno(a)
    navigate(m, a)
  }

  function nextMonth() {
    const d = new Date(parseInt(ano), parseInt(mes), 1)
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const a = String(d.getFullYear())
    setMes(m); setAno(a)
    navigate(m, a)
  }

  function openAdd() { setEditingEntry(null); setModalOpen(true) }
  function openEdit(e: PayrollEntry) { setEditingEntry(e); setModalOpen(true) }

  async function handleDelete(e: PayrollEntry) {
    const nome = e.employee?.nome ?? 'este funcionário'
    if (!confirm(`Excluir holerite de ${nome}?`)) return
    setDeletingId(e.id)
    const result = await deletePayrollEntryAction(e.id)
    setDeletingId(null)
    if ('error' in result) alert(result.error)
    else router.refresh()
  }

  const totalBruto = entries.reduce((s, e) => s + e.salario_base + e.horas_extras + e.adicional_noturno + e.bonus, 0)
  const totalDescontos = entries.reduce((s, e) => s + e.desconto_faltas + e.desconto_inss + e.desconto_irrf + e.desconto_vt + e.desconto_outros, 0)
  const totalLiquido = entries.reduce((s, e) => s + e.salario_liquido, 0)

  const counts = {
    rascunho: entries.filter(e => e.status === 'rascunho').length,
    fechado: entries.filter(e => e.status === 'fechado').length,
    pago: entries.filter(e => e.status === 'pago').length,
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
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
          <Button onClick={openAdd}>+ Novo holerite</Button>
        </div>
      </div>

      {/* Cards de resumo */}
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

      {/* Status badges */}
      <div className="flex gap-2 mb-4">
        {(['rascunho', 'fechado', 'pago'] as const).map(s => {
          const cfg = STATUS_CONFIG[s]
          return counts[s] > 0 ? (
            <span key={s} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
              style={{ backgroundColor: cfg.bg, color: cfg.text }}>
              {counts[s]} {cfg.label}{counts[s] > 1 ? 's' : ''}
            </span>
          ) : null
        })}
      </div>

      <div className="rounded-xl border overflow-x-auto" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
        <table className="w-full min-w-[700px] text-sm">
          <thead style={{ backgroundColor: 'var(--color-bg-surface)' }}>
            <tr>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Funcionário</th>
              <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Salário base</th>
              <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Proventos</th>
              <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Descontos</th>
              <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Líquido</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-10" style={{ color: 'var(--color-text-muted)' }}>
                  Nenhum holerite para {mesAnoLabel(mesAno)}.
                </td>
              </tr>
            )}
            {entries.map(e => {
              const cfg = STATUS_CONFIG[e.status]
              const proventos = e.horas_extras + e.adicional_noturno + e.bonus
              const descontos = e.desconto_faltas + e.desconto_inss + e.desconto_irrf + e.desconto_vt + e.desconto_outros
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
