'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createSurveyAction, updateSurveyAction } from '../actions'
import type { Survey, SurveyQuestion } from '../queries'

interface Props {
  open: boolean
  onClose: () => void
  companyId: string
  survey: Survey | null
}

function newQuestion(): SurveyQuestion {
  return { id: crypto.randomUUID(), texto: '', tipo: 'escala', opcoes: [] }
}

export function ModalPesquisa({ open, onClose, companyId, survey }: Props) {
  const router = useRouter()
  const isEdit = !!survey

  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [status, setStatus] = useState('rascunho')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [perguntas, setPerguntas] = useState<SurveyQuestion[]>([])
  const [tab, setTab] = useState<'info' | 'perguntas'>('info')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    setTab('info')
    if (survey) {
      setTitulo(survey.titulo)
      setDescricao(survey.descricao ?? '')
      setStatus(survey.status)
      setDataInicio(survey.data_inicio ?? '')
      setDataFim(survey.data_fim ?? '')
      setPerguntas(survey.perguntas ?? [])
    } else {
      setTitulo(''); setDescricao(''); setStatus('rascunho')
      setDataInicio(''); setDataFim(''); setPerguntas([])
    }
  }, [open, survey])

  function addPergunta() {
    setPerguntas(prev => [...prev, newQuestion()])
  }

  function removePergunta(idx: number) {
    setPerguntas(prev => prev.filter((_, i) => i !== idx))
  }

  function updatePergunta(idx: number, field: keyof SurveyQuestion, value: string | string[]) {
    setPerguntas(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const fd = new FormData()
    fd.set('titulo', titulo)
    fd.set('descricao', descricao)
    fd.set('status', status)
    fd.set('data_inicio', dataInicio)
    fd.set('data_fim', dataFim)
    fd.set('perguntas', JSON.stringify(perguntas))

    const result = isEdit
      ? await updateSurveyAction(survey!.id, fd)
      : await createSurveyAction(companyId, fd)

    setLoading(false)
    if ('error' in result) { setError(result.error ?? 'Erro ao salvar.'); return }
    router.refresh()
    onClose()
  }

  const labelStyle = { color: 'var(--color-text-secondary)', fontSize: '0.75rem', fontWeight: 500, marginBottom: 4, display: 'block' }
  const tabStyle = (active: boolean) => ({
    padding: '6px 16px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 500,
    backgroundColor: active ? 'var(--color-primary)' : 'transparent',
    color: active ? 'var(--color-primary-darker)' : 'var(--color-text-muted)',
    cursor: 'pointer', border: 'none',
  })

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Editar Pesquisa' : 'Nova Pesquisa'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-1 p-1 rounded-lg" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
          <button type="button" style={tabStyle(tab === 'info')} onClick={() => setTab('info')}>Informações</button>
          <button type="button" style={tabStyle(tab === 'perguntas')} onClick={() => setTab('perguntas')}>
            Perguntas {perguntas.length > 0 && `(${perguntas.length})`}
          </button>
        </div>

        {tab === 'info' && (
          <div className="space-y-3">
            <div>
              <label style={labelStyle}>Título *</label>
              <Input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Pesquisa de clima organizacional" required />
            </div>
            <div>
              <label style={labelStyle}>Descrição</label>
              <textarea
                value={descricao}
                onChange={e => setDescricao(e.target.value)}
                rows={2}
                placeholder="Objetivo da pesquisa..."
                className="w-full px-3 py-2 rounded-lg border text-sm resize-none"
                style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
              />
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
              >
                <option value="rascunho">Rascunho</option>
                <option value="ativo">Ativo</option>
                <option value="encerrado">Encerrado</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={labelStyle}>Data início</label>
                <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Data fim</label>
                <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {tab === 'perguntas' && (
          <div className="space-y-3">
            {perguntas.length === 0 && (
              <p className="text-sm text-center py-4" style={{ color: 'var(--color-text-muted)' }}>
                Nenhuma pergunta adicionada.
              </p>
            )}
            {perguntas.map((p, idx) => (
              <div key={p.id} className="p-3 rounded-lg border space-y-2" style={{ borderColor: 'var(--color-bg-surface)' }}>
                <div className="flex gap-2 items-start">
                  <span className="text-xs font-semibold mt-2" style={{ color: 'var(--color-text-muted)' }}>{idx + 1}.</span>
                  <div className="flex-1 space-y-2">
                    <Input
                      value={p.texto}
                      onChange={e => updatePergunta(idx, 'texto', e.target.value)}
                      placeholder="Texto da pergunta..."
                    />
                    <select
                      value={p.tipo}
                      onChange={e => updatePergunta(idx, 'tipo', e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border text-xs"
                      style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                    >
                      <option value="escala">Escala (1 a 5)</option>
                      <option value="texto">Resposta aberta</option>
                      <option value="multipla">Múltipla escolha</option>
                    </select>
                    {p.tipo === 'multipla' && (
                      <Input
                        value={(p.opcoes ?? []).join(', ')}
                        onChange={e => updatePergunta(idx, 'opcoes', e.target.value.split(',').map(o => o.trim()))}
                        placeholder="Opções separadas por vírgula"
                      />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removePergunta(idx)}
                    className="text-xs mt-2 hover:text-red-500 transition-colors"
                    style={{ color: 'var(--color-text-muted)' }}
                  >✕</button>
                </div>
              </div>
            ))}
            <Button type="button" variant="ghost" onClick={addPergunta} className="w-full">
              + Adicionar pergunta
            </Button>
          </div>
        )}

        {error && (
          <p className="text-sm p-3 rounded-lg bg-red-50" style={{ color: 'var(--color-error)' }}>{error}</p>
        )}
        <div className="flex gap-3 justify-end pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading}>{isEdit ? 'Salvar alterações' : 'Criar pesquisa'}</Button>
        </div>
      </form>
    </Modal>
  )
}
