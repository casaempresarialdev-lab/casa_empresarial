'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { updateOwnEmployeeDataAction } from '../../actions'
import type { Employee } from '../../queries'

interface Props {
  open: boolean
  onClose: () => void
  employee: Employee
}

// Auto-edição do colaborador — só dados pessoais/contato. Campos administrativos
// (salário, status, contrato, datas, PIN) não aparecem aqui de propósito.
export function MeusDadosForm({ open, onClose, employee }: Props) {
  const router = useRouter()
  const [telefone, setTelefone]             = useState(employee.telefone ?? '')
  const [email, setEmail]                   = useState(employee.email ?? '')
  const [dadosBancarios, setDadosBancarios] = useState(employee.dados_bancarios ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const lbl: React.CSSProperties = { color: 'var(--color-text-secondary)', fontSize: '0.75rem', fontWeight: 500, marginBottom: 4, display: 'block' }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const fd = new FormData()
    fd.set('telefone', telefone)
    fd.set('email', email)
    fd.set('dados_bancarios', dadosBancarios)

    const result = await updateOwnEmployeeDataAction(employee.id, fd)
    setLoading(false)
    if ('error' in result) { setError(result.error ?? 'Erro ao salvar.'); return }
    router.refresh()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Meus Dados" description="Atualize suas informações de contato">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label style={lbl}>Telefone</label>
          <Input value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(21) 99999-0000" />
        </div>
        <div>
          <label style={lbl}>E-mail</label>
          <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemplo.com" />
        </div>
        <div>
          <label style={lbl}>Dados Bancários</label>
          <textarea
            value={dadosBancarios}
            onChange={e => setDadosBancarios(e.target.value)}
            placeholder="Banco, agência, conta corrente e/ou chave PIX"
            rows={2}
            className="w-full px-3 py-2 rounded-lg border text-sm resize-none"
            style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
          />
        </div>

        {error && (
          <p className="text-sm p-3 rounded-lg bg-red-50" style={{ color: 'var(--color-error)' }}>{error}</p>
        )}

        <div className="flex gap-3 justify-end pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading}>Salvar alterações</Button>
        </div>
      </form>
    </Modal>
  )
}
