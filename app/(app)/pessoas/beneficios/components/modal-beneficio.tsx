'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createBenefitAction, updateBenefitAction } from '../actions'
import type { CompanyBenefit } from '../queries'

interface Props {
  open: boolean
  onClose: () => void
  companyId: string
  benefit: CompanyBenefit | null
}

export function ModalBeneficio({ open, onClose, companyId, benefit }: Props) {
  const router = useRouter()
  const isEdit = !!benefit

  const [nome, setNome] = useState('')
  const [valor, setValor] = useState('')
  const [porDia, setPorDia] = useState(false)
  const [descontaSalario, setDescontaSalario] = useState(false)
  const [ativo, setAtivo] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    if (benefit) {
      setNome(benefit.nome)
      setValor(benefit.valor > 0 ? String(benefit.valor).replace('.', ',') : '')
      setPorDia(benefit.por_dia_trabalhado)
      setDescontaSalario(benefit.desconta_salario)
      setAtivo(benefit.ativo)
    } else {
      setNome(''); setValor(''); setPorDia(false); setDescontaSalario(false); setAtivo(true)
    }
  }, [open, benefit])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')

    const fd = new FormData()
    fd.set('nome', nome)
    fd.set('valor', valor)
    fd.set('por_dia_trabalhado', String(porDia))
    fd.set('desconta_salario', String(descontaSalario))
    fd.set('ativo', String(ativo))

    const result = isEdit
      ? await updateBenefitAction(benefit!.id, fd)
      : await createBenefitAction(companyId, fd)

    setLoading(false)
    if ('error' in result) { setError(result.error ?? 'Erro ao salvar.'); return }
    router.refresh()
    onClose()
  }

  const labelStyle = { color: 'var(--color-text-secondary)', fontSize: '0.75rem', fontWeight: 500, marginBottom: 4, display: 'block' }

  function Checkbox({ checked, onChange, label, desc }: { checked: boolean; onChange: (v: boolean) => void; label: string; desc: string }) {
    return (
      <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border transition-colors"
        style={{ borderColor: checked ? 'var(--color-primary-dark)' : 'var(--color-bg-surface)', backgroundColor: checked ? 'var(--color-primary)' : 'white' }}>
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="mt-0.5 accent-current" />
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{label}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{desc}</p>
        </div>
      </label>
    )
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Editar Benefício' : 'Novo Benefício'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label style={labelStyle}>Nome do benefício *</label>
          <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Vale-Refeição, Gympass" required />
        </div>

        <div>
          <label style={labelStyle}>Valor de referência (R$)</label>
          <Input value={valor} onChange={e => setValor(e.target.value)} placeholder="0,00" inputMode="decimal" />
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Valor padrão para todos os funcionários. Pode ser ajustado individualmente.
          </p>
        </div>

        <div className="space-y-2">
          <label style={{ ...labelStyle, marginBottom: 8 }}>Tipo de cálculo</label>
          <Checkbox
            checked={porDia}
            onChange={setPorDia}
            label="Calculado por dia trabalhado"
            desc="Ex: VR = R$ 35/dia. O valor será multiplicado pelos dias úteis do mês."
          />
          <Checkbox
            checked={descontaSalario}
            onChange={setDescontaSalario}
            label="Desconta do salário do funcionário"
            desc="Ex: VT (6% do salário). Gera desconto no holerite. Se desmarcado, é custo puro da empresa."
          />
        </div>

        {isEdit && (
          <div className="flex items-center gap-3">
            <input type="checkbox" id="ativo-check" checked={ativo} onChange={e => setAtivo(e.target.checked)} />
            <label htmlFor="ativo-check" className="text-sm cursor-pointer" style={{ color: 'var(--color-text-secondary)' }}>
              Benefício ativo
            </label>
          </div>
        )}

        {error && <p className="text-sm p-3 rounded-lg bg-red-50" style={{ color: 'var(--color-error)' }}>{error}</p>}

        <div className="flex gap-3 justify-end pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading}>{isEdit ? 'Salvar' : 'Criar benefício'}</Button>
        </div>
      </form>
    </Modal>
  )
}
