'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { AddButton } from '@/components/ui/add-button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Icon } from '@/components/ui/icon'
import { TABLE_HEAD_STYLE, TABLE_WRAPPER_CLASS, TH_CLASS, ROW_CLASS, ROW_STYLE } from '@/components/ui/table-styles'
import { redeLabel } from '@/lib/marketing/constantes'
import { toast } from '@/lib/toast'
import { deleteMetricaRedeSocialAction } from '../actions'
import type { MetricaRedeSocial } from '../queries'
import { ModalMetrica } from './modal-metrica'

function fmtMesBr(mes: string) {
  const [ano, m] = mes.slice(0, 7).split('-')
  const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  return `${nomes[parseInt(m, 10) - 1]}/${ano}`
}

interface Props {
  metricas: MetricaRedeSocial[]
  companyId: string
}

// Um registro por rede+mês; evolução mostrada como texto (sem gráfico — vocabulário visual do módulo não usa gráfico em nenhuma tela)
export function MetricasClient({ metricas, companyId }: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [excluir, setExcluir] = useState<MetricaRedeSocial | null>(null)
  const [excluindo, setExcluindo] = useState(false)

  const agrupado: Record<string, MetricaRedeSocial[]> = {}
  for (const m of metricas) {
    (agrupado[m.rede] = agrupado[m.rede] || []).push(m)
  }
  const redes = Object.keys(agrupado).sort()

  async function confirmarExclusao() {
    if (!excluir) return
    setExcluindo(true)
    const r = await toast.promise(deleteMetricaRedeSocialAction(excluir.id), {
      loading: 'Excluindo…',
      success: 'Registro excluído.',
      error: 'Não foi possível excluir.',
    })
    setExcluindo(false)
    setExcluir(null)
    if (!('error' in r)) router.refresh()
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>Métricas de Redes Sociais</h1>
        <Breadcrumb />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Todo mês, anote os seguidores (e alcance/engajamento, se quiser) de cada rede pra acompanhar a evolução ao longo do tempo.
        </p>
        <AddButton onClick={() => setModalOpen(true)} label="Novo registro mensal" />
      </div>

      {redes.length === 0 && (
        <div className="app-card p-8 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Nenhum registro ainda.
        </div>
      )}

      <div className="flex flex-col gap-4">
        {redes.map((rede) => {
          const registros = [...agrupado[rede]].sort((a, b) => b.mes.localeCompare(a.mes))
          return (
            <div key={rede} className="app-card overflow-hidden">
              <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid var(--color-card-border)' }}>
                <Icon name="chart" size={16} />
                <h3 className="font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>{redeLabel(rede)}</h3>
              </div>
              <div className={TABLE_WRAPPER_CLASS}>
                <table className="w-full text-sm">
                  <thead style={TABLE_HEAD_STYLE}>
                    <tr>
                      <th className={TH_CLASS}>Mês</th>
                      <th className={TH_CLASS}>Seguidores</th>
                      <th className={TH_CLASS}>Alcance</th>
                      <th className={TH_CLASS}>Engajamento</th>
                      <th className={TH_CLASS}>Variação</th>
                      <th className={TH_CLASS}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {registros.map((m, i) => {
                      const anterior = registros[i + 1]
                      let deltaTexto: React.ReactNode = null
                      if (anterior && anterior.seguidores) {
                        const dif = m.seguidores - anterior.seguidores
                        const pct = (dif / anterior.seguidores) * 100
                        const cor = dif > 0 ? 'var(--color-success)' : dif < 0 ? 'var(--color-error)' : 'var(--color-text-muted)'
                        deltaTexto = <span style={{ color: cor }}>{dif >= 0 ? '↑ +' : '↓ '}{Math.abs(dif).toLocaleString('pt-BR')} ({dif >= 0 ? '+' : '-'}{Math.abs(pct).toFixed(1)}%)</span>
                      }
                      return (
                        <tr key={m.id} className={ROW_CLASS} style={ROW_STYLE}>
                          <td className="px-4 py-3">{fmtMesBr(m.mes)}</td>
                          <td className="px-4 py-3">{m.seguidores.toLocaleString('pt-BR')}</td>
                          <td className="px-4 py-3">{m.alcance ? m.alcance.toLocaleString('pt-BR') : '—'}</td>
                          <td className="px-4 py-3">{m.engajamento ? `${m.engajamento}%` : '—'}</td>
                          <td className="px-4 py-3">{deltaTexto ?? '—'}</td>
                          <td className="px-4 py-3 text-right">
                            <button type="button" onClick={() => setExcluir(m)} className="p-1.5 rounded-lg hover:bg-gray-100" style={{ color: 'var(--color-text-muted)' }} aria-label={`Excluir registro de ${fmtMesBr(m.mes)}`}>
                              <Icon name="trash" size={14} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}
      </div>

      <ModalMetrica open={modalOpen} onClose={() => setModalOpen(false)} companyId={companyId} />

      <ConfirmDialog
        open={!!excluir}
        onClose={() => { if (!excluindo) setExcluir(null) }}
        onConfirm={confirmarExclusao}
        loading={excluindo}
        title="Excluir registro"
        confirmLabel="Excluir"
        message={<p>Excluir o registro de <strong>{excluir && fmtMesBr(excluir.mes)}</strong>?</p>}
      />
    </>
  )
}
