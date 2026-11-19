'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createContactAction, updateContactAction } from '../actions'
import type { Contact } from '../queries'

function maskCPF(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

function maskCNPJ(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 14)
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

const PAPEIS = [
  { value: 'cliente', label: 'Cliente' },
  { value: 'fornecedor', label: 'Fornecedor' },
  { value: 'ambos', label: 'Os dois' },
] as const

interface Props {
  open: boolean
  onClose: () => void
  companyId: string
  contact: Contact | null
}

export function ModalContato({ open, onClose, companyId, contact }: Props) {
  const router = useRouter()
  const isEdit = !!contact
  const fotoInputRef = useRef<HTMLInputElement>(null)

  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<'PF' | 'PJ'>('PF')
  const [papel, setPapel] = useState<'cliente' | 'fornecedor' | 'ambos'>('ambos')
  const [cpfCnpj, setCpfCnpj] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [observacao, setObservacao] = useState('')
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setNome(contact?.nome ?? '')
      setTipo((contact?.tipo as 'PF' | 'PJ') ?? 'PF')
      setPapel(contact?.papel ?? 'ambos')
      const doc = contact?.cpf_cnpj ?? ''
      setCpfCnpj(doc ? (contact?.tipo === 'PJ' ? maskCNPJ(doc) : maskCPF(doc)) : '')
      setEmail(contact?.email ?? '')
      setTelefone(contact?.telefone ?? '')
      setObservacao(contact?.observacao ?? '')
      setFotoPreview(contact?.foto_url ?? null)
      if (fotoInputRef.current) fotoInputRef.current.value = ''
      setError('')
    }
  }, [open, contact])

  function handleDocChange(v: string) {
    setCpfCnpj(tipo === 'PF' ? maskCPF(v) : maskCNPJ(v))
  }

  function handleTipoChange(t: 'PF' | 'PJ') {
    setTipo(t)
    setCpfCnpj('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const fd = new FormData()
    const fotoFile = fotoInputRef.current?.files?.[0]
    if (fotoFile) fd.set('foto_file', fotoFile)
    fd.set('nome', nome)
    fd.set('tipo', tipo)
    fd.set('papel', papel)
    fd.set('cpf_cnpj', cpfCnpj)
    fd.set('email', email)
    fd.set('telefone', telefone)
    fd.set('observacao', observacao)

    const result = isEdit
      ? await updateContactAction(contact.id, fd)
      : await createContactAction(companyId, fd)

    setLoading(false)
    if ('error' in result) { setError(result.error ?? 'Erro'); return }
    router.refresh()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Editar contato' : 'Novo contato'}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Foto */}
        <div className="flex items-center gap-4">
          {fotoPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fotoPreview} alt="Preview" className="w-14 h-14 rounded-full object-cover border flex-shrink-0" style={{ borderColor: 'var(--color-bg-surface)' }} />
          ) : (
            <div className="w-14 h-14 rounded-full border flex items-center justify-center text-xl flex-shrink-0" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'var(--color-bg-surface)' }}>
              {tipo === 'PJ' ? '🏢' : '👤'}
            </div>
          )}
          <div className="flex items-center gap-3">
            <label className="cursor-pointer text-sm px-4 py-2 rounded-lg border transition-colors hover:bg-gray-50" style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-secondary)' }}>
              {fotoPreview ? 'Trocar foto' : 'Selecionar foto'}
              <input
                ref={fotoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) setFotoPreview(URL.createObjectURL(f))
                }}
              />
            </label>
            {fotoPreview && (
              <button
                type="button"
                onClick={() => { setFotoPreview(null); if (fotoInputRef.current) fotoInputRef.current.value = '' }}
                className="text-sm hover:underline"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Remover
              </button>
            )}
          </div>
        </div>

        {/* Tipo PF / PJ */}
        <div className="flex gap-2">
          {(['PF', 'PJ'] as const).map((t) => (
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
              {t === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica'}
            </button>
          ))}
        </div>

        {/* Papel: cliente / fornecedor / os dois */}
        <div>
          <label className="text-sm font-medium mb-1.5 block" style={{ color: 'var(--color-text-secondary)' }}>É cliente ou fornecedor?</label>
          <div className="flex gap-2">
            {PAPEIS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPapel(p.value)}
                className="flex-1 py-2 rounded-lg text-sm font-medium border transition-colors"
                style={{
                  backgroundColor: papel === p.value ? 'var(--color-primary)' : 'white',
                  borderColor: papel === p.value ? 'var(--color-primary-dark)' : 'var(--color-bg-surface)',
                  color: papel === p.value ? 'var(--color-primary-darker)' : 'var(--color-text-secondary)',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <Input
          label="Nome *"
          value={nome}
          onChange={e => setNome(e.target.value)}
          placeholder={tipo === 'PF' ? 'Nome completo' : 'Razão social ou nome fantasia'}
          required
        />

        <Input
          label={tipo === 'PF' ? 'CPF' : 'CNPJ'}
          value={cpfCnpj}
          onChange={e => handleDocChange(e.target.value)}
          placeholder={tipo === 'PF' ? '000.000.000-00' : '00.000.000/0000-00'}
          inputMode="numeric"
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="E-mail"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="email@exemplo.com"
          />
          <Input
            label="Telefone"
            value={telefone}
            onChange={e => setTelefone(e.target.value)}
            placeholder="(11) 99999-9999"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            Observação
          </label>
          <textarea
            value={observacao}
            onChange={e => setObservacao(e.target.value)}
            rows={3}
            placeholder="Informações adicionais..."
            className="w-full rounded-lg border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
            style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
          />
        </div>

        {error && (
          <p className="text-sm p-3 rounded-lg bg-red-50" style={{ color: 'var(--color-error)' }}>{error}</p>
        )}

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading} className="flex-1">
            {isEdit ? 'Salvar' : 'Criar contato'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
