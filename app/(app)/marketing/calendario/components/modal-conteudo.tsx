'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { CONTEUDO_CANAIS, CONTEUDO_FASES, CONTEUDO_FORMATOS, CONTEUDO_STATUS } from '@/lib/marketing/constantes'
import { createConteudoMarketingAction, updateConteudoMarketingAction } from '../actions'
import type { ConteudoMarketing } from '../queries'

interface Props {
  open: boolean
  onClose: () => void
  companyId: string
  conteudo: ConteudoMarketing | null
  prefill: { titulo: string; formato: string } | null
}

const labelStyle = { color: 'var(--color-text-secondary)', fontSize: '0.75rem', fontWeight: 500, marginBottom: 4, display: 'block' }

export function ModalConteudo({ open, onClose, companyId, conteudo, prefill }: Props) {
  const router = useRouter()
  const isEdit = !!conteudo

  const [titulo, setTitulo] = useState('')
  const [status, setStatus] = useState('ideia')
  const [formato, setFormato] = useState('post')
  const [formatoOutro, setFormatoOutro] = useState('')
  const [fase, setFase] = useState('topo')
  const [canal, setCanal] = useState('instagram')
  const [canalOutro, setCanalOutro] = useState('')
  const [dataPublicacao, setDataPublicacao] = useState('')
  const [objetivo, setObjetivo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    if (conteudo) {
      setTitulo(conteudo.titulo)
      setStatus(conteudo.status)
      setFormato(conteudo.formato ?? 'post')
      setFormatoOutro(conteudo.formato_outro ?? '')
      setFase(conteudo.fase ?? 'topo')
      setCanal(conteudo.canal ?? 'instagram')
      setCanalOutro(conteudo.canal_outro ?? '')
      setDataPublicacao(conteudo.data_publicacao ?? '')
      setObjetivo(conteudo.objetivo ?? '')
    } else {
      setTitulo(prefill?.titulo ?? ''); setStatus('ideia'); setFormato(prefill?.formato || 'post'); setFormatoOutro('')
      setFase('topo'); setCanal('instagram'); setCanalOutro(''); setDataPublicacao(''); setObjetivo('')
    }
  }, [open, conteudo, prefill])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const fd = new FormData()
    fd.set('titulo', titulo)
    fd.set('status', status)
    fd.set('formato', formato)
    fd.set('formato_outro', formatoOutro)
    fd.set('fase', fase)
    fd.set('canal', canal)
    fd.set('canal_outro', canalOutro)
    fd.set('data_publicacao', dataPublicacao)
    fd.set('objetivo', objetivo)

    const result = isEdit
      ? await updateConteudoMarketingAction(conteudo!.id, fd)
      : await createConteudoMarketingAction(companyId, fd)

    setLoading(false)
    if ('error' in result) { setError(result.error ?? 'Erro ao salvar.'); return }
    router.refresh()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Editar publicação' : 'Nova publicação'} className="sm:max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label style={labelStyle}>Tema / título *</label>
          <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: 5 dicas para organizar o financeiro" required />
        </div>

        <div>
          <label style={labelStyle}>Status</label>
          <div className="flex flex-wrap gap-2">
            {CONTEUDO_STATUS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStatus(s.id)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors"
                style={{
                  backgroundColor: status === s.id ? 'var(--color-primary)' : 'white',
                  borderColor: status === s.id ? 'var(--color-primary-dark)' : 'var(--color-bg-surface)',
                  color: status === s.id ? 'var(--color-primary-darker)' : 'var(--color-text-secondary)',
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label style={labelStyle}>Formato</label>
            <select value={formato} onChange={(e) => setFormato(e.target.value)} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}>
              {CONTEUDO_FORMATOS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Data *</label>
            <Input type="date" value={dataPublicacao} onChange={(e) => setDataPublicacao(e.target.value)} required />
          </div>
        </div>
        {formato === 'outro' && (
          <div>
            <label style={labelStyle}>Qual formato?</label>
            <Input value={formatoOutro} onChange={(e) => setFormatoOutro(e.target.value)} />
          </div>
        )}

        <div>
          <label style={labelStyle}>Fase do funil</label>
          <div className="flex flex-wrap gap-2">
            {CONTEUDO_FASES.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFase(f.id)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors"
                style={{
                  backgroundColor: fase === f.id ? 'var(--color-primary)' : 'white',
                  borderColor: fase === f.id ? 'var(--color-primary-dark)' : 'var(--color-bg-surface)',
                  color: fase === f.id ? 'var(--color-primary-darker)' : 'var(--color-text-secondary)',
                }}
              >
                {f.labelLong}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label style={labelStyle}>Canal</label>
            <select value={canal} onChange={(e) => setCanal(e.target.value)} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}>
              {CONTEUDO_CANAIS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          {canal === 'outro' && (
            <div>
              <label style={labelStyle}>Qual canal?</label>
              <Input value={canalOutro} onChange={(e) => setCanalOutro(e.target.value)} placeholder="Ex.: TikTok, Pinterest..." />
            </div>
          )}
        </div>

        <div>
          <label style={labelStyle}>Objetivo (opcional)</label>
          <textarea
            value={objetivo}
            onChange={(e) => setObjetivo(e.target.value)}
            rows={2}
            placeholder="O que essa publicação deve gerar — engajamento, lead, venda..."
            className="w-full px-3 py-2 rounded-lg border text-sm resize-none"
            style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
          />
        </div>

        {error && <p className="text-sm p-3 rounded-lg bg-red-50" style={{ color: 'var(--color-error)' }}>{error}</p>}

        <div className="flex gap-3 justify-end pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading}>{isEdit ? 'Salvar alterações' : 'Salvar'}</Button>
        </div>
      </form>
    </Modal>
  )
}
