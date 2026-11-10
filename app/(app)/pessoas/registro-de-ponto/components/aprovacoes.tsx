'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { FilterSelect } from '@/components/ui/filter-select'
import { ListEmpty } from '@/components/ui/list-item'
import { Modal } from '@/components/ui/modal'
import { toast } from '@/lib/toast'
import { faixasDeHorario } from '@/lib/validations/ponto'
import { decidirAjusteAction } from '../actions'
import type { AjusteEquipe } from '../queries'
import { TextoLocal } from './texto-local'

const fmtData = (d: string) => d.split('-').reverse().join('/')
const FMT_DECISAO = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })

const FILTROS = [
  { value: 'pendente', label: 'Em aprovação' },
  { value: 'aprovado', label: 'Aprovados' },
  { value: 'recusado', label: 'Recusados' },
]

const VAZIO: Record<string, string> = {
  pendente: 'Nenhum ajuste para aprovar.',
  aprovado: 'Nenhum ajuste aprovado ainda.',
  recusado: 'Nenhum ajuste recusado.',
}

// Aprovação dos ajustes de ponto pedidos pelos colaboradores: horário atual ao lado do proposto, e o histórico das decisões
export function Aprovacoes({ ajustes, companyId }: { ajustes: AjusteEquipe[]; companyId: string }) {
  const router = useRouter()
  const [filtro, setFiltro] = useState('pendente')
  const [processando, setProcessando] = useState<string | null>(null)
  const [recusar, setRecusar] = useState<AjusteEquipe | null>(null)
  const [resposta, setResposta] = useState('')

  const pendentes = ajustes.filter((a) => a.status === 'pendente').length
  const visiveis = ajustes.filter((a) => a.status === filtro)

  async function decidir(a: AjusteEquipe, decisao: 'aprovado' | 'recusado', texto?: string) {
    setProcessando(a.id)
    const r = await toast.promise(decidirAjusteAction(companyId, a.id, decisao, texto), {
      loading: decisao === 'aprovado' ? 'Aprovando o ajuste…' : 'Recusando o ajuste…',
      success: decisao === 'aprovado' ? `Ajuste de ${a.nome} aprovado.` : `Ajuste de ${a.nome} recusado.`,
      error: 'Não foi possível concluir.',
    })
    setProcessando(null)
    if ('error' in r) return
    setRecusar(null)
    setResposta('')
    router.refresh()
  }

  return (
    <div className="app-card p-5 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold" style={{ color: 'var(--color-sidebar-text)' }}>
          {pendentes} {pendentes === 1 ? 'ajuste para aprovar' : 'ajustes para aprovar'}
        </p>
        <FilterSelect value={filtro} onChange={setFiltro} label="Filtrar por situação" options={FILTROS} />
      </div>

      <ul className="flex flex-col gap-3">
        {visiveis.length === 0 && <ListEmpty>{VAZIO[filtro]}</ListEmpty>}
        {visiveis.map((a) => {
          const emAnalise = a.status === 'pendente'
          return (
            <li key={a.id} className="rounded-xl border bg-white px-4 py-3.5 flex flex-col gap-3" style={{ borderColor: 'var(--color-card-border)' }}>
              <div>
                <p className="font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>{a.nome} <span className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>· {fmtData(a.data)}</span></p>
                <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>Observação: {a.motivo}</p>
              </div>

              {/* De onde e quando o pedido foi feito */}
              <dl className="grid grid-cols-1 sm:grid-cols-[auto_minmax(0,1fr)_auto] gap-x-6 gap-y-2 rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}>
                <div>
                  <dt className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Registrado em</dt>
                  <dd className="tabular-nums">{FMT_DECISAO.format(new Date(a.created_at))}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Localização</dt>
                  <dd className="break-words">{a.origem ? <TextoLocal local={a.origem} /> : 'Não registrada'}</dd>
                </div>
                <div>
                  <dt className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>IP</dt>
                  <dd className="tabular-nums break-all">{a.origem?.ip ?? 'Não registrado'}</dd>
                </div>
              </dl>

              <div className={emAnalise ? 'grid grid-cols-1 sm:grid-cols-2 gap-2' : ''}>
                {emAnalise && (
                  <div>
                    <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Registros atuais</p>
                    <p className="text-sm tabular-nums" style={{ color: 'var(--color-text-muted)' }}>{faixasDeHorario(a.atual ?? []).join('  ·  ') || 'Sem registros'}</p>
                  </div>
                )}
                <div>
                  <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{emAnalise ? 'Registros propostos' : 'Registros pedidos'}</p>
                  <p className="text-sm font-semibold tabular-nums" style={{ color: emAnalise ? 'var(--color-brand)' : 'var(--color-text-primary)' }}>{faixasDeHorario(a.batidas).join('  ·  ') || 'Sem registros'}</p>
                </div>
              </div>

              {emAnalise ? (
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" size="sm" style={{ color: '#B91C1C' }} disabled={!!processando} onClick={() => setRecusar(a)}>Recusar</Button>
                  <Button type="button" size="sm" loading={processando === a.id} disabled={!!processando} onClick={() => decidir(a, 'aprovado')}>Aprovar</Button>
                </div>
              ) : (
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {a.status === 'aprovado' ? 'Aprovado' : 'Recusado'} por {a.decidido_por_nome ?? 'Usuário'}{a.decidido_em ? ` em ${FMT_DECISAO.format(new Date(a.decidido_em))}` : ''}
                  {a.resposta ? ` · ${a.resposta}` : ''}
                </p>
              )}
            </li>
          )
        })}
      </ul>

      <Modal open={!!recusar} onClose={() => { if (!processando) setRecusar(null) }} title="Recusar ajuste" description={recusar ? `${recusar.nome} · ${fmtData(recusar.data)}` : undefined}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="ajuste-resposta" className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Motivo da recusa (opcional)</label>
            <textarea
              id="ajuste-resposta"
              rows={3}
              maxLength={500}
              value={resposta}
              onChange={(e) => setResposta(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
              style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', backgroundColor: '#fff' }}
            />
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>A pessoa vê esta resposta em Meu ponto.</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setRecusar(null)} disabled={!!processando}>Cancelar</Button>
            <Button type="button" variant="danger" loading={!!processando} onClick={() => recusar && decidir(recusar, 'recusado', resposta)}>Recusar ajuste</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
