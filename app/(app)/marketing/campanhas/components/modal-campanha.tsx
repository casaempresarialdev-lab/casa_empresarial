'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { CAMPANHA_OBJETIVOS, CONTEUDO_CANAIS } from '@/lib/marketing/constantes'
import { createCampanhaMarketingAction, updateCampanhaMarketingAction } from '../actions'
import type { CampanhaMarketing } from '../queries'

interface Props {
  open: boolean
  onClose: () => void
  companyId: string
  campanha: CampanhaMarketing | null
}

const labelStyle = { color: 'var(--color-text-secondary)', fontSize: '0.75rem', fontWeight: 500, marginBottom: 4, display: 'block' }
const sectionTitle = { color: 'var(--color-primary-darker)', fontSize: '0.8rem', fontWeight: 600, marginBottom: 12, paddingBottom: 6, borderBottom: '1px solid var(--color-bg-surface)' }

export function ModalCampanha({ open, onClose, companyId, campanha }: Props) {
  const router = useRouter()
  const isEdit = !!campanha

  const [nome, setNome] = useState('')
  const [objetivo, setObjetivo] = useState('captar')
  const [canal, setCanal] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [orcamento, setOrcamento] = useState('')
  const [leadsGerados, setLeadsGerados] = useState('')
  const [vendasGeradas, setVendasGeradas] = useState('')
  const [notas, setNotas] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    if (campanha) {
      setNome(campanha.nome)
      setObjetivo(campanha.objetivo)
      setCanal(campanha.canal ?? '')
      setDataInicio(campanha.data_inicio)
      setDataFim(campanha.data_fim ?? '')
      setOrcamento(campanha.orcamento !== null ? String(campanha.orcamento) : '')
      setLeadsGerados(campanha.leads_gerados !== null ? String(campanha.leads_gerados) : '')
      setVendasGeradas(campanha.vendas_geradas !== null ? String(campanha.vendas_geradas) : '')
      setNotas(campanha.notas ?? '')
    } else {
      setNome(''); setObjetivo('captar'); setCanal(''); setDataInicio(''); setDataFim('')
      setOrcamento(''); setLeadsGerados(''); setVendasGeradas(''); setNotas('')
    }
  }, [open, campanha])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const fd = new FormData()
    fd.set('nome', nome)
    fd.set('objetivo', objetivo)
    fd.set('canal', canal)
    fd.set('data_inicio', dataInicio)
    fd.set('data_fim', dataFim)
    fd.set('orcamento', orcamento)
    fd.set('leads_gerados', leadsGerados)
    fd.set('vendas_geradas', vendasGeradas)
    fd.set('notas', notas)

    const result = isEdit
      ? await updateCampanhaMarketingAction(campanha!.id, fd)
      : await createCampanhaMarketingAction(companyId, fd)

    setLoading(false)
    if ('error' in result) { setError(result.error ?? 'Erro ao salvar.'); return }
    router.refresh()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Editar campanha' : 'Nova campanha'} className="sm:max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label style={labelStyle}>Nome da campanha *</label>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Promoção de aniversário da empresa" required />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label style={labelStyle}>Objetivo</label>
            <select value={objetivo} onChange={(e) => setObjetivo(e.target.value)} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}>
              {CAMPANHA_OBJETIVOS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Canal principal (opcional)</label>
            <select value={canal} onChange={(e) => setCanal(e.target.value)} className="w-full px-3 py-2 rounded-lg border text-sm" style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}>
              <option value="">—</option>
              {CONTEUDO_CANAIS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label style={labelStyle}>Início *</label>
            <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} required />
          </div>
          <div>
            <label style={labelStyle}>Fim (opcional)</label>
            <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Orçamento (opcional)</label>
            <Input value={orcamento} onChange={(e) => setOrcamento(e.target.value)} placeholder="0,00" inputMode="decimal" />
          </div>
        </div>

        <div>
          <p style={sectionTitle}>Resultado (opcional — atualize quando quiser)</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>Leads/contatos gerados</label>
              <Input value={leadsGerados} onChange={(e) => setLeadsGerados(e.target.value)} placeholder="Ex.: 12" inputMode="numeric" />
            </div>
            <div>
              <label style={labelStyle}>Vendas geradas (R$)</label>
              <Input value={vendasGeradas} onChange={(e) => setVendasGeradas(e.target.value)} placeholder="0,00" inputMode="decimal" />
            </div>
          </div>
        </div>

        <div>
          <label style={labelStyle}>Notas (opcional)</label>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={2}
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
