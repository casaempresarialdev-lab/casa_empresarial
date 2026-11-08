'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AddButton } from '@/components/ui/add-button'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Icon } from '@/components/ui/icon'
import { Input } from '@/components/ui/input'
import { ListEmpty, ListItem } from '@/components/ui/list-item'
import { Modal } from '@/components/ui/modal'
import { toast } from '@/lib/toast'
import { MODULOS, TODAS_AS_CHAVES } from '@/lib/acesso/catalogo'
import { excluirPerfilAcessoAction, salvarPerfilAcessoAction } from '../actions'
import type { Invitation, MemberWithProfile, PerfilAcesso } from '../queries'

// Interruptor: sem <label> em volta, senão o clique conta duas vezes e o estado não muda
function Interruptor({ ligado, rotulo, onAlternar }: { ligado: boolean; rotulo: string; onAlternar: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      aria-label={rotulo}
      onClick={onAlternar}
      className="relative inline-block w-10 h-6 p-0 rounded-full transition-colors shrink-0 cursor-pointer"
      style={{ backgroundColor: ligado ? 'var(--color-brand)' : '#D1D5DB' }}
    >
      <span className={`absolute left-0 top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${ligado ? 'translate-x-5' : 'translate-x-1'}`} />
    </button>
  )
}

// Criar ou editar: o nome e o acesso em cada módulo e em cada item dele
function ModalPerfil({ perfil, companyId, onClose }: { perfil: PerfilAcesso | null; companyId: string; onClose: () => void }) {
  const router = useRouter()
  const [nome, setNome] = useState(perfil?.nome ?? '')
  const [liberados, setLiberados] = useState(() => new Set(perfil?.permissoes ?? []))
  const [abertos, setAbertos] = useState<Set<string>>(new Set())
  const [erroNome, setErroNome] = useState('')
  const [salvando, setSalvando] = useState(false)

  function alternarItem(key: string) {
    setLiberados((s) => {
      const n = new Set(s)
      if (n.has(key)) n.delete(key)
      else n.add(key)
      return n
    })
  }

  // Módulo: liga tudo se faltar algum item; com todos ligados, desliga tudo
  function alternarModulo(chaves: string[]) {
    setLiberados((s) => {
      const n = new Set(s)
      const todos = chaves.every((k) => n.has(k))
      for (const k of chaves) {
        if (todos) n.delete(k)
        else n.add(k)
      }
      return n
    })
  }

  function alternarAberto(key: string) {
    setAbertos((s) => {
      const n = new Set(s)
      if (n.has(key)) n.delete(key)
      else n.add(key)
      return n
    })
  }

  async function salvar() {
    if (!nome.trim()) { setErroNome('Dê um nome ao perfil'); return }
    setErroNome('')
    setSalvando(true)
    const r = await toast.promise(salvarPerfilAcessoAction(companyId, perfil?.id ?? null, { nome, permissoes: [...liberados] }), {
      loading: 'Salvando o perfil…',
      success: 'Perfil de acesso salvo.',
      error: 'Não foi possível salvar o perfil.',
    })
    setSalvando(false)
    if ('error' in r) return
    onClose()
    router.refresh()
  }

  return (
    <Modal open onClose={() => { if (!salvando) onClose() }} title={perfil ? 'Editar perfil de acesso' : 'Novo perfil de acesso'} className="sm:max-w-2xl">
      <div className="flex flex-col gap-4">
        <Input label="Nome do perfil *" placeholder="Ex.: Financeiro" maxLength={60} value={nome} onChange={(e) => setNome(e.target.value)} error={erroNome} autoFocus={!perfil} />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            Acesso por módulo <span className="font-normal" style={{ color: 'var(--color-text-muted)' }}>· {liberados.size} de {TODAS_AS_CHAVES.length} itens</span>
          </p>
          <div className="flex gap-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => setLiberados(new Set(TODAS_AS_CHAVES))}>Liberar tudo</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setLiberados(new Set())}>Limpar</Button>
          </div>
        </div>

        <ul className="flex flex-col gap-2">
          {MODULOS.map((m) => {
            const chaves = m.itens.map((i) => i.key)
            const ligados = chaves.filter((k) => liberados.has(k)).length
            const umItem = m.itens.length === 1
            const aberto = abertos.has(m.key)
            return (
              <li key={m.key} className="rounded-xl border" style={{ borderColor: 'var(--color-card-border)' }}>
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => { if (!umItem) alternarAberto(m.key) }}
                    aria-expanded={umItem ? undefined : aberto}
                    className={`flex-1 min-w-0 flex items-center gap-3 text-left ${umItem ? 'cursor-default' : 'cursor-pointer'}`}
                  >
                    <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}>
                      <Icon name={m.icon} size={16} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>{m.label}</span>
                      {!umItem && <span className="block text-xs" style={{ color: 'var(--color-text-muted)' }}>{ligados} de {chaves.length} itens</span>}
                    </span>
                    {!umItem && (
                      <span className="shrink-0 transition-transform duration-200" style={{ color: 'var(--color-text-muted)', transform: aberto ? 'rotate(90deg)' : undefined }}>
                        <Icon name="chevron-right" size={16} />
                      </span>
                    )}
                  </button>
                  <Interruptor ligado={ligados === chaves.length} rotulo={`Todo o módulo ${m.label}`} onAlternar={() => alternarModulo(chaves)} />
                </div>
                {!umItem && aberto && (
                  <ul className="border-t px-3 py-1" style={{ borderColor: 'var(--color-card-border)' }}>
                    {m.itens.map((i) => (
                      <li key={i.key} className="flex items-center justify-between gap-3 py-2 pl-11">
                        <span className="text-sm min-w-0" style={{ color: 'var(--color-text-secondary)' }}>{i.label}</span>
                        <Interruptor ligado={liberados.has(i.key)} rotulo={`${m.label}: ${i.label}`} onAlternar={() => alternarItem(i.key)} />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} disabled={salvando}>Cancelar</Button>
          <Button type="button" onClick={salvar} loading={salvando}>Salvar</Button>
        </div>
      </div>
    </Modal>
  )
}

export function PerfisAcesso({ perfis, membros, convites, companyId }: {
  perfis: PerfilAcesso[]
  membros: MemberWithProfile[]
  convites: Invitation[]
  companyId: string
}) {
  const router = useRouter()
  // undefined = fechado; null = novo
  const [editando, setEditando] = useState<PerfilAcesso | null | undefined>(undefined)
  const [excluir, setExcluir] = useState<PerfilAcesso | null>(null)
  const [excluindo, setExcluindo] = useState(false)

  const emUso = (id: string) => membros.filter((m) => m.status === 'active' && m.access_profile_ids.includes(id)).length
  const emConvite = (id: string) => convites.filter((c) => c.access_profile_ids?.includes(id)).length
  const descricao = (p: PerfilAcesso) =>
    p.padrao === 'administrador' ? 'Acesso total'
      : p.padrao === 'funcionario' ? 'Calendário, ponto, Minha conta e Cofre de senhas'
      : `${p.permissoes.length} de ${TODAS_AS_CHAVES.length} itens liberados`

  async function confirmarExclusao() {
    const p = excluir
    if (!p) return
    setExcluindo(true)
    const r = await toast.promise(excluirPerfilAcessoAction(companyId, p.id), {
      loading: `Excluindo ${p.nome}…`,
      success: `Perfil ${p.nome} excluído.`,
      error: 'Não foi possível excluir o perfil.',
    })
    setExcluindo(false)
    setExcluir(null)
    if (!('error' in r)) router.refresh()
  }

  return (
    <>
      <div className="app-card p-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm" style={{ color: 'var(--color-sidebar-text)' }}>
            <span className="font-semibold">{perfis.length} {perfis.length === 1 ? 'perfil' : 'perfis'}</span>
            <span style={{ color: 'var(--color-text-muted)' }}> · Acumulativos: quem tem mais de um soma os acessos. Proprietário tem acesso total e Colaborador, só aos próprios dados</span>
          </p>
          <AddButton onClick={() => setEditando(null)} label="Novo perfil" />
        </div>

        <ul className="flex flex-col gap-3">
          {perfis.length === 0 && <ListEmpty>Nenhum perfil de acesso cadastrado.</ListEmpty>}
          {perfis.map((p) => {
            const usuarios = emUso(p.id)
            const pendentes = emConvite(p.id)
            return (
              <ListItem
                key={p.id}
                icon={p.padrao ? 'lock' : 'shield'}
                title={p.nome}
                subtitle={[
                  descricao(p),
                  `${usuarios} ${usuarios === 1 ? 'usuário' : 'usuários'}`,
                  pendentes ? `${pendentes} ${pendentes === 1 ? 'convite' : 'convites'}` : null,
                ].filter(Boolean).join(' · ')}
                aside={p.padrao ? <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Padrão</span> : undefined}
                onClick={p.padrao ? undefined : () => setEditando(p)}
                actionsLabel={p.nome}
                actions={p.padrao
                  ? [{ icon: 'lock', label: 'Perfil padrão: não pode ser alterado', onClick: () => {}, disabled: true }]
                  : [
                      { icon: 'pencil', label: 'Editar', onClick: () => setEditando(p) },
                      { icon: 'trash', label: 'Excluir', tone: 'danger', onClick: () => setExcluir(p) },
                    ]}
              />
            )
          })}
        </ul>
      </div>

      {editando !== undefined && (
        <ModalPerfil key={editando?.id ?? 'novo'} perfil={editando} companyId={companyId} onClose={() => setEditando(undefined)} />
      )}

      <ConfirmDialog
        open={!!excluir}
        onClose={() => { if (!excluindo) setExcluir(null) }}
        onConfirm={confirmarExclusao}
        loading={excluindo}
        title="Excluir perfil"
        message={<p>Excluir o perfil <strong>{excluir?.nome}</strong>?</p>}
      />
    </>
  )
}
