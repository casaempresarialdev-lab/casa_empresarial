'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { toast } from '@/lib/toast'
import { CAMPOS_PONTO, ROTULOS_PONTO, ajustePontoSchema, horaDe, type CampoPonto } from '@/lib/validations/ponto'
import { solicitarAjusteAction } from '../actions'
import type { AjustePonto, DiaPonto } from '../queries'

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const SITUACAO: Record<AjustePonto['status'], { texto: string; fundo: string; cor: string }> = {
  pendente: { texto: 'Em aprovação', fundo: '#FEF3C7', cor: '#B45309' },
  aprovado: { texto: 'Ajuste aprovado', fundo: '#DCFCE7', cor: '#15803D' },
  recusado: { texto: 'Ajuste recusado', fundo: '#FEE2E2', cor: '#B91C1C' },
}

function deslocarMes(periodo: string, delta: number) {
  const [a, m] = periodo.split('-').map(Number)
  const d = new Date(Date.UTC(a, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function rotuloDia(data: string) {
  const [a, m, d] = data.split('-').map(Number)
  return { dia: String(d).padStart(2, '0'), semana: SEMANA[new Date(Date.UTC(a, m - 1, d)).getUTCDay()], completo: `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${a}` }
}

function ModalAjuste({ dia, onClose }: { dia: DiaPonto; onClose: () => void }) {
  const router = useRouter()
  const [horarios, setHorarios] = useState<Record<CampoPonto, string>>(() => ({
    entrada: horaDe(dia.registro?.entrada),
    saida_almoco: horaDe(dia.registro?.saida_almoco),
    retorno_almoco: horaDe(dia.registro?.retorno_almoco),
    saida: horaDe(dia.registro?.saida),
  }))
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    const dados = { data: dia.data, ...horarios, motivo }
    const v = ajustePontoSchema.safeParse(dados)
    if (!v.success) { setErro(v.error.issues[0].message); return }
    const semMudanca = CAMPOS_PONTO.every((c) => horarios[c] === horaDe(dia.registro?.[c]))
    if (semMudanca) { setErro('Altere ao menos um horário.'); return }

    setErro('')
    setEnviando(true)
    const r = await toast.promise(solicitarAjusteAction(dados), {
      loading: 'Enviando o ajuste…',
      success: 'Ajuste enviado para aprovação.',
      error: 'Não foi possível enviar o ajuste.',
    })
    setEnviando(false)
    if ('error' in r) return
    router.refresh()
    onClose()
  }

  return (
    <Modal open onClose={() => { if (!enviando) onClose() }} title="Ajustar ponto" description={rotuloDia(dia.data).completo}>
      <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          {CAMPOS_PONTO.map((c) => (
            <Input key={c} label={ROTULOS_PONTO[c]} type="time" value={horarios[c]} onChange={(e) => setHorarios((h) => ({ ...h, [c]: e.target.value }))} />
          ))}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="ajuste-motivo" className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Motivo *</label>
          <textarea
            id="ajuste-motivo"
            rows={3}
            maxLength={500}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex.: esqueci de registrar a saída"
            className="w-full rounded-lg border px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
            style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', backgroundColor: '#fff' }}
          />
        </div>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>O ponto só muda depois que o ajuste for aprovado.</p>
        {erro && <p className="text-sm" style={{ color: 'var(--color-error)' }}>{erro}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={enviando}>Cancelar</Button>
          <Button type="submit" loading={enviando}>Enviar para aprovação</Button>
        </div>
      </form>
    </Modal>
  )
}

export function MeuPontoClient({ dias, periodo, mesAtual, bloqueio }: { dias: DiaPonto[]; periodo: string; mesAtual: string; bloqueio: string | null }) {
  const [ajustando, setAjustando] = useState<DiaPonto | null>(null)
  const [ano, mes] = periodo.split('-').map(Number)
  const seta = 'w-9 h-9 rounded-lg flex items-center justify-center transition-colors hover:bg-gray-100'

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>Meu ponto</h1>
        <Breadcrumb />
      </div>

      <div className="app-card p-5 flex flex-col gap-4">
        {bloqueio ? (
          <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-muted)' }}>{bloqueio}</p>
        ) : (
          <>
            <div className="flex items-center justify-center gap-2" style={{ color: 'var(--color-sidebar-text)' }}>
              <Link href={`/meu-ponto?mes=${deslocarMes(periodo, -1)}`} aria-label="Mês anterior" className={seta}><Icon name="chevron-left" size={18} /></Link>
              <span className="w-40 text-center text-sm font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>{MESES[mes - 1]} {ano}</span>
              {periodo < mesAtual
                ? <Link href={`/meu-ponto?mes=${deslocarMes(periodo, 1)}`} aria-label="Próximo mês" className={seta}><Icon name="chevron-right" size={18} /></Link>
                : <span aria-hidden className={`${seta} opacity-30 pointer-events-none`}><Icon name="chevron-right" size={18} /></span>}
            </div>

            <ul className="flex flex-col gap-2">
              {dias.map((d) => {
                const { dia, semana } = rotuloDia(d.data)
                const s = d.ajuste ? SITUACAO[d.ajuste.status] : null
                return (
                  <li key={d.data} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border bg-white px-4 py-3" style={{ borderColor: 'var(--color-card-border)' }}>
                    <div className="w-11 text-center shrink-0">
                      <p className="text-lg font-extrabold leading-none" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>{dia}</p>
                      <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{semana}</p>
                    </div>
                    <div className="flex-1 min-w-[260px] grid grid-cols-4 gap-2">
                      {CAMPOS_PONTO.map((c) => (
                        <div key={c}>
                          <p className="text-[11px] truncate" style={{ color: 'var(--color-text-muted)' }}>{ROTULOS_PONTO[c]}</p>
                          <p className="text-sm font-semibold tabular-nums" style={{ color: d.registro?.[c] ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>{horaDe(d.registro?.[c]) || '--:--'}</p>
                        </div>
                      ))}
                    </div>
                    {s && (
                      <span title={d.ajuste?.resposta ?? d.ajuste?.motivo} className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: s.fundo, color: s.cor }}>{s.texto}</span>
                    )}
                    {d.ajuste?.status !== 'pendente' && (
                      <Button type="button" variant="secondary" size="sm" onClick={() => setAjustando(d)}>Ajustar</Button>
                    )}
                    {d.ajuste?.status === 'recusado' && d.ajuste.resposta && (
                      <p className="basis-full text-xs" style={{ color: '#B91C1C' }}>Resposta: {d.ajuste.resposta}</p>
                    )}
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>

      {ajustando && <ModalAjuste key={ajustando.data} dia={ajustando} onClose={() => setAjustando(null)} />}
    </>
  )
}
