'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ModalPesquisa } from './modal-pesquisa'
import { deleteSurveyAction, toggleSurveyStatusAction } from '../actions'
import type { Survey } from '../queries'

interface Props {
  surveys: Survey[]
  companyId: string
}

const STATUS_CONFIG = {
  rascunho:  { label: 'Rascunho',  bg: '#F4F6F7', text: '#717D7E' },
  ativo:     { label: 'Ativa',     bg: '#E9F7EF', text: '#1E8449' },
  encerrado: { label: 'Encerrada', bg: '#FDEDEC', text: '#C0392B' },
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR')
}

// ── ThreeDotMenu ──────────────────────────────────────────────────────────────
function ThreeDotMenu({ survey, onEdit, onDelete, onCopyLink, onResults, loading }: {
  survey: Survey
  onEdit: () => void
  onDelete: () => void
  onCopyLink: () => void
  onResults: () => void
  loading: boolean
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, right: 0 })
  const menuRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function handleOpen() {
    const rect = btnRef.current?.getBoundingClientRect()
    if (rect) {
      const openUp = rect.bottom + 172 > window.innerHeight - 8
      setPos(openUp
        ? { top: rect.top - 168, right: window.innerWidth - rect.right }
        : { top: rect.bottom + 4, right: window.innerWidth - rect.right }
      )
    }
    setOpen(v => !v)
  }

  return (
    <div>
      <button
        ref={btnRef}
        type="button"
        onClick={handleOpen}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-lg hover:bg-gray-100 transition-colors"
        style={{ color: 'var(--color-text-muted)' }}
        aria-label="Opções"
      >
        ···
      </button>
      {open && (
        <div
          ref={menuRef}
          className="fixed w-44 rounded-xl border shadow-lg py-1 z-50"
          style={{ backgroundColor: 'white', borderColor: 'var(--color-bg-surface)', top: pos.top, right: pos.right }}
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
            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
            onClick={() => { setOpen(false); onCopyLink() }}
          >
            Copiar link
          </button>
          <button
            type="button"
            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
            onClick={() => { setOpen(false); onResults() }}
          >
            Ver resultados
          </button>
          <div className="my-1 border-t" style={{ borderColor: 'var(--color-bg-surface)' }} />
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

// ── LinkModal ─────────────────────────────────────────────────────────────────
function LinkModal({ survey, onClose }: { survey: Survey; onClose: () => void }) {
  const router = useRouter()
  const link = typeof window !== 'undefined'
    ? `${window.location.origin}/pesquisa/${survey.id}`
    : `/pesquisa/${survey.id}`
  const [copied, setCopied] = useState(false)
  const [activating, setActivating] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleActivate() {
    setActivating(true)
    await toggleSurveyStatusAction(survey.id, 'ativo')
    setActivating(false)
    router.refresh()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="font-semibold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
              Link da pesquisa
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              {survey.titulo}
            </p>
          </div>
          <button onClick={onClose} className="text-sm hover:opacity-60" style={{ color: 'var(--color-text-muted)' }}>✕</button>
        </div>

        {survey.status === 'rascunho' && (
          <div className="mb-4 p-3 rounded-lg text-xs" style={{ backgroundColor: '#FEF9E7', color: '#9A7D0A' }}>
            Esta pesquisa ainda está em <strong>Rascunho</strong>. Ative-a para que os colaboradores possam responder.
            <br />
            <button
              onClick={handleActivate}
              disabled={activating}
              className="mt-2 font-semibold underline"
            >
              {activating ? 'Ativando…' : 'Ativar pesquisa agora'}
            </button>
          </div>
        )}

        {survey.status === 'encerrado' && (
          <div className="mb-4 p-3 rounded-lg text-xs" style={{ backgroundColor: '#FDEDEC', color: '#C0392B' }}>
            Esta pesquisa está <strong>encerrada</strong>. Novas respostas não serão aceitas.
          </div>
        )}

        <div className="flex items-center gap-2 p-3 rounded-lg border" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'var(--color-bg-surface)' }}>
          <p className="flex-1 text-xs truncate" style={{ color: 'var(--color-text-secondary)' }}>{link}</p>
          <button
            onClick={handleCopy}
            className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            style={{
              backgroundColor: copied ? '#E9F7EF' : 'var(--color-primary)',
              color: copied ? '#1E8449' : 'var(--color-primary-darker)',
            }}
          >
            {copied ? '✓ Copiado' : 'Copiar'}
          </button>
        </div>

        <a
          href={`https://wa.me/?text=${encodeURIComponent(`Responda nossa pesquisa: ${link}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex items-center justify-center gap-2 w-full py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
          style={{ backgroundColor: '#25D366', color: 'white' }}
        >
          Compartilhar no WhatsApp
        </a>

        <button onClick={onClose} className="mt-3 w-full text-sm py-2" style={{ color: 'var(--color-text-muted)' }}>
          Fechar
        </button>
      </div>
    </div>
  )
}

// ── PesquisasClient ───────────────────────────────────────────────────────────
export function PesquisasClient({ surveys, companyId }: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingSurvey, setEditingSurvey] = useState<Survey | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [search, setSearch] = useState('')
  const [linkSurvey, setLinkSurvey] = useState<Survey | null>(null)

  const filtered = surveys.filter(s => {
    const matchStatus = filterStatus ? s.status === filterStatus : true
    const q = search.toLowerCase()
    const matchSearch = q ? s.titulo.toLowerCase().includes(q) : true
    return matchStatus && matchSearch
  })

  function openAdd() { setEditingSurvey(null); setModalOpen(true) }
  function openEdit(s: Survey) { setEditingSurvey(s); setModalOpen(true) }

  function handleCopyLink(s: Survey) {
    setLinkSurvey(s)
  }

  function handleResults(s: Survey) {
    router.push(`/pessoas/pesquisas/${s.id}/resultados`)
  }

  async function handleDelete(s: Survey) {
    if (!confirm(`Excluir a pesquisa "${s.titulo}"?`)) return
    setDeletingId(s.id)
    const result = await deleteSurveyAction(s.id)
    setDeletingId(null)
    if ('error' in result) alert(result.error)
    else router.refresh()
  }

  const counts = {
    rascunho:  surveys.filter(s => s.status === 'rascunho').length,
    ativo:     surveys.filter(s => s.status === 'ativo').length,
    encerrado: surveys.filter(s => s.status === 'encerrado').length,
  }

  return (
    <>
      {linkSurvey && <LinkModal survey={linkSurvey} onClose={() => setLinkSurvey(null)} />}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
            Pesquisas de Clima
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Pesquisas de satisfação e clima organizacional
          </p>
        </div>
        <Button onClick={openAdd}>Adicionar</Button>
      </div>

      {/* Cards de status */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {(['rascunho', 'ativo', 'encerrado'] as const).map(s => {
          const cfg = STATUS_CONFIG[s]
          const isActive = filterStatus === s
          return (
            <button
              key={s}
              onClick={() => setFilterStatus(isActive ? '' : s)}
              className="p-3 rounded-xl border text-center transition-all"
              style={{ borderColor: isActive ? cfg.text : 'var(--color-bg-surface)', backgroundColor: isActive ? cfg.bg : 'white' }}
            >
              <div className="text-2xl font-bold" style={{ color: cfg.text }}>{counts[s]}</div>
              <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{cfg.label}</div>
            </button>
          )
        })}
      </div>

      {/* Busca */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Buscar por título..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full px-4 py-2 rounded-lg border text-sm"
          style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white', color: 'var(--color-text-primary)' }}
        />
      </div>

      {/* Tabela */}
      <div className="rounded-xl border overflow-x-auto" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
        <table className="w-full min-w-[600px] text-sm">
          <thead style={{ backgroundColor: 'var(--color-bg-surface)' }}>
            <tr>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Título</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Perguntas</th>
              <th className="text-right px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Respostas</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Período</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Status</th>
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-10" style={{ color: 'var(--color-text-muted)' }}>
                  {search || filterStatus ? 'Nenhum resultado.' : 'Nenhuma pesquisa cadastrada.'}
                </td>
              </tr>
            )}
            {filtered.map(s => {
              const cfg = STATUS_CONFIG[s.status]
              return (
                <tr key={s.id} className="border-t" style={{ borderColor: 'var(--color-bg-surface)' }}>
                  <td className="px-4 py-3" style={{ color: 'var(--color-text-primary)' }}>
                    <div className="font-medium">{s.titulo}</div>
                    {s.descricao && (
                      <div className="text-xs mt-0.5 truncate max-w-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {s.descricao}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>
                    {s.perguntas.length} {s.perguntas.length === 1 ? 'pergunta' : 'perguntas'}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold" style={{ color: (s.response_count ?? 0) > 0 ? 'var(--color-primary-darker)' : 'var(--color-text-muted)' }}>
                    {s.response_count ?? 0}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    {s.data_inicio || s.data_fim
                      ? `${formatDate(s.data_inicio)} → ${formatDate(s.data_fim)}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{ backgroundColor: cfg.bg, color: cfg.text }}>
                      {cfg.label}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-end">
                      <ThreeDotMenu
                        survey={s}
                        onEdit={() => openEdit(s)}
                        onDelete={() => handleDelete(s)}
                        onCopyLink={() => handleCopyLink(s)}
                        onResults={() => handleResults(s)}
                        loading={deletingId === s.id}
                      />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <ModalPesquisa open={modalOpen} onClose={() => setModalOpen(false)} companyId={companyId} survey={editingSurvey} />
    </>
  )
}
