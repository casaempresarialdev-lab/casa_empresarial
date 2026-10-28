'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/ui/icon'
import { IconButton } from '@/components/ui/icon-button'
import { ListItem, ListEmpty } from '@/components/ui/list-item'
import { AddButton } from '@/components/ui/add-button'
import { ModalPinConfirmacao, ModalSemPin } from '@/components/ui/modal-pin'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/toast'
import { ModalCredential } from './modal-credential'
import { ModalCompartilhar } from './modal-compartilhar'
import { ModalVerSenha, LINK_CADASTRAR_PIN } from './modal-pin-cofre'
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

type Aba = 'todas' | 'minhas' | 'compartilhadas'
type Revelavel = { id: string; sistema: string; login: string; url: string | null; observacao: string | null }

export function CredentialsClient({ minhas, compartilhadas, temPin, abaInicial = 'todas' }: Props) {
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
  // Todas: minhas + compartilhadas comigo, em ordem alfabética
  const todasFiltradas = [
    ...minhasFiltradas.map((c) => ({ tipo: 'minha' as const, c })),
    ...compartilhadasFiltradas.map((c) => ({ tipo: 'recebida' as const, c })),
  ].sort((a, b) => a.c.sistema.localeCompare(b.c.sistema, 'pt-BR'))

  function openAdd() { setEditingCredential(null); setModalOpen(true) }
  // Editar pede o PIN ao salvar; sem PIN cadastrado, avisa antes
  function openEdit(c: Credential) { exigirPin(() => { setEditingCredential(c); setModalOpen(true) }) }

  // Ações que exigem PIN: sem PIN cadastrado, avisa e leva ao perfil
  function exigirPin(acao: () => void) {
    if (!temPin) { setSemPinOpen(true); return }
    acao()
  }

  function handleReveal(c: Revelavel) {
    exigirPin(() => setRevelarTarget(c))
  }

  // Remoção confirmada com o PIN (erro de PIN aparece no próprio campo)
  async function confirmDelete(pin: string) {
    const c = confirmTarget
    if (!c) return
    setDeletingId(c.id)
    const r = await deleteCredentialAction(c.id, pin)
    setDeletingId(null)
    if ('error' in r && r.error) return { error: r.error }
    toast(`Credencial de ${c.sistema} removida do cofre.`)
    setConfirmTarget(null)
    router.refresh()
  }

  // Senha sempre escondida na lista; o olho abre o modal (PIN → senha com botão de copiar)
  const senhaAside = (c: Revelavel) => (
    <div className="flex items-center gap-1">
      <span className="font-mono text-xs min-w-20 text-right" style={{ color: 'var(--color-text-secondary)' }}>••••••••</span>
      <IconButton icon="eye" label="Ver senha (pede o PIN)" onClick={() => handleReveal(c)} />
    </div>
  )

  const itemMinha = (c: Credential) => {
    const n = c.compartilhamentos.length
    return (
      <ListItem
        key={c.id}
        // Mesmo tamanho da foto das compartilhadas, para os títulos alinharem em "Todas"
        media={
          <span className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}>
            <Icon name="lock" size={17} />
          </span>
        }
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
          { icon: 'trash', label: 'Remover', tone: 'danger', onClick: () => exigirPin(() => setConfirmTarget(c)), disabled: deletingId === c.id },
        ]}
      />
    )
  }

  // Recebida: foto de quem compartilhou com o selo de compartilhamento (só visualização)
  const itemRecebida = (c: CredencialCompartilhada) => (
    <ListItem
      key={c.id}
      media={<FotoDono nome={c.dono_nome} avatar={c.dono_avatar} />}
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
          {abaBtn('todas', 'Todas', minhas.length + compartilhadas.length)}
          {abaBtn('minhas', 'Minhas credenciais', minhas.length)}
          {abaBtn('compartilhadas', 'Compartilhadas comigo', compartilhadas.length)}
        </div>

        {/* Busca + adicionar (não aparece nas compartilhadas) */}
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
          {aba !== 'compartilhadas' && <AddButton onClick={openAdd} />}
        </div>

        {/* Todas: minhas + compartilhadas comigo */}
        {aba === 'todas' && (
          <ul className="flex flex-col gap-3">
            {todasFiltradas.length === 0 && (
              <ListEmpty>{search ? 'Nenhuma credencial encontrada para essa pesquisa.' : 'Nenhuma credencial no cofre ainda.'}</ListEmpty>
            )}
            {todasFiltradas.map((x) => x.tipo === 'minha' ? itemMinha(x.c) : itemRecebida(x.c))}
          </ul>
        )}

        {/* Minhas credenciais */}
        {aba === 'minhas' && (
          <ul className="flex flex-col gap-3">
            {minhasFiltradas.length === 0 && (
              <ListEmpty>{search ? 'Nenhuma credencial encontrada para essa pesquisa.' : 'Nenhuma credencial cadastrada.'}</ListEmpty>
            )}
            {minhasFiltradas.map(itemMinha)}
          </ul>
        )}

        {/* Compartilhadas comigo: só visualização */}
        {aba === 'compartilhadas' && (
          <ul className="flex flex-col gap-3">
            {compartilhadasFiltradas.length === 0 && (
              <ListEmpty>{search ? 'Nenhuma credencial encontrada para essa pesquisa.' : 'Ninguém compartilhou credenciais com você ainda.'}</ListEmpty>
            )}
            {compartilhadasFiltradas.map(itemRecebida)}
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

      <ModalSemPin open={semPinOpen} onClose={() => setSemPinOpen(false)} motivo="ver, editar, remover ou compartilhar senhas do cofre" />

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

      {/* Remover: confirmação com o PIN */}
      <ModalPinConfirmacao
        open={!!confirmTarget}
        titulo="Remover credencial"
        subtitulo={confirmTarget?.sistema}
        descricao={
          <>
            Informe o seu PIN de segurança para remover a credencial do cofre.
            {!!confirmTarget?.compartilhamentos.length && ' Quem a recebeu por compartilhamento também perde o acesso.'}
          </>
        }
        acaoLabel="Remover credencial"
        perigo
        onClose={() => setConfirmTarget(null)}
        onConfirmar={confirmDelete}
      />
    </>
  )
}

// Foto de quem compartilhou (ou a inicial), com o selo de compartilhamento no canto
function FotoDono({ nome, avatar }: { nome: string; avatar: string | null }) {
  return (
    <span className="relative shrink-0 w-9 h-9" title={`Compartilhada por ${nome}`}>
      <span className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center text-sm font-bold" style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}>
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt={nome} className="w-full h-full object-cover" />
        ) : nome.charAt(0).toUpperCase()}
      </span>
      <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center ring-2 ring-white" style={{ backgroundColor: 'var(--color-brand)', color: '#fff' }}>
        <Icon name="share" size={11} />
      </span>
    </span>
  )
}
