'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createSocioAction, updateSocioAction } from '../actions'
import type { Socio } from '../queries'

const UF_OPTIONS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA',
  'MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN',
  'RS','RO','RR','SC','SP','SE','TO',
]

function formatCpf(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`
}

function maskCep(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 8)
  return d.length > 5 ? `${d.slice(0,5)}-${d.slice(5)}` : d
}

interface Props {
  open: boolean
  onClose: () => void
  companyId: string
  socio: Socio | null
}

export function ModalSocio({ open, onClose, companyId, socio }: Props) {
  const router = useRouter()
  const isEditing = !!socio

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [cpf, setCpf] = useState('')
  const [administrador, setAdministrador] = useState(false)
  const [cep, setCep] = useState('')
  const [uf, setUf] = useState('')
  const [cidade, setCidade] = useState('')
  const [logradouro, setLogradouro] = useState('')
  const [bairro, setBairro] = useState('')
  const [cepLoading, setCepLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setCpf(socio?.cpf ? formatCpf(socio.cpf) : '')
      setAdministrador(socio?.administrador ?? false)
      setCep(socio?.cep ? maskCep(socio.cep) : '')
      setUf(socio?.uf ?? '')
      setCidade(socio?.cidade ?? '')
      setLogradouro(socio?.logradouro ?? '')
      setBairro(socio?.bairro ?? '')
      setError('')
    }
  }, [open, socio])

  async function handleCepBlur() {
    const digits = cep.replace(/\D/g, '')
    if (digits.length !== 8) return
    setCepLoading(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
      const json = await res.json()
      if (!json.erro) {
        setLogradouro(json.logradouro || '')
        setBairro(json.bairro || '')
        setCidade(json.localidade || '')
        setUf(json.uf || '')
      }
    } catch { /* usuário preenche manualmente */ }
    finally { setCepLoading(false) }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const fd = new FormData(e.currentTarget)
    fd.set('cpf', cpf)
    fd.set('administrador', String(administrador))

    const result = isEditing
      ? await updateSocioAction(socio!.id, fd)
      : await createSocioAction(companyId, fd)

    setLoading(false)
    if ('error' in result) {
      setError(result.error ?? 'Erro desconhecido.')
    } else {
      onClose()
      router.refresh()
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? 'Editar sócio' : 'Novo sócio'}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">

        {/* ── Dados pessoais ── */}
        <Input
          label="Nome *"
          name="nome"
          defaultValue={socio?.nome ?? ''}
          required
          placeholder="Nome completo"
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="CPF"
            placeholder="000.000.000-00"
            value={cpf}
            onChange={(e) => setCpf(formatCpf(e.target.value))}
          />
          <Input
            label="Participação (%)"
            name="participacao"
            type="number"
            min="0"
            max="100"
            step="0.01"
            defaultValue={socio?.participacao ?? ''}
            placeholder="0,00"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Cargo"
            name="cargo"
            defaultValue={socio?.cargo ?? ''}
            placeholder="Ex: Diretor"
          />
          <Input
            label="E-mail"
            name="email"
            type="email"
            defaultValue={socio?.email ?? ''}
            placeholder="email@exemplo.com"
          />
        </div>

        <Input
          label="Telefone"
          name="telefone"
          defaultValue={socio?.telefone ?? ''}
          placeholder="(00) 00000-0000"
        />

        {/* ── Sócio Administrador ── */}
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <div
            onClick={() => setAdministrador((v) => !v)}
            className={`relative w-10 h-6 rounded-full transition-colors ${administrador ? 'bg-[#C19A6B]' : 'bg-gray-200'}`}
          >
            <span
              className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${administrador ? 'translate-x-5' : 'translate-x-1'}`}
            />
          </div>
          <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            Sócio Administrador
          </span>
        </label>

        {/* ── Endereço ── */}
        <p className="text-xs font-semibold uppercase tracking-wider pt-1" style={{ color: 'var(--color-text-muted)' }}>
          Endereço
        </p>

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>CEP</label>
            {cepLoading && <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Buscando...</span>}
          </div>
          <input
            name="cep"
            type="text"
            placeholder="00000-000"
            inputMode="numeric"
            maxLength={9}
            value={cep}
            onChange={(e) => setCep(maskCep(e.target.value))}
            onBlur={handleCepBlur}
            className="h-10 w-full rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C19A6B]"
            style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', backgroundColor: '#fff' }}
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>UF</label>
            <select
              name="uf"
              value={uf}
              onChange={(e) => setUf(e.target.value)}
              className="h-10 w-full rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C19A6B]"
              style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', backgroundColor: '#fff' }}
            >
              <option value="">UF</option>
              {UF_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div className="col-span-2 flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Cidade</label>
            <input
              name="cidade"
              type="text"
              placeholder="Cidade"
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              className="h-10 w-full rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C19A6B]"
              style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', backgroundColor: '#fff' }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Logradouro</label>
          <input
            name="logradouro"
            type="text"
            placeholder="Rua, Avenida, etc."
            value={logradouro}
            onChange={(e) => setLogradouro(e.target.value)}
            className="h-10 w-full rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C19A6B]"
            style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', backgroundColor: '#fff' }}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Bairro</label>
          <input
            name="bairro"
            type="text"
            placeholder="Bairro"
            value={bairro}
            onChange={(e) => setBairro(e.target.value)}
            className="h-10 w-full rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C19A6B]"
            style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', backgroundColor: '#fff' }}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Número" name="numero" defaultValue={socio?.numero ?? ''} placeholder="Número" />
          <Input label="Complemento" name="complemento" defaultValue={socio?.complemento ?? ''} placeholder="Apto, sala..." />
        </div>

        {error && (
          <p className="text-sm" style={{ color: 'var(--color-error)' }}>{error}</p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading}>{isEditing ? 'Salvar' : 'Adicionar'}</Button>
        </div>
      </form>
    </Modal>
  )
}
