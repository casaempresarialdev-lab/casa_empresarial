'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { upsertPayrollVariableAction } from '../actions'
import type { PayrollEntryVariable } from '../queries'

type Fields = Omit<PayrollEntryVariable, 'id' | 'employee_id'>

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  companyId: string
  employeeId: string
  employeeName: string
  salarioBase: number
  mesAno: string
  existing: PayrollEntryVariable | null
}

function numInput(
  label: string,
  value: string,
  onChange: (v: string) => void,
  opts?: { prefix?: string; hint?: string }
) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: 4 }}>
        {label}
        {opts?.hint && <span style={{ marginLeft: 6, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>({opts.hint})</span>}
      </label>
      <div className="flex items-center">
        {opts?.prefix && (
          <span style={{ padding: '6px 8px', background: 'var(--color-bg-surface)', borderRadius: '6px 0 0 6px', border: '1px solid #D1D5DB', borderRight: 'none', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
            {opts.prefix}
          </span>
        )}
        <input
          type="number"
          min="0"
          step={opts?.prefix ? '0.01' : '1'}
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{
            flex: 1,
            padding: '6px 10px',
            border: '1px solid #D1D5DB',
            borderRadius: opts?.prefix ? '0 6px 6px 0' : 6,
            fontSize: '0.82rem',
            outline: 'none',
            color: 'var(--color-text-primary)',
          }}
        />
      </div>
    </div>
  )
}

export function ModalLancamentoFolha({ open, onClose, onSaved, companyId, employeeId, employeeName, salarioBase, mesAno, existing }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [faltas, setFaltas]         = useState('0')
  const [atestados, setAtestados]   = useState('0')
  const [he50, setHe50]             = useState('0')
  const [heFeriado, setHeFeriado]   = useState('0')
  const [heDomingo, setHeDomingo]   = useState('0')
  const [comissao, setComissao]     = useState('0')
  const [descVT, setDescVT]         = useState('0')
  const [descVR, setDescVR]         = useState('0')
  const [obs, setObs]               = useState('')

  useEffect(() => {
    if (existing) {
      setFaltas(String(existing.desconto_faltas ?? 0))
      setAtestados(String(existing.atestados ?? 0))
      setHe50(String(existing.horas_extras ?? 0))
      setHeFeriado(String(existing.horas_extras_feriado ?? 0))
      setHeDomingo(String(existing.horas_extras_domingo ?? 0))
      setComissao(String(existing.bonus ?? 0))
      setDescVT(String(existing.desconto_vt ?? 0))
      setDescVR(String(existing.desconto_vr ?? 0))
      setObs(existing.observacao ?? '')
    } else {
      setFaltas('0'); setAtestados('0'); setHe50('0'); setHeFeriado('0')
      setHeDomingo('0'); setComissao('0'); setDescVT('0'); setDescVR('0'); setObs('')
    }
    setError('')
  }, [existing, open])

  async function handleSave() {
    setLoading(true)
    setError('')
    const result = await upsertPayrollVariableAction(companyId, employeeId, mesAno, salarioBase, {
      desconto_faltas:      parseFloat(faltas) || 0,
      atestados:            parseInt(atestados) || 0,
      horas_extras:         parseFloat(he50) || 0,
      horas_extras_feriado: parseFloat(heFeriado) || 0,
      horas_extras_domingo: parseFloat(heDomingo) || 0,
      bonus:                parseFloat(comissao) || 0,
      desconto_vt:          parseFloat(descVT) || 0,
      desconto_vr:          parseFloat(descVR) || 0,
      observacao:           obs.trim() || null,
    })
    setLoading(false)
    if (result.error) { setError(result.error); return }
    onSaved()
    onClose()
  }

  const sep = (
    <div className="col-span-2 border-t pt-2" style={{ borderColor: 'var(--color-bg-surface)' }} />
  )

  return (
    <Modal open={open} onClose={onClose} title={`Lançamento — ${employeeName}`} description={`Dados variáveis do mês`} className="sm:max-w-lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {numInput('Faltas', faltas, setFaltas, { hint: 'dias' })}
          {numInput('Atestados', atestados, setAtestados, { hint: 'dias' })}
          {sep}
          {numInput('HE 50%', he50, setHe50, { prefix: 'R$' })}
          {numInput('HE 100% Feriado', heFeriado, setHeFeriado, { prefix: 'R$' })}
          {numInput('HE 100% Domingo', heDomingo, setHeDomingo, { prefix: 'R$' })}
          {numInput('Comissão', comissao, setComissao, { prefix: 'R$' })}
          {sep}
          {numInput('Desc. VT', descVT, setDescVT, { prefix: 'R$' })}
          {numInput('Desc. VR', descVR, setDescVR, { prefix: 'R$' })}
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: 4 }}>
            Observação
          </label>
          <textarea
            value={obs}
            onChange={e => setObs(e.target.value)}
            rows={3}
            placeholder="Anotações para o PDF (opcional)"
            style={{
              width: '100%',
              padding: '8px 10px',
              border: '1px solid #D1D5DB',
              borderRadius: 6,
              fontSize: '0.82rem',
              outline: 'none',
              resize: 'vertical',
              color: 'var(--color-text-primary)',
              fontFamily: 'inherit',
            }}
          />
        </div>

        {error && (
          <p className="text-sm p-3 rounded-lg bg-red-50" style={{ color: 'var(--color-error)' }}>{error}</p>
        )}

        <div className="flex gap-3 justify-end pt-1">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button type="button" onClick={handleSave} loading={loading}>Salvar</Button>
        </div>
      </div>
    </Modal>
  )
}
