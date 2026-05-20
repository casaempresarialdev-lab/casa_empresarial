'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createProviderAction, updateProviderAction } from '../actions'
import type { ServiceProvider } from '../queries'

function formatCpf(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

function formatCnpj(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 14)
  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

interface Props {
  open: boolean
  onClose: () => void
  companyId: string
  provider: ServiceProvider | null
}

export function ModalPrestador({ open, onClose, companyId, provider }: Props) {
  const router = useRouter()
  const isEdit = !!provider

  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<'PF' | 'PJ'>('PJ')
  const [cpfCnpj, setCpfCnpj] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [servico, setServico] = useState('')
  const [valor, setValor] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    if (provider) {
      setNome(provider.nome)
      setTipo(provider.tipo)
      const doc = provider.cpf_cnpj ?? ''
      setCpfCnpj(provider.tipo === 'PF' ? formatCpf(doc) : formatCnpj(doc))
      setEmail(provider.email ?? '')
      setTelefone(provider.telefone ?? '')
      setServico(provider.servico ?? '')
      setValor(provider.valor !== null ? String(provider.valor) : '')
    } else {
      setNome(''); setTipo('PJ'); setCpfCnpj('')
      setEmail(''); setTelefone(''); setServico(''); setValor('')
    }
  }, [open, provider])

  function handleTipoChange(t: 'PF' | 'PJ') {
    setTipo(t)
    setCpfCnpj('')
  }

  function handleDocChange(e: React.ChangeEvent<HTMLInputElement>) {
    setCpfCnpj(tipo === 'PF' ? formatCpf(e.target.value) : formatCnpj(e.target.value))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const fd = new FormData()
    fd.set('nome', nome)
    fd.set('tipo', tipo)
    fd.set('cpf_cnpj', cpfCnpj)
    fd.set('email', email)
    fd.set('telefone', telefone)
    fd.set('servico', servico)
    fd.set('valor', valor)

    const result = isEdit
      ? await updateProviderAction(provider!.id, fd)
      : await createProviderAction(companyId, fd)

    setLoading(false)
    if ('error' in result) { setError(result.error ?? 'Erro ao salvar.'); return }
    router.refresh()
    onClose()
  }

  const labelStyle = { color: 'var(--color-text-secondary)', fontSize: '0.75rem', fontWeight: 500, marginBottom: 4, display: 'block' }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Editar Prestador' : 'Novo Prestador'}>
      <form onSubmit={handleSubmit} className="space-y-4">

        <div>
          <label style={labelStyle}>Tipo de Pessoa</label>
          <div className="flex gap-2">
            {(['PJ', 'PF'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => handleTipoChange(t)}
                className="flex-1 py-2 rounded-lg text-sm font-medium border transition-colors"
                style={{
                  backgroundColor: tipo === t ? 'var(--color-primary)' : 'white',
                  borderColor: tipo === t ? 'var(--color-primary-dark)' : 'var(--color-bg-surface)',
                  color: tipo === t ? 'var(--color-primary-darker)' : 'var(--color-text-secondary)',
                }}
              >
                {t === 'PJ' ? 'Pessoa Jurídica (PJ)' : 'Pessoa Física (PF)'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label style={labelStyle}>Nome / Razão Social *</label>
          <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome completo ou razão social" required />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label style={labelStyle}>{tipo === 'PF' ? 'CPF' : 'CNPJ'}</label>
            <Input
              value={cpfCnpj}
              onChange={handleDocChange}
              placeholder={tipo === 'PF' ? '000.000.000-00' : '00.000.000/0000-00'}
            />
          </div>
          <div>
            <label style={labelStyle}>Telefone</label>
            <Input value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(00) 00000-0000" />
          </div>
        </div>

        <div>
          <label style={labelStyle}>E-mail</label>
          <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemplo.com" />
        </div>

        <div>
          <label style={labelStyle}>Serviço / Especialidade</label>
          <Input value={servico} onChange={e => setServico(e.target.value)} placeholder="Ex: Designer Gráfico, Contabilidade..." />
        </div>

        <div>
          <label style={labelStyle}>Valor por hora (R$)</label>
          <Input
            value={valor}
            onChange={e => setValor(e.target.value)}
            placeholder="0,00"
            inputMode="decimal"
          />
        </div>

        {error && (
          <p className="text-sm p-3 rounded-lg bg-red-50" style={{ color: 'var(--color-error)' }}>{error}</p>
        )}

        <div className="flex gap-3 justify-end pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading}>{isEdit ? 'Salvar alterações' : 'Cadastrar'}</Button>
        </div>
      </form>
    </Modal>
  )
}
