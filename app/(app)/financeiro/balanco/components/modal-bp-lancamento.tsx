'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createBPLancamentoAction, updateBPLancamentoAction } from '../actions'
import type { BPLancamento, BPTipo } from '../queries'

const TIPOS: { value: BPTipo; label: string }[] = [
  { value: 'ativo_circulante',       label: 'Ativo Circulante' },
  { value: 'ativo_nao_circulante',   label: 'Ativo Não Circulante' },
  { value: 'passivo_circulante',     label: 'Passivo Circulante' },
  { value: 'passivo_nao_circulante', label: 'Passivo Não Circulante' },
  { value: 'pl',                     label: 'Patrimônio Líquido' },
]

interface Props {
  open: boolean
  onClose: () => void
  companyId: string
  lancamento: BPLancamento | null
  defaultTipo: BPTipo
}

export function ModalBPLancamento({ open, onClose, companyId, lancamento, defaultTipo }: Props) {
  const router = useRouter()
  const isEdit = !!lancamento

  const [tipo, setTipo] = useState<BPTipo>(defaultTipo)
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setTipo(lancamento?.tipo ?? defaultTipo)
      setDescricao(lancamento?.descricao ?? '')
      setValor(lancamento ? String(lancamento.valor) : '')
      setError('')
    }
  }, [open, lancamento, defaultTipo])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const fd = new FormData()
    fd.set('tipo', tipo)
    fd.set('descricao', descricao)
    fd.set('valor', valor)

    const result = isEdit
      ? await updateBPLancamentoAction(lancamento.id, fd)
      : await createBPLancamentoAction(companyId, fd)

    setLoading(false)
    if ('error' in result) { setError(result.error ?? 'Erro'); return }
    router.refresh()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Editar lançamento' : 'Novo lançamento'}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">

        {/* Grupo */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            Grupo *
          </label>
          <select
            value={tipo}
            onChange={e => setTipo(e.target.value as BPTipo)}
            className="h-10 w-full rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C19A6B]"
            style={{
              borderColor: 'var(--color-bg-surface)',
              color: 'var(--color-text-primary)',
              backgroundColor: 'white',
            }}
          >
            {TIPOS.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <Input
          label="Descrição *"
          value={descricao}
          onChange={e => setDescricao(e.target.value)}
          placeholder="Ex: Veículo, Máquina, Capital Social, Empréstimo..."
          required
        />

        <Input
          label="Valor (R$) *"
          type="number"
          value={valor}
          onChange={e => setValor(e.target.value)}
          placeholder="0.00"
          min="0"
          step="0.01"
          required
        />

        {error && (
          <p className="text-sm p-3 rounded-lg bg-red-50" style={{ color: 'var(--color-error)' }}>
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading} className="flex-1">
            {isEdit ? 'Salvar' : 'Criar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
