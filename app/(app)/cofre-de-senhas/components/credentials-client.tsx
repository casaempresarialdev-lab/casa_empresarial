'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/ui/icon'
import { IconButton } from '@/components/ui/icon-button'
import { ListItem, ListEmpty } from '@/components/ui/list-item'
import { AddButton } from '@/components/ui/add-button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/toast'
import { ModalCredential } from './modal-credential'
import { ModalCompartilhar } from './modal-compartilhar'
import { ModalVerSenha, ModalSemPin, LINK_CADASTRAR_PIN } from './modal-pin-cofre'
import { deleteCredentialAction, revealPasswordAction } from '../actions'
import type { Credential, CredencialCompartilhada } from '../queries'
import { Breadcrumb } from '@/components/layout/breadcrumb'

interface Props {
  minhas: Credential[]
  compartilhadas: CredencialCompartilhada[]
  temPin: boolean
  /** Aba aberta ao entrar (ex.: link da notificação de compartilhamento) */
  abaInicial?: Aba
}

type Aba = 'minhas' | 'compartilhadas'
type Revelavel = { id: string; sistema: string; login: string }

export function CredentialsClient({ minhas, compartilhadas, temPin, abaInicial = 'minhas' }: Props) {
  const router = useRouter()
  const [aba, setAba] = useState<Aba>(abaInicial)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingCredential, setEditingCredential] = useState<Credential | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<Credential | null>(null)
  const [infoTarget, setInfoTarget] = useState<{ sistema: string; observacao: string | null } | null>(null)
  // Compartilhar: guarda só o id, para a lista de compartilhamentos vir sempre atualizada
  const [compartilharId, setCompartilharId] = useState<string | null>(null)
  // Ver senha: pede o PIN antes
  const [revelarTarget, setRevelarTarget] = useState<Revelavel | null>(null)
  const [semPinOpen, setSemPinOpen] = useState(false)
  const [search, setSearch] = useState('')

  const q = search.toLowerCase()
  const bate = (c: { sistema: string; login: string; observacao: string | null }) =>
    c.sistema.toLowerCase().includes(q) || c.login.toLowerCase().includes(q) || (c.observacao ?? '').toLowerCase().includes(q)
  const minhasFiltradas = minhas.filter(bate)
  const compartilhadasFiltradas = compartilhadas.filter(bate)
  const compartilharCred = minhas.find((c) => c.id === compartilharId) ?? null

  function openAdd() { setEditingCredential(null); setModalOpen(true) }
  function openEdit(c: Credential) { setEditingCredential(c); setModalOpen(true) }

  // Ações que exigem PIN: sem PIN cadastrado, avisa e leva ao perfil
  function exigirPin(acao: () => void) {
    if (!temPin) { setSemPinOpen(true); return }
    acao()
  }

  function handleReveal(c: Revelavel) {
    exigirPin(() => setRevelarTarget(c))
  }

  // Remoção confirmada no modal; o resultado aparece no toast (✓ / ✕)
  async function confirmDelete() {
    const c = confirmTarget
    if (!c) return
    setDeletingId(c.id)
    const result = await toast.promise(deleteCredentialAction(c.id), {
      loading: `Removendo credencial de ${c.sistema}…`,
      success: `Credencial de ${c.sistema} removida do cofre.`,
      error: 'Não foi possível remover a credencial.',
    })
    setDeletingId(null)
    setConfirmTarget(null)
    if (!('error' in result)) router.refresh()
  }

  // Senha sempre escondida na lista; o olho abre o modal (PIN → senha com botão de copiar)
  const senhaAside = (c: Revelavel) => (
    <div className="flex items-center gap-1">
      <span className="font-mono text-xs min-w-20 text-right" style={{ color: 'var(--color-text-secondary)' }}>••••••••</span>
      <IconButton icon="eye" label="Ver senha (pede o PIN)" onClick={() => handleReveal(c)} />
    </div>
  )

  const abaBtn = (id: Aba, label: string, n: number) => {
    const active = aba === id
    return (
      <button
        type="button"
        role="tab"
        aria-selected={active}
        onClick={() => setAba(id)}
        className={`h-9 px-4 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${active ? '' : 'hover:bg-gray-50'}`}
        style={{
          fontFamily: 'Manrope',
          ...(active ? { backgroundColor: 'var(--color-brand)', color: '#fff' } : { color: 'var(--color-sidebar-text)' }),
        }}
      >
        {label} <span className="opacity-70 font-medium">({n})</span>
      </button>
    )
  }

  return (
    <>
      <div className="mb-6">
        {/* Título e breadcrumb na mesma linha */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>
            Cofre de senhas
          </h1>
          <Breadcrumb />
        </div>
        <p className="text-sm mt-1 animate-enter" style={{ color: 'var(--color-text-muted)', animationDelay: '60ms' }}>
          Seus logins e senhas pessoais, guardados com criptografia. Ver ou compartilhar uma senha pede o seu PIN de segurança.
        </p>
      </div>

      {/* Sem PIN: aviso fixo com atalho para cadastrar */}
      {!temPin && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
          <p className="text-sm flex items-center gap-2">
            <Icon name="lock" size={16} />
            Cadastre um PIN de segurança para poder ver e compartilhar as senhas do cofre.
          </p>
          <Link href={LINK_CADASTRAR_PIN} className="text-sm font-semibold underline">Cadastrar PIN</Link>
        </div>
      )}

      <div className="app-card p-5 flex flex-col gap-4">
        {/* Duas partes do cofre */}
        <div className="flex flex-wrap gap-2" role="tablist">
          {abaBtn('minhas', 'Minhas credenciais', minhas.length)}
          {abaBtn('compartilhadas', 'Compartilhadas comigo', compartilhadas.length)}
        </div>

        {/* Busca + adicionar (só nas minhas) */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px] flex items-center gap-2 h-9 px-3 rounded-lg border" style={{ borderColor: 'var(--color-card-border)' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0" style={{ color: 'var(--color-text-muted)' }}>
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Pesquisar por identificação, login ou observação..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 min-w-0 bg-transparent text-sm outline-none"
              style={{ color: 'var(--color-text-primary)' }}
            />
          </div>
          {aba === 'minhas' && <AddButton onClick={openAdd} />}
        </div>

        {/* Minhas credenciais */}
        {aba === 'minhas' && (
          <ul className="flex flex-col gap-3">
            {minhasFiltradas.length === 0 && (
              <ListEmpty>{search ? 'Nenhuma credencial encontrada para essa pesquisa.' : 'Nenhuma credencial cadastrada.'}</ListEmpty>
            )}
            {minhasFiltradas.map((c) => {
              const n = c.compartilhamentos.length
              return (
                <ListItem
                  key={c.id}
                  icon="lock"
                  title={c.sistema}
                  subtitle={
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-xs truncate">{c.login}</span>
                      {n > 0 && (
                        <span className="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}>
                          Compartilhada com {n}
                        </span>
                      )}
                    </span>
                  }
                  aside={senhaAside(c)}
                  actionsLabel={c.sistema}
                  actions={[
                    ...(c.url ? [{ icon: 'external' as const, label: 'Abrir site', onClick: () => window.open(c.url!, '_blank', 'noopener,noreferrer') }] : []),
                    { icon: 'info', label: c.observacao ? 'Observação' : 'Sem observação', onClick: () => setInfoTarget(c) },
                    { icon: 'users', label: n ? `Compartilhar (${n})` : 'Compartilhar', onClick: () => exigirPin(() => setCompartilharId(c.id)) },
                    { icon: 'pencil', label: 'Editar', onClick: () => openEdit(c) },
                    { icon: 'trash', label: 'Remover', tone: 'danger', onClick: () => setConfirmTarget(c), disabled: deletingId === c.id },
                  ]}
                />
              )
            })}
          </ul>
        )}

        {/* Compartilhadas comigo: só visualização */}
        {aba === 'compartilhadas' && (
          <ul className="flex flex-col gap-3">
            {compartilhadasFiltradas.length === 0 && (
              <ListEmpty>{search ? 'Nenhuma credencial encontrada para essa pesquisa.' : 'Ninguém compartilhou credenciais com você ainda.'}</ListEmpty>
            )}
            {compartilhadasFiltradas.map((c) => (
              <ListItem
                key={c.id}
                icon="users"
                title={c.sistema}
                subtitle={
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-xs truncate">{c.login}</span>
                    <span className="shrink-0 text-xs">· de {c.dono_nome}</span>
                  </span>
                }
                aside={senhaAside(c)}
                actionsLabel={c.sistema}
                actions={[
                  ...(c.url ? [{ icon: 'external' as const, label: 'Abrir site', onClick: () => window.open(c.url!, '_blank', 'noopener,noreferrer') }] : []),
                  { icon: 'info', label: c.observacao ? 'Observação' : 'Sem observação', onClick: () => setInfoTarget(c) },
                ]}
              />
            ))}
          </ul>
        )}
      </div>

      <ModalCredential open={modalOpen} onClose={() => setModalOpen(false)} credential={editingCredential} />

      <ModalCompartilhar credential={compartilharCred} onClose={() => setCompartilharId(null)} />

      <ModalVerSenha
        credencial={revelarTarget}
        onClose={() => setRevelarTarget(null)}
        onConfirmar={revealPasswordAction}
        onSemPin={() => setSemPinOpen(true)}
      />

      <ModalSemPin open={semPinOpen} onClose={() => setSemPinOpen(false)} />

      {/* Observação da credencial */}
      <Modal open={!!infoTarget} onClose={() => setInfoTarget(null)} title={`Observação · ${infoTarget?.sistema ?? ''}`}>
        <div className="flex items-start gap-4">
          <span
            className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}
          >
            <Icon name="info" size={20} />
          </span>
          <p
            className="text-sm pt-2.5 whitespace-pre-wrap break-words flex-1 min-w-0"
            style={{ color: infoTarget?.observacao ? 'var(--color-text-secondary)' : 'var(--color-text-muted)' }}
          >
            {infoTarget?.observacao || 'Nenhuma observação cadastrada para esta credencial.'}
          </p>
        </div>
        <div className="flex justify-end pt-6">
          <Button type="button" onClick={() => setInfoTarget(null)}>Fechar</Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmTarget}
        onClose={() => { if (!deletingId) setConfirmTarget(null) }}
        onConfirm={confirmDelete}
        loading={!!deletingId}
        title="Remover credencial"
        message={
          <p>
            Remover a credencial de <strong>{confirmTarget?.sistema}</strong> do cofre de senhas?
            {!!confirmTarget?.compartilhamentos.length && ' Quem a recebeu por compartilhamento também perde o acesso.'}
          </p>
        }
      />
    </>
  )
}
