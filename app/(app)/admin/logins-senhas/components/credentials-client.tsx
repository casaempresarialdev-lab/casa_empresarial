'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ModalCredential } from './modal-credential'
import { deleteCredentialAction, revealPasswordAction } from '../actions'
import type { Credential } from '../queries'

function ThreeDotMenu({ onEdit, onDelete, loading }: { onEdit: () => void; onDelete: () => void; loading: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-lg hover:bg-gray-100 transition-colors"
        style={{ color: 'var(--color-text-muted)' }}
        aria-label="Opções"
      >
        ···
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 w-36 rounded-xl border shadow-lg py-1 z-20"
          style={{ backgroundColor: 'white', borderColor: 'var(--color-bg-surface)' }}
        >
          <button
            type="button"
            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
            onClick={() => { setOpen(false); onEdit() }}
          >
            Editar
          </button>
          <button
            type="button"
            className="w-full text-left px-4 py-2 text-sm hover:bg-red-50 transition-colors"
            style={{ color: 'var(--color-error)' }}
            onClick={() => { setOpen(false); onDelete() }}
            disabled={loading}
          >
            {loading ? 'Excluindo…' : 'Excluir'}
          </button>
        </div>
      )}
    </div>
  )
}

interface Props {
  credentials: Credential[]
  companyId: string
}

export function CredentialsClient({ credentials, companyId }: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingCredential, setEditingCredential] = useState<Credential | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [revealingId, setRevealingId] = useState<string | null>(null)
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, string>>({})
  const [errorMsg, setErrorMsg] = useState('')
  const [search, setSearch] = useState('')

  const filtered = credentials.filter((c) => {
    const q = search.toLowerCase()
    return (
      c.sistema.toLowerCase().includes(q) ||
      c.login.toLowerCase().includes(q) ||
      (c.observacao ?? '').toLowerCase().includes(q)
    )
  })

  function openAdd() { setEditingCredential(null); setModalOpen(true) }
  function openEdit(c: Credential) { setEditingCredential(c); setModalOpen(true) }

  async function handleDelete(c: Credential) {
    if (!confirm(`Excluir credencial de "${c.sistema}"?`)) return
    setDeletingId(c.id)
    setErrorMsg('')
    const result = await deleteCredentialAction(c.id, companyId)
    setDeletingId(null)
    if ('error' in result) setErrorMsg(result.error ?? 'Erro ao excluir.')
    else router.refresh()
  }

  async function handleReveal(c: Credential) {
    if (revealedPasswords[c.id]) {
      setRevealedPasswords((prev) => { const n = { ...prev }; delete n[c.id]; return n })
      return
    }
    setRevealingId(c.id)
    const result = await revealPasswordAction(c.id, companyId)
    setRevealingId(null)
    if ('error' in result) {
      setErrorMsg(result.error ?? 'Erro ao revelar senha.')
    } else {
      setRevealedPasswords((prev) => ({ ...prev, [c.id]: result.password! }))
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
            Logins e Senhas
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Cofre de credenciais — senhas criptografadas
          </p>
        </div>
        <Button onClick={openAdd}>Adicionar</Button>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Pesquisar por sistema, login ou observação..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 w-full rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#C19A6B]"
          style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', backgroundColor: '#fff' }}
        />
      </div>

      {errorMsg && (
        <p className="text-sm mb-4 p-3 rounded-lg bg-red-50" style={{ color: 'var(--color-error)' }}>
          {errorMsg}
        </p>
      )}

      <div className="rounded-xl border overflow-x-auto" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
        <table className="w-full min-w-[600px] text-sm">
          <thead style={{ backgroundColor: 'var(--color-bg-surface)' }}>
            <tr>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Sistema</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Login</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Senha</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>URL</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-10" style={{ color: 'var(--color-text-muted)' }}>
                  {search ? 'Nenhuma credencial encontrada para essa pesquisa.' : 'Nenhuma credencial cadastrada.'}
                </td>
              </tr>
            )}
            {filtered.map((c) => (
              <tr key={c.id} className="border-t" style={{ borderColor: 'var(--color-bg-surface)' }}>
                <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  {c.sistema}
                  {c.observacao && (
                    <p className="text-xs font-normal mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                      {c.observacao}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  {c.login}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      {revealedPasswords[c.id] ? revealedPasswords[c.id] : '••••••••'}
                    </span>
                    <button
                      className="text-xs underline"
                      style={{ color: 'var(--color-primary-dark)' }}
                      onClick={() => handleReveal(c)}
                      disabled={revealingId === c.id}
                    >
                      {revealingId === c.id ? '...' : revealedPasswords[c.id] ? 'Ocultar' : 'Ver'}
                    </button>
                    {revealedPasswords[c.id] && (
                      <button
                        className="text-xs"
                        style={{ color: 'var(--color-text-muted)' }}
                        onClick={() => navigator.clipboard.writeText(revealedPasswords[c.id])}
                        title="Copiar senha"
                      >
                        Copiar
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>
                  {c.url ? (
                    <a href={c.url} target="_blank" rel="noopener noreferrer" className="underline text-xs" style={{ color: 'var(--color-primary-dark)' }}>
                      Abrir
                    </a>
                  ) : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end">
                    <ThreeDotMenu
                      onEdit={() => openEdit(c)}
                      onDelete={() => handleDelete(c)}
                      loading={deletingId === c.id}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ModalCredential
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        companyId={companyId}
        credential={editingCredential}
      />
    </>
  )
}
