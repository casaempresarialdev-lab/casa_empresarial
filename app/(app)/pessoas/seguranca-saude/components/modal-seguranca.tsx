'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createHealthSafetyAction, updateHealthSafetyAction } from '../actions'
import type { HealthSafetyRecord, EmployeeForSS } from '../queries'

interface Props {
  open: boolean
  onClose: () => void
  companyId: string
  record: HealthSafetyRecord | null
  employees: EmployeeForSS[]
}

export function ModalSeguranca({ open, onClose, companyId, record, employees }: Props) {
  const router = useRouter()
  const isEdit = !!record

  const [employeeId, setEmployeeId] = useState('')
  const [tipo, setTipo] = useState('aso')
  const [titulo, setTitulo] = useState('')
  const [data, setData] = useState('')
  const [dataVencimento, setDataVencimento] = useState('')
  const [resultado, setResultado] = useState('')
  const [observacao, setObservacao] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    if (record) {
      setEmployeeId(record.employee_id ?? '')
      setTipo(record.tipo)
      setTitulo(record.titulo)
      setData(record.data ?? '')
      setDataVencimento(record.data_vencimento ?? '')
      setResultado(record.resultado ?? '')
      setObservacao(record.observacao ?? '')
    } else {
      setEmployeeId(''); setTipo('aso'); setTitulo(''); setData('')
      setDataVencimento(''); setResultado(''); setObservacao('')
    }
  }, [open, record])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const fd = new FormData()
    fd.set('employee_id', employeeId)
    fd.set('tipo', tipo)
    fd.set('titulo', titulo)
    fd.set('data', data)
    fd.set('data_vencimento', dataVencimento)
    fd.set('resultado', resultado)
    fd.set('observacao', observacao)

    const result = isEdit
      ? await updateHealthSafetyAction(record!.id, fd)
      : await createHealthSafetyAction(companyId, fd)

    setLoading(false)
    if ('error' in result) { setError(result.error ?? 'Erro ao salvar.'); return }
    router.refresh()
    onClose()
  }

  const labelStyle = { color: 'var(--color-text-secondary)', fontSize: '0.75rem', fontWeight: 500, marginBottom: 4, display: 'block' }

  const showResultado = tipo === 'aso'

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Editar Registro' : 'Novo Registro'}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label style={labelStyle}>Tipo *</label>
            <select
              value={tipo}
              onChange={e => setTipo(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border text-sm"
              style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
            >
              <option value="aso">ASO (Atestado de Saúde)</option>
              <option value="treinamento">Treinamento</option>
              <option value="epi">EPI (Equipamento de Proteção)</option>
              <option value="incidente">Incidente / Acidente</option>
              <option value="vacina">Vacinação</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Funcionário</label>
            <select
              value={employeeId}
              onChange={e => setEmployeeId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border text-sm"
              style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
            >
              <option value="">Todos / Empresa</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>{e.nome}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label style={labelStyle}>Título *</label>
          <Input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: ASO admissional, Treinamento NR-6..." required />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label style={labelStyle}>Data</label>
            <Input type="date" value={data} onChange={e => setData(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Vencimento</label>
            <Input type="date" value={dataVencimento} onChange={e => setDataVencimento(e.target.value)} />
          </div>
        </div>

        {showResultado && (
          <div>
            <label style={labelStyle}>Resultado (ASO)</label>
            <select
              value={resultado}
              onChange={e => setResultado(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border text-sm"
              style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
            >
              <option value="">Sem resultado</option>
              <option value="apto">Apto</option>
              <option value="apto_com_restricoes">Apto com restrições</option>
              <option value="inapto">Inapto</option>
            </select>
          </div>
        )}

        <div>
          <label style={labelStyle}>Observação</label>
          <textarea
            value={observacao}
            onChange={e => setObservacao(e.target.value)}
            rows={2}
            placeholder="Detalhes adicionais..."
            className="w-full px-3 py-2 rounded-lg border text-sm resize-none"
            style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
          />
        </div>

        {error && (
          <p className="text-sm p-3 rounded-lg bg-red-50" style={{ color: 'var(--color-error)' }}>{error}</p>
        )}
        <div className="flex gap-3 justify-end pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading}>{isEdit ? 'Salvar alterações' : 'Criar registro'}</Button>
        </div>
      </form>
    </Modal>
  )
}
