'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ModalContato } from './modal-contato'
import { deleteContactAction } from '../actions'
import type { Contact } from '../queries'

function docMask(doc: string | null, tipo: 'PF' | 'PJ') {
  if (!doc) return '—'
  const d = doc.replace(/\D/g, '')
  if (tipo === 'PF') {
    if (d.length !== 11) return doc
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
  }
  if (d.length !== 14) return doc
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

interface Props {
  contacts: Contact[]
  companyId: string
}

export function ContatosClient({ contacts, companyId }: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Contact | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [search, setSearch] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | 'PF' | 'PJ'>('todos')

  const q = search.toLowerCase()
  const filtered = contacts.filter(c => {
    const matchTipo = tipoFiltro === 'todos' || c.tipo === tipoFiltro
    const matchSearch =
      c.nome.toLowerCase().includes(q) ||
      (c.cpf_cnpj ?? '').includes(q) ||
      (c.email ?? '').toLowerCase().includes(q) ||
      (c.telefone ?? '').includes(q)
    return matchTipo && matchSearch
  })

  function openAdd() { setEditing(null); setModalOpen(true) }
  function openEdit(c: Contact) { setEditing(c); setModalOpen(true) }

  async function handleDelete(c: Contact) {
    if (!confirm(`Excluir "${c.nome}"? Esta ação não pode ser desfeita.`)) return
    setDeletingId(c.id)
    setDeleteError('')
    const result = await deleteContactAction(c.id)
    setDeletingId(null)
    if ('error' in result) setDeleteError(result.error ?? 'Erro ao excluir.')
    else router.refresh()
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
            Contatos
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Clientes e fornecedores
          </p>
        </div>
        <Button onClick={openAdd}>Adicionar</Button>
      </div>

      <div className="flex gap-3 mb-4">
        <input
          type="text"
          placeholder="Buscar por nome, CPF/CNPJ, e-mail ou telefone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 px-4 py-2 rounded-lg border text-sm"
          style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white', color: 'var(--color-text-primary)' }}
        />
        <div className="flex gap-1 rounded-lg border p-1" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
          {(['todos', 'PF', 'PJ'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTipoFiltro(t)}
              className="px-3 py-1 rounded-md text-xs font-medium transition-colors"
              style={{
                backgroundColor: tipoFiltro === t ? 'var(--color-primary)' : 'transparent',
                color: tipoFiltro === t ? 'var(--color-primary-darker)' : 'var(--color-text-muted)',
              }}
            >
              {t === 'todos' ? 'Todos' : t}
            </button>
          ))}
        </div>
      </div>

      {deleteError && (
        <p className="text-sm mb-4 p-3 rounded-lg bg-red-50" style={{ color: 'var(--color-error)' }}>{deleteError}</p>
      )}

      <div className="rounded-xl border overflow-x-auto" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
        <table className="w-full min-w-[640px] text-sm">
          <thead style={{ backgroundColor: 'var(--color-bg-surface)' }}>
            <tr>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Nome</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Tipo</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>CPF / CNPJ</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>E-mail</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Telefone</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-10" style={{ color: 'var(--color-text-muted)' }}>
                  {search || tipoFiltro !== 'todos' ? 'Nenhum resultado para a busca.' : 'Nenhum contato cadastrado.'}
                </td>
              </tr>
            )}
            {filtered.map(c => (
              <tr key={c.id} className="border-t" style={{ borderColor: 'var(--color-bg-surface)' }}>
                <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  {c.nome}
                  {c.observacao && (
                    <div className="text-xs mt-0.5 truncate max-w-[200px]" style={{ color: 'var(--color-text-muted)' }}>{c.observacao}</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: c.tipo === 'PJ' ? '#EBF5FB' : '#F0FFF4',
                      color: c.tipo === 'PJ' ? '#2471A3' : '#1E8449',
                    }}
                  >
                    {c.tipo === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica'}
                  </span>
                </td>
                <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>{docMask(c.cpf_cnpj, c.tipo)}</td>
                <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>{c.email ?? '—'}</td>
                <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>{c.telefone ?? '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(c)}>Editar</Button>
                    <Button variant="danger" size="sm" loading={deletingId === c.id} onClick={() => handleDelete(c)}>Excluir</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ModalContato
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        companyId={companyId}
        contact={editing}
      />
    </>
  )
}
