'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AUSENCIA_VAZIA, CamposAusencia, ausenciaParaFormData, erroAusencia, type ValorAusencia } from '@/components/modules/ponto/campos-ausencia'
import { AddButton } from '@/components/ui/add-button'
import { Button } from '@/components/ui/button'
import { FilterSelect } from '@/components/ui/filter-select'
import { Icon } from '@/components/ui/icon'
import { ListEmpty } from '@/components/ui/list-item'
import { Modal } from '@/components/ui/modal'
import { Select } from '@/components/ui/select'
import { toast } from '@/lib/toast'
import { rotuloAusencia } from '@/lib/validations/ausencias'
import { decidirAusenciaAction, lancarAusenciaAction, reverterAusenciaAction, urlAnexoAusenciaAction } from '../actions-afastamentos'
import type { AusenciaEquipe } from '../queries'

const fmt = (d: string) => d.split('-').reverse().join('/')
const FMT_DATA_HORA = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
const quantidadeDias = (a: Pick<AusenciaEquipe, 'data_inicio' | 'data_fim'>) => Math.round((Date.parse(a.data_fim) - Date.parse(a.data_inicio)) / 86400000) + 1

const FILTROS = [
  { value: 'pendente', label: 'Em análise' },
  { value: 'abonado', label: 'Abonados' },
  { value: 'recusado', label: 'Recusados' },
]
const VAZIO: Record<string, string> = { pendente: 'Nenhum atestado ou ausência para analisar.', abonado: 'Nenhum abono ainda.', recusado: 'Nenhuma recusa.' }

