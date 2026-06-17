'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { getProviderDocUrlAction } from '../actions'
import type { ServiceProvider } from '../queries'

function fmtDoc(tipo: string, doc: string | null) {
  if (!doc) return '—'
  const d = doc.replace(/\D/g, '')
  if (tipo === 'PF' && d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
  if (tipo === 'PJ' && d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
  return doc
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function fmtValor(v: number | null) {
  if (v === null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtBytes(b: number | null) {
  if (!b) return ''
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p style={{ fontSize: '0.62rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2, fontWeight: 600 }}>{label}</p>
      <p style={{ fontSize: '0.82rem', color: 'var(--color-text-primary)', fontWeight: 500, wordBreak: 'break-word' }}>{value || '—'}</p>
    </div>
  )
}

interface Props {
  open: boolean
  onClose: () => void
  onEdit: () => void
  provider: ServiceProvider | null
}

export function ModalViewPrestador({ open, onClose, onEdit, provider }: Props) {
  const [loadingPath, setLoadingPath] = useState<string | null>(null)
  const [error, setError] = useState('')

  if (!provider) return null

  async function openDoc(storagePath: string) {
    setLoadingPath(storagePath)
    setError('')
    const result = await getProviderDocUrlAction(provider!.id, storagePath)
    setLoadingPath(null)
    if (result.error) setError(result.error)
    else window.open(result.url, '_blank')
  }

  const docs = (provider.documentos ?? []).filter(Boolean)

  return (
    <Modal open={open} onClose={onClose} title={provider.nome} description="Dados do prestador" className="sm:max-w-xl">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-x-5 gap-y-3">
          <Field label="Tipo" value={provider.tipo === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica'} />
          <Field label={provider.tipo === 'PF' ? 'CPF' : 'CNPJ'} value={fmtDoc(provider.tipo, provider.cpf_cnpj)} />
          <Field label="E-mail" value={provider.email} />
          <Field label="Telefone" value={provider.telefone} />
          <Field label="Serviço" value={provider.servico} />
          <Field label="Valor por hora" value={fmtValor(provider.valor)} />
          <Field label="Data de início" value={fmtDate(provider.data_inicio)} />
        </div>

        {/* Documentos */}
        <div className="pt-3 border-t" style={{ borderColor: 'var(--color-bg-surface)' }}>
          <p style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: '0.6rem' }}>
            Documentos
          </p>
          {docs.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Nenhum documento anexado.</p>
          ) : (
            <div className="space-y-2">
              {docs.map(d => (
                <div key={d!.storage_path} className="flex items-center justify-between gap-2 p-2.5 rounded-lg border"
                  style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: '#FAFAFA' }}>
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate" style={{ color: 'var(--color-text-primary)' }} title={d!.nome}>
                      📎 {d!.nome}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {d!.label ? `${d!.label} · ` : ''}{fmtBytes(d!.size)}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" loading={loadingPath === d!.storage_path} onClick={() => openDoc(d!.storage_path)}>
                    Abrir
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && (
          <p className="text-sm p-3 rounded-lg bg-red-50" style={{ color: 'var(--color-error)' }}>{error}</p>
        )}

        <div className="flex gap-3 justify-end pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Fechar</Button>
          <Button type="button" onClick={onEdit}>Editar</Button>
        </div>
      </div>
    </Modal>
  )
}
