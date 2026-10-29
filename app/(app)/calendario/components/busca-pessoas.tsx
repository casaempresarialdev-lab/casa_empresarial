'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Icon } from '@/components/ui/icon'
import { buscarPessoaAction, listarContatosAction } from '../actions'
import type { Pessoa } from '../queries'
import { Avatar } from './avatar'

const MAX_SUGESTOES = 6
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// Contatos carregados uma vez por sessão da página (membros das minhas empresas)
let contatosCache: Promise<Pessoa[]> | null = null

interface Props {
  /** Já escolhidos: não aparecem nas sugestões */
  excluir: string[]
  onAdicionar: (p: Pessoa) => void | Promise<void>
  placeholder?: string
  /** Ex.: enviando o compartilhamento */
  ocupado?: boolean
  erroExterno?: string | null
}

// Campo que pesquisa usuários pelo nome ou e-mail enquanto digita e adiciona ao escolher.
// Quem não está nas sugestões (de outra empresa) pode ser adicionado digitando o e-mail completo + Enter.
export function BuscaPessoas({ excluir, onAdicionar, placeholder = 'Pesquise pelo nome ou e-mail', ocupado, erroExterno }: Props) {
  const listaId = useId()
  const caixaRef = useRef<HTMLDivElement>(null)
  const [contatos, setContatos] = useState<Pessoa[]>([])
  const [termo, setTermo] = useState('')
  const [aberto, setAberto] = useState(false)
  const [ativo, setAtivo] = useState(0)
  const [buscando, setBuscando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    contatosCache ??= listarContatosAction().catch(() => [])
    contatosCache.then(setContatos)
  }, [])

  // Fecha a lista ao clicar fora
  useEffect(() => {
    if (!aberto) return
    const fora = (ev: MouseEvent) => { if (!caixaRef.current?.contains(ev.target as Node)) setAberto(false) }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [aberto])

  const sugestoes = useMemo(() => {
    const q = normalizar(termo.trim())
    if (!q) return []
    const fora = new Set(excluir)
    return contatos
      .filter((c) => !fora.has(c.id) && (normalizar(c.nome).includes(q) || c.email.includes(q)))
      .slice(0, MAX_SUGESTOES)
  }, [termo, contatos, excluir])

  async function escolher(p: Pessoa) {
    setTermo('')
    setAberto(false)
    setErro(null)
    await onAdicionar(p)
  }

  // Enter sem sugestão: tenta o e-mail digitado (pode ser usuário de outra empresa)
  async function porEmail() {
    const email = termo.trim().toLowerCase()
    if (!EMAIL_RE.test(email)) { setErro(sugestoes.length ? null : 'Nenhum usuário encontrado. Digite o e-mail completo para procurar.'); return }
    if (excluir.length && contatos.some((c) => c.email === email && excluir.includes(c.id))) { setErro('Esta pessoa já está na lista.'); return }
    setBuscando(true)
    const r = await buscarPessoaAction(email)
    setBuscando(false)
    if (!r.pessoa) { setErro(r.error ?? 'Não foi possível encontrar este usuário.'); return }
    if (excluir.includes(r.pessoa.id)) { setErro('Esta pessoa já está na lista.'); return }
    await escolher(r.pessoa)
  }

  function onKeyDown(ev: React.KeyboardEvent<HTMLInputElement>) {
    if (ev.key === 'ArrowDown' && sugestoes.length) { ev.preventDefault(); setAberto(true); setAtivo((i) => (i + 1) % sugestoes.length) }
    else if (ev.key === 'ArrowUp' && sugestoes.length) { ev.preventDefault(); setAtivo((i) => (i - 1 + sugestoes.length) % sugestoes.length) }
    else if (ev.key === 'Escape') setAberto(false)
    else if (ev.key === 'Enter') {
      ev.preventDefault() // não envia o formulário do evento
      if (aberto && sugestoes[ativo]) escolher(sugestoes[ativo])
      else porEmail()
    }
  }

  const mensagem = erro ?? erroExterno
  const carregando = buscando || ocupado

  return (
    <div ref={caixaRef} className="relative flex flex-col gap-1">
      <div
        className="flex items-center gap-2 h-10 px-3 rounded-lg border bg-white focus-within:ring-2 focus-within:ring-[var(--color-brand)]"
        style={{ borderColor: mensagem ? 'var(--color-error)' : 'var(--color-bg-surface)' }}
      >
        <span style={{ color: 'var(--color-text-muted)' }}><Icon name="users" size={16} /></span>
        <input
          type="text"
          role="combobox"
          aria-expanded={aberto && sugestoes.length > 0}
          aria-controls={listaId}
          aria-autocomplete="list"
          autoComplete="off"
          value={termo}
          onChange={(e) => { setTermo(e.target.value); setAberto(true); setAtivo(0); setErro(null) }}
          onFocus={() => setAberto(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          disabled={carregando}
          className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-gray-400"
          style={{ color: 'var(--color-text-primary)' }}
        />
        {carregando && <span className="w-4 h-4 rounded-full border-2 border-gray-200 border-t-[var(--color-brand)] animate-spin shrink-0" aria-label="Procurando" />}
      </div>
      {mensagem && <p className="text-xs" style={{ color: 'var(--color-error)' }}>{mensagem}</p>}

      {aberto && termo.trim() && (
        <ul id={listaId} role="listbox" className="absolute left-0 right-0 top-11 z-20 rounded-xl border bg-white shadow-lg p-1 max-h-64 overflow-y-auto" style={{ borderColor: 'var(--color-bg-surface)' }}>
          {sugestoes.map((p, i) => (
            <li key={p.id} role="option" aria-selected={i === ativo}>
              <button
                type="button"
                onMouseEnter={() => setAtivo(i)}
                onClick={() => escolher(p)}
                className="w-full flex items-center gap-3 px-2 py-1.5 rounded-lg text-left cursor-pointer"
                style={i === ativo ? { backgroundColor: 'var(--color-brand-light)' } : undefined}
              >
                <Avatar nome={p.nome} url={p.avatar_url} size={28} />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{p.nome}</span>
                  <span className="block text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>{p.email}</span>
                </span>
              </button>
            </li>
          ))}
          {sugestoes.length === 0 && (
            <li className="px-2 py-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {EMAIL_RE.test(termo.trim()) ? 'Pressione Enter para procurar este e-mail.' : 'Nenhum usuário encontrado. Digite o e-mail completo para procurar.'}
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
