'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createAliquotaAction, updateAliquotaAction } from '../actions'
import type { AliquotaRow } from '../queries'

interface Props {
  open: boolean
  onClose: () => void
  companyId: string
  aliquota: AliquotaRow | null
}

export function ModalAliquota({ open, onClose, companyId, aliquota }: Props) {
  const router = useRouter()
  const isEdit = !!aliquota

  const [nome, setNome] = useState('')
  const [percentual, setPercentual] = useState('')
  const [ativo, setAtivo] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    if (aliquota) {
      setNome(aliquota.nome)
      setPercentual(String(aliquota.percentual).replace('.', ','))
      setAtivo(aliquota.ativo)
    } else {
      setNome(''); setPercentual(''); setAtivo(true)
    }
  }, [open, aliquota])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const fd = new FormData()
    fd.set('nome', nome)
    fd.set('percentual', percentual)
    fd.set('ativo', String(ativo))

    const result = isEdit
      ? await updateAliquotaAction(aliquota!.id, fd)
      : await createAliquotaAction(companyId, fd)

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

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Editar Alíquota' : 'Nova Alíquota'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label style={labelStyle}>Nome / Descrição *</label>
          <Input
            value={nome}
            onChange={e => setNome(e.target.value)}
            placeholder="Ex: FGTS, INSS Patronal, RAT/FAP"
            required
          />
        </div>

        <div>
          <label style={labelStyle}>Percentual (%) *</label>
          <div className="relative">
            <Input
              value={percentual}
              onChange={e => setPercentual(e.target.value)}
              placeholder="Ex: 8,00"
              inputMode="decimal"
              required
              style={{ paddingRight: '2rem' }}
            />
            <span
              className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium select-none"
              style={{ color: 'var(--color-text-muted)' }}
            >
              %
            </span>
          </div>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Calculado sobre o salário bruto de cada funcionário
          </p>
        </div>

        {isEdit && (
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={ativo}
              onChange={e => setAtivo(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Alíquota ativa (incluída no cálculo)
            </span>
          </label>
        )}

        {error && (
          <p className="text-sm p-3 rounded-lg bg-red-50" style={{ color: 'var(--color-error)' }}>{error}</p>
        )}

        <div className="flex gap-3 justify-end pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading}>{isEdit ? 'Salvar alterações' : 'Adicionar'}</Button>
        </div>
      </form>
    </Modal>
  )
}
