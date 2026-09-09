'use client'

import { useState, useRef, useEffect } from 'react'
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

function RowMenu({
  contact,
  onView,
  onEdit,
  onDelete,
  deletingId,
}: {
  contact: Contact
  onView: () => void
  onEdit: () => void
  onDelete: () => void
  deletingId: string | null
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, right: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      const t = e.target as Node
      if (!btnRef.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  function toggle() {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + window.scrollY + 4, right: window.innerWidth - rect.right })
    }
    setOpen(v => !v)
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
        style={{ color: 'var(--color-text-muted)' }}
        title="Opções"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="8" cy="3" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="8" cy="13" r="1.5" />
        </svg>
      </button>
      {open && (
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: pos.top,
            right: pos.right,
            zIndex: 9999,
            backgroundColor: 'white',
            border: '1px solid var(--color-bg-surface)',
            borderRadius: '8px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            minWidth: '140px',
            padding: '4px 0',
          }}
        >
          <button
            onClick={() => { setOpen(false); onView() }}
            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Visualizar
          </button>
          <button
            onClick={() => { setOpen(false); onEdit() }}
            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Editar
          </button>
          <button
            onClick={() => { setOpen(false); onDelete() }}
            disabled={deletingId === contact.id}
            className="w-full text-left px-4 py-2 text-sm hover:bg-red-50 transition-colors"
            style={{ color: '#C0392B' }}
          >
            {deletingId === contact.id ? 'Excluindo...' : 'Excluir'}
          </button>
        </div>
      )}
    </>
  )
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
        <Button onClick={() => router.push('/financeiro/contatos/novo')}>Adicionar</Button>
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
                <td className="px-4 py-3 text-right">
                  <RowMenu
                    contact={c}
                    onView={() => router.push(`/financeiro/contatos/${c.id}`)}
                    onEdit={() => openEdit(c)}
                    onDelete={() => handleDelete(c)}
                    deletingId={deletingId}
                  />
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
