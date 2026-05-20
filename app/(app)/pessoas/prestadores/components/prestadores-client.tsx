'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ModalPrestador } from './modal-prestador'
import { deleteProviderAction } from '../actions'
import type { ServiceProvider } from '../queries'

interface Props {
  providers: ServiceProvider[]
  companyId: string
}

function formatDoc(tipo: string, doc: string | null) {
  if (!doc) return '—'
  const d = doc.replace(/\D/g, '')
  if (tipo === 'PF' && d.length === 11)
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
  if (tipo === 'PJ' && d.length === 14)
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
  return doc
}

function formatValor(valor: number | null) {
  if (valor === null) return '—'
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function PrestadoresClient({ providers, companyId }: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProvider, setEditingProvider] = useState<ServiceProvider | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [search, setSearch] = useState('')

  const q = search.toLowerCase()
  const filtered = providers.filter(p =>
    p.nome.toLowerCase().includes(q) ||
    (p.servico ?? '').toLowerCase().includes(q) ||
    (p.email ?? '').toLowerCase().includes(q) ||
    (p.cpf_cnpj ?? '').includes(q)
  )

  function openAdd() { setEditingProvider(null); setModalOpen(true) }
  function openEdit(p: ServiceProvider) { setEditingProvider(p); setModalOpen(true) }

  async function handleDelete(p: ServiceProvider) {
    if (!confirm(`Excluir ${p.nome}? Esta ação não pode ser desfeita.`)) return
    setDeletingId(p.id)
    setDeleteError('')
    const result = await deleteProviderAction(p.id)
    setDeletingId(null)
    if ('error' in result) setDeleteError(result.error ?? 'Erro ao excluir.')
    else router.refresh()
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
            Prestadores de Serviço
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Profissionais e empresas contratadas
          </p>
        </div>
        <Button onClick={openAdd}>+ Novo prestador</Button>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Buscar por nome, serviço, e-mail ou CPF/CNPJ..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full px-4 py-2 rounded-lg border text-sm"
          style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white', color: 'var(--color-text-primary)' }}
        />
      </div>

      {deleteError && (
        <p className="text-sm mb-4 p-3 rounded-lg bg-red-50" style={{ color: 'var(--color-error)' }}>
          {deleteError}
        </p>
      )}

      <div className="rounded-xl border overflow-x-auto" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
        <table className="w-full min-w-[650px] text-sm">
          <thead style={{ backgroundColor: 'var(--color-bg-surface)' }}>
            <tr>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Nome</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Tipo</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>CPF / CNPJ</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Serviço</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Valor/h</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-10" style={{ color: 'var(--color-text-muted)' }}>
                  {search ? 'Nenhum resultado para a busca.' : 'Nenhum prestador cadastrado.'}
                </td>
              </tr>
            )}
            {filtered.map((p) => (
              <tr key={p.id} className="border-t" style={{ borderColor: 'var(--color-bg-surface)' }}>
                <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  <div>{p.nome}</div>
                  {p.email && (
                    <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{p.email}</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: p.tipo === 'PF' ? '#EBF5FB' : '#EAF4F4',
                      color: p.tipo === 'PF' ? '#2471A3' : '#17A589',
                    }}
                  >
                    {p.tipo}
                  </span>
                </td>
                <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>
                  {formatDoc(p.tipo, p.cpf_cnpj)}
                </td>
                <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>{p.servico ?? '—'}</td>
                <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>{formatValor(p.valor)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(p)}>Editar</Button>
                    <Button
                      variant="danger"
                      size="sm"
                      loading={deletingId === p.id}
                      onClick={() => handleDelete(p)}
                    >
                      Excluir
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ModalPrestador
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        companyId={companyId}
        provider={editingProvider}
      />
    </>
  )
}
