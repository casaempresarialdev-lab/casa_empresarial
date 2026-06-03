'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createCostCenterAction, updateCostCenterAction } from '../actions'
import type { CostCenter } from '../queries'

interface Props {
  open: boolean
  onClose: () => void
  companyId: string
  costCenter: CostCenter | null
}

export function ModalCentroCusto({ open, onClose, companyId, costCenter }: Props) {
  const router = useRouter()
  const isEdit = !!costCenter

  const [nome, setNome] = useState('')
  const [codigo, setCodigo] = useState('')
  const [ativo, setAtivo] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setNome(costCenter?.nome ?? '')
      setCodigo(costCenter?.codigo ?? '')
      setAtivo(costCenter?.ativo ?? true)
      setError('')
    }
  }, [open, costCenter])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const fd = new FormData()
    fd.set('nome', nome)
    fd.set('codigo', codigo)
    fd.set('ativo', String(ativo))

    const result = isEdit
      ? await updateCostCenterAction(costCenter.id, fd)
      : await createCostCenterAction(companyId, fd)

    setLoading(false)
    if ('error' in result) { setError(result.error ?? 'Erro'); return }
    router.refresh()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Editar centro de custo' : 'Novo centro de custo'}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Nome *"
          value={nome}
          onChange={e => setNome(e.target.value)}
          placeholder="Ex: Marketing, Administrativo..."
          required
        />
        <Input
          label="Código (opcional)"
          value={codigo}
          onChange={e => setCodigo(e.target.value)}
          placeholder="Ex: CC-001"
        />

        <label className="flex items-center gap-3 cursor-pointer select-none">
          <div
            onClick={() => setAtivo(!ativo)}
            className="relative w-10 h-6 rounded-full transition-colors cursor-pointer"
            style={{ backgroundColor: ativo ? 'var(--color-primary-dark)' : '#D1D5DB' }}
          >
            <div
              className="absolute top-1 w-4 h-4 rounded-full bg-white transition-transform shadow"
              style={{ left: ativo ? '22px' : '4px' }}
            />
          </div>
          <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {ativo ? 'Ativo' : 'Inativo'}
          </span>
        </label>

        {error && (
          <p className="text-sm p-3 rounded-lg bg-red-50" style={{ color: 'var(--color-error)' }}>{error}</p>
        )}

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading} className="flex-1">
            {isEdit ? 'Salvar' : 'Criar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
