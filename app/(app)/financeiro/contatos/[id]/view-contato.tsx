'use client'

import { useRouter } from 'next/navigation'
import type { Contact } from '../queries'

function formatDoc(doc: string | null, tipo: 'PF' | 'PJ') {
  if (!doc) return '—'
  const d = doc.replace(/\D/g, '')
  if (tipo === 'PF') {
    if (d.length !== 11) return doc
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
  }
  if (d.length !== 14) return doc
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

function formatDate(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

interface Props { contact: Contact }

export function ViewContato({ contact }: Props) {
  const router = useRouter()

  const sectionTitle: React.CSSProperties = {
    color: 'var(--color-primary-darker)',
    fontSize: '0.8rem',
    fontWeight: 600,
    marginBottom: 12,
    paddingBottom: 6,
    borderBottom: '1px solid var(--color-bg-surface)',
  }

  const fieldLabel: React.CSSProperties = {
    color: 'var(--color-text-muted)',
    fontSize: '0.7rem',
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: 2,
    display: 'block',
  }

  const fieldValue: React.CSSProperties = {
    color: 'var(--color-text-primary)',
    fontSize: '0.875rem',
    fontWeight: 500,
  }

  const endereco = contact.endereco ?? {}
  const enderecoFormatado = [
    endereco.logradouro && `${endereco.logradouro}${endereco.numero ? ', ' + endereco.numero : ''}`,
    endereco.complemento,
    endereco.bairro,
    endereco.cidade && `${endereco.cidade}${endereco.uf ? ' - ' + endereco.uf : ''}`,
    endereco.cep && `CEP: ${endereco.cep}`,
  ].filter(Boolean).join(' · ')

  return (
    <div>
      {/* Cabeçalho */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push('/financeiro/contatos')}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 14L6 9l5-5" />
          </svg>
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
              {contact.nome}
            </h1>
            <span
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
              style={{
                backgroundColor: contact.tipo === 'PJ' ? '#EBF5FB' : '#F0FFF4',
                color: contact.tipo === 'PJ' ? '#2471A3' : '#1E8449',
              }}
            >
              {contact.tipo === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica'}
            </span>
          </div>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Contato</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Dados principais */}
        <div className="rounded-xl border p-6" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
          <p style={sectionTitle}>Dados do Contato</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <span style={fieldLabel}>{contact.tipo === 'PF' ? 'CPF' : 'CNPJ'}</span>
              <span style={fieldValue}>{formatDoc(contact.cpf_cnpj, contact.tipo)}</span>
            </div>
            <div>
              <span style={fieldLabel}>Telefone</span>
              <span style={fieldValue}>{contact.telefone ?? '—'}</span>
            </div>
            <div className="col-span-2">
              <span style={fieldLabel}>E-mail</span>
              <span style={fieldValue}>{contact.email ?? '—'}</span>
            </div>
            {enderecoFormatado && (
              <div className="col-span-2">
                <span style={fieldLabel}>Endereço</span>
                <span style={fieldValue}>{enderecoFormatado}</span>
              </div>
            )}
            {contact.observacao && (
              <div className="col-span-2">
                <span style={fieldLabel}>Observação</span>
                <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>{contact.observacao}</p>
              </div>
            )}
            {contact.tags && contact.tags.length > 0 && (
              <div className="col-span-2">
                <span style={fieldLabel}>Tags</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {contact.tags.map(tag => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{ backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-secondary)' }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Metadados */}
        <div className="rounded-xl border p-6" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
          <p style={sectionTitle}>Informações do Cadastro</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <span style={fieldLabel}>Criado em</span>
              <span style={fieldValue}>{formatDate(contact.created_at)}</span>
            </div>
            <div>
              <span style={fieldLabel}>Atualizado em</span>
              <span style={fieldValue}>{formatDate(contact.updated_at)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