// Atestados e ausências: o colaborador informa, e quem tem acesso à área de Pessoas abona ou recusa
export function AbaAusencias({ ausencias, employees, companyId }: { ausencias: AusenciaEquipe[]; employees: { id: string; nome: string }[]; companyId: string }) {
  const router = useRouter()
  const [filtro, setFiltro] = useState('pendente')
  const [processando, setProcessando] = useState<string | null>(null)
  const [recusar, setRecusar] = useState<AusenciaEquipe | null>(null)
  const [resposta, setResposta] = useState('')
  const [lancando, setLancando] = useState(false)
  const [empId, setEmpId] = useState('')
  const [form, setForm] = useState<ValorAusencia>(AUSENCIA_VAZIA)
  const [salvando, setSalvando] = useState(false)

  const pendentes = ausencias.filter((a) => a.status === 'pendente').length
  const visiveis = ausencias.filter((a) => a.status === filtro)

  async function decidir(a: AusenciaEquipe, decisao: 'abonado' | 'recusado', texto?: string) {
    setProcessando(a.id)
    const r = await toast.promise(decidirAusenciaAction(companyId, a.id, decisao, texto), {
      loading: decisao === 'abonado' ? 'Abonando…' : 'Recusando…',
      success: decisao === 'abonado' ? `Ausência de ${a.nome} abonada.` : `Ausência de ${a.nome} recusada.`,
      error: 'Não foi possível concluir.',
    })
    setProcessando(null)
    if ('error' in r) return
    setRecusar(null)
    setResposta('')
    router.refresh()
  }

  async function reverter(a: AusenciaEquipe) {
    setProcessando(a.id)
    const r = await toast.promise(reverterAusenciaAction(companyId, a.id), { loading: 'Voltando para análise…', success: 'A ausência voltou para análise.', error: 'Não foi possível concluir.' })
    setProcessando(null)
    if (!('error' in r)) router.refresh()
  }

  async function verAnexo(a: AusenciaEquipe) {
    const r = await urlAnexoAusenciaAction(companyId, a.id)
    if ('error' in r) toast.error(r.error ?? 'Não foi possível abrir o arquivo.')
    else window.open(r.url, '_blank', 'noopener')
  }

  async function lancar(e: React.FormEvent) {
    e.preventDefault()
    if (!empId) { toast.error('Selecione o funcionário.'); return }
    const erro = erroAusencia(form)
    if (erro) { toast.error(erro); return }
    setSalvando(true)
    const r = await toast.promise(lancarAusenciaAction(companyId, empId, ausenciaParaFormData(form)), { loading: 'Lançando…', success: 'Ausência lançada e abonada.', error: 'Não foi possível lançar.' })
    setSalvando(false)
    if ('error' in r) return
    setLancando(false)
    setEmpId('')
    setForm(AUSENCIA_VAZIA)
    setFiltro('abonado')
    router.refresh()
  }

  return (
    <div className="app-card p-5 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold" style={{ color: 'var(--color-sidebar-text)' }}>{pendentes} {pendentes === 1 ? 'item para analisar' : 'itens para analisar'}</p>
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect value={filtro} onChange={setFiltro} label="Filtrar por situação" options={FILTROS} />
          <AddButton onClick={() => setLancando(true)} label="Lançar ausência" />
        </div>
      </div>

      <ul className="flex flex-col gap-3">
        {visiveis.length === 0 && <ListEmpty>{VAZIO[filtro]}</ListEmpty>}
        {visiveis.map((a) => {
          const dias = quantidadeDias(a)
          return (
            <li key={a.id} className="rounded-xl border bg-white px-4 py-3.5 flex flex-col gap-3" style={{ borderColor: 'var(--color-card-border)' }}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>{a.nome} <span className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>· {rotuloAusencia(a.tipo)}</span></p>
                  <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                    {a.data_inicio === a.data_fim ? fmt(a.data_inicio) : `${fmt(a.data_inicio)} a ${fmt(a.data_fim)}`} · {dias} {dias === 1 ? 'dia' : 'dias'}
                  </p>
                  {a.motivo && <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>Observação: {a.motivo}</p>}
                  <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{a.origem === 'gestor' ? 'Lançado pela área de Pessoas' : 'Informado pelo colaborador'} em {FMT_DATA_HORA.format(new Date(a.created_at))}</p>
                </div>
                {a.anexo_path && (
                  <button type="button" onClick={() => verAnexo(a)} className="inline-flex items-center gap-1.5 text-sm font-semibold cursor-pointer hover:underline shrink-0" style={{ color: 'var(--color-brand)' }}>
                    <Icon name="eye" size={16} /> Ver anexo
                  </button>
                )}
              </div>

              {a.status === 'pendente' ? (
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" size="sm" style={{ color: '#B91C1C' }} disabled={!!processando} onClick={() => setRecusar(a)}>Recusar</Button>
                  <Button type="button" size="sm" loading={processando === a.id} disabled={!!processando} onClick={() => decidir(a, 'abonado')}>Abonar</Button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {a.status === 'abonado' ? 'Abonado' : 'Recusado'} por {a.decidido_por_nome ?? 'Usuário'}{a.decidido_em ? ` em ${FMT_DATA_HORA.format(new Date(a.decidido_em))}` : ''}{a.resposta ? ` · ${a.resposta}` : ''}
                  </p>
                  <button type="button" disabled={!!processando} onClick={() => reverter(a)} className="text-xs font-semibold cursor-pointer hover:underline disabled:opacity-50" style={{ color: 'var(--color-brand)' }}>Voltar para análise</button>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      <Modal open={!!recusar} onClose={() => { if (!processando) setRecusar(null) }} title="Recusar ausência" description={recusar ? `${recusar.nome} · ${rotuloAusencia(recusar.tipo)}` : undefined}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="ausencia-resposta" className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Motivo da recusa (opcional)</label>
            <textarea id="ausencia-resposta" rows={3} maxLength={500} value={resposta} onChange={(e) => setResposta(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]" style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', backgroundColor: '#fff' }} />
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>A pessoa vê esta resposta em Meu ponto.</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setRecusar(null)} disabled={!!processando}>Cancelar</Button>
            <Button type="button" variant="danger" loading={!!processando} onClick={() => recusar && decidir(recusar, 'recusado', resposta)}>Recusar</Button>
          </div>
        </div>
      </Modal>

      {lancando && (
        <Modal open onClose={() => { if (!salvando) setLancando(false) }} title="Lançar ausência" description="Já entra abonada e o dia deixa de contar como falta.">
          <form onSubmit={lancar} noValidate className="flex flex-col gap-4">
            <Select label="Funcionário *" placeholder="Selecionar..." options={employees.map((e) => ({ value: e.id, label: e.nome }))} value={empId} onChange={(e) => setEmpId(e.target.value)} />
            <CamposAusencia valor={form} onChange={setForm} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setLancando(false)} disabled={salvando}>Cancelar</Button>
              <Button type="submit" loading={salvando}>Lançar</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
