'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createContactAction } from '../../actions'

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

interface Props {
  companyId: string
}

export function FormNovoContato({ companyId }: Props) {
  const router = useRouter()

  const [tipo, setTipo] = useState<'PF' | 'PJ'>('PF')
  const [nome, setNome] = useState('')
  const [cpfCnpj, setCpfCnpj] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [observacao, setObservacao] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function handleTipoChange(t: 'PF' | 'PJ') {
    setTipo(t)
    setCpfCnpj('')
  }

  function handleDocChange(v: string) {
    setCpfCnpj(tipo === 'PF' ? maskCPF(v) : maskCNPJ(v))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim()) return
    setLoading(true)
    setError('')
    const fd = new FormData()
    fd.set('nome', nome)
    fd.set('tipo', tipo)
    fd.set('cpf_cnpj', cpfCnpj)
    fd.set('email', email)
    fd.set('telefone', telefone)
    fd.set('observacao', observacao)
    const result = await createContactAction(companyId, fd)
    setLoading(false)
    if ('error' in result) { setError(result.error ?? 'Erro ao salvar.'); return }
    router.push('/financeiro/contatos')
  }

  const labelStyle: React.CSSProperties = {
    color: 'var(--color-text-secondary)',
    fontSize: '0.75rem',
    fontWeight: 500,
    marginBottom: 4,
    display: 'block',
  }

  const sectionTitle: React.CSSProperties = {
    color: 'var(--color-primary-darker)',
    fontSize: '0.8rem',
    fontWeight: 600,
    marginBottom: 12,
    paddingBottom: 6,
    borderBottom: '1px solid var(--color-bg-surface)',
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Cabeçalho */}
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={() => router.push('/financeiro/contatos')}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 14L6 9l5-5" />
          </svg>
        </button>
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
            Novo Contato
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Cadastrar cliente ou fornecedor
          </p>
        </div>
      </div>

      <div className="rounded-xl border p-6" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
        <p style={sectionTitle}>Dados do Contato</p>
        <div className="space-y-4">
          {/* Tipo PF / PJ */}
          <div>
            <label style={labelStyle}>Tipo</label>
            <div className="flex gap-2">
              {(['PF', 'PJ'] as const).map(t => (
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
          </div>

          <div>
            <label style={labelStyle}>Nome *</label>
            <Input
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder={tipo === 'PF' ? 'Nome completo' : 'Razão social ou nome fantasia'}
              required
            />
          </div>

          <div>
            <label style={labelStyle}>{tipo === 'PF' ? 'CPF' : 'CNPJ'}</label>
            <Input
              value={cpfCnpj}
              onChange={e => handleDocChange(e.target.value)}
              placeholder={tipo === 'PF' ? '000.000.000-00' : '00.000.000/0000-00'}
              inputMode="numeric"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>E-mail</label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="email@exemplo.com"
              />
            </div>
            <div>
              <label style={labelStyle}>Telefone</label>
              <Input
                value={telefone}
                onChange={e => setTelefone(e.target.value)}
                placeholder="(11) 99999-9999"
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Observação</label>
            <textarea
              value={observacao}
              onChange={e => setObservacao(e.target.value)}
              rows={3}
              placeholder="Informações adicionais..."
              className="w-full rounded-lg border px-3 py-2 text-sm resize-none"
              style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
            />
          </div>
        </div>
      </div>

      {error && (
        <p className="text-sm mt-3 p-3 rounded-lg bg-red-50" style={{ color: 'var(--color-error)' }}>{error}</p>
      )}

      <div className="flex gap-3 justify-end mt-4">
        <Button type="button" variant="ghost" onClick={() => router.push('/financeiro/contatos')}>Cancelar</Button>
        <Button type="submit" loading={loading}>Criar Contato</Button>
      </div>
    </form>
  )
}
