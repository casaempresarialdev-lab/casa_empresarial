'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { Button } from '@/components/ui/button'
import { Tabs } from '@/components/ui/form-steps'
import { Icon } from '@/components/ui/icon'
import { CamposBatidas } from '@/components/modules/ponto/campos-batidas'
import { Modal } from '@/components/ui/modal'
import { toast } from '@/lib/toast'
import { aguardarLocal, lerLocal, type LocalBatida } from '@/lib/ponto'
import { ajustePontoSchema, faixasDeHorario, horaDe } from '@/lib/validations/ponto'
import { AUSENCIA_VAZIA, CamposAusencia, ausenciaParaFormData, erroAusencia, type ValorAusencia } from '@/components/modules/ponto/campos-ausencia'
import { rotuloAusencia } from '@/lib/validations/ausencias'
import { informarAusenciaAction, solicitarAjusteAction } from '../actions'
import type { AjustePonto, DiaPonto, MinhaAusencia } from '../queries'

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
  const atuais = dia.horarios.map((h) => horaDe(h))
  const [horarios, setHorarios] = useState<string[]>(() => (atuais.length ? atuais : ['']))
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  // Localização lida ao abrir, para já estar pronta no envio
  const localRef = useRef<Promise<LocalBatida> | null>(null)

  useEffect(() => { localRef.current = lerLocal() }, [])

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    const batidas = horarios.filter(Boolean)
    const dados = { data: dia.data, batidas, motivo }
    const v = ajustePontoSchema.safeParse(dados)
    if (!v.success) { setErro(v.error.issues[0].message); return }
    if (batidas.join() === atuais.join()) { setErro('Altere ao menos um horário.'); return }

    setErro('')
    setEnviando(true)
    const r = await toast.promise(aguardarLocal(localRef.current).then((local) => solicitarAjusteAction(dados, local)), {
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
        <CamposBatidas valor={horarios} onChange={setHorarios} />
        <div className="flex flex-col gap-1">
          <label htmlFor="ajuste-motivo" className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Observação *</label>
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

const MARCACAO: Record<string, { fundo: string; cor: string }> = {
  atestado: { fundo: '#DCFCE7', cor: '#15803D' },
  ferias: { fundo: '#DBEAFE', cor: '#1D4ED8' },
  falta: { fundo: '#FEE2E2', cor: '#B91C1C' },
  folga: { fundo: '#F3F4F6', cor: '#6B7280' },
}

const SITUACAO_AUSENCIA: Record<MinhaAusencia['status'], { texto: string; fundo: string; cor: string }> = {
  pendente: { texto: 'Em análise', fundo: '#FEF3C7', cor: '#B45309' },
  abonado: { texto: 'Abonado', fundo: '#DCFCE7', cor: '#15803D' },
  recusado: { texto: 'Recusado', fundo: '#FEE2E2', cor: '#B91C1C' },
}

function ModalAusencia({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [form, setForm] = useState<ValorAusencia>(AUSENCIA_VAZIA)
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    const erro = erroAusencia(form)
    if (erro) { toast.error(erro); return }
    setEnviando(true)
    const r = await toast.promise(informarAusenciaAction(ausenciaParaFormData(form)), { loading: 'Enviando…', success: 'Enviado para análise.', error: 'Não foi possível enviar.' })
    setEnviando(false)
    if ('error' in r) return
    router.refresh()
    onClose()
  }

  return (
    <Modal open onClose={() => { if (!enviando) onClose() }} title="Informar atestado ou ausência" description="A área de Pessoas analisa e abona.">
      <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
        <CamposAusencia valor={form} onChange={setForm} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={enviando}>Cancelar</Button>
          <Button type="submit" loading={enviando}>Enviar</Button>
        </div>
      </form>
    </Modal>
  )
}

export function MeuPontoClient({ dias, ausencias, periodo, mesAtual, bloqueio, abaInicial = 0 }: { dias: DiaPonto[]; ausencias: MinhaAusencia[]; periodo: string; mesAtual: string; bloqueio: string | null; abaInicial?: number }) {
  const [ajustando, setAjustando] = useState<DiaPonto | null>(null)
  const [informando, setInformando] = useState(false)
  const [aba, setAba] = useState(abaInicial)
  const emAnalise = ausencias.filter((a) => a.status === 'pendente').length
  const [ano, mes] = periodo.split('-').map(Number)
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
  const seta = 'w-9 h-9 rounded-lg flex items-center justify-center transition-colors hover:bg-gray-100'

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>Meu ponto</h1>
        <Breadcrumb />
      </div>

      <Tabs labels={['Meus horários', emAnalise ? `Atestados e ausências (${emAnalise})` : 'Atestados e ausências']} step={aba} onSelect={setAba} />

      <div className={aba === 0 ? 'app-card p-5 flex flex-col gap-4' : 'hidden'}>
        {bloqueio ? (
          <p className="text-sm text-center py-8" style={{ color: 'var(--color-text-muted)' }}>{bloqueio}</p>
        ) : (
          <>
            <div className="flex items-center justify-center gap-2" style={{ color: 'var(--color-sidebar-text)' }}>
              <Link href={`/meu-ponto?mes=${deslocarMes(periodo, -1)}`} aria-label="Mês anterior" className={seta}><Icon name="chevron-left" size={18} /></Link>
              <span className="w-40 text-center text-sm font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>{MESES[mes - 1]} {ano}</span>
              <Link href={`/meu-ponto?mes=${deslocarMes(periodo, 1)}`} aria-label="Próximo mês" className={seta}><Icon name="chevron-right" size={18} /></Link>
              {periodo !== mesAtual && (
                <Link href="/meu-ponto" className="ml-1 text-sm font-semibold hover:underline" style={{ color: 'var(--color-brand)' }}>Mês atual</Link>
              )}
            </div>

            <ul className="flex flex-col gap-2">
              {dias.map((d) => {
                const { dia, semana } = rotuloDia(d.data)
                const s = d.ajuste ? SITUACAO[d.ajuste.status] : null
                const m = d.marcacao ? MARCACAO[d.marcacao.tipo] : null
                const ehHoje = d.data === hoje
                const futuro = d.data > hoje
                return (
                  <li
                    key={d.data}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border px-4 py-3"
                    style={{ borderColor: ehHoje ? 'var(--color-brand)' : 'var(--color-card-border)', backgroundColor: futuro ? 'var(--color-bg-surface)' : '#fff' }}
                  >
                    <div className="w-11 text-center shrink-0">
                      <p className="text-lg font-extrabold leading-none" style={{ fontFamily: 'Manrope', color: ehHoje ? 'var(--color-brand)' : futuro ? 'var(--color-text-muted)' : 'var(--color-text-primary)' }}>{dia}</p>
                      <p className="text-[11px]" style={{ color: ehHoje ? 'var(--color-brand)' : 'var(--color-text-muted)' }}>{ehHoje ? 'Hoje' : semana}</p>
                    </div>
                    <div className="flex-1 min-w-[180px] flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold tabular-nums" style={{ color: d.horarios.length ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>
                      {d.horarios.length
                        ? faixasDeHorario(d.horarios).map((f, i) => <span key={i}>{f}</span>)
                        : <span className="font-normal">{d.escala.folga || d.marcacao ? '—' : futuro ? (d.escala.previsto ? `Previsto ${d.escala.previsto}` : '—') : 'Sem registros'}</span>}
                    </div>
                    {d.escala.feriado && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 max-w-[200px] truncate" title={d.escala.feriado} style={{ backgroundColor: '#EBF5FB', color: '#2471A3' }}>
                        Feriado: {d.escala.feriado}
                      </span>
                    )}
                    {d.escala.folga && d.marcacao?.tipo !== 'folga' && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}>Folga da escala</span>
                    )}
                    {m && d.marcacao && (
                      <span title={d.marcacao.detalhe ?? undefined} className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 max-w-[240px] truncate" style={{ backgroundColor: m.fundo, color: m.cor }}>
                        {d.marcacao.texto}{d.marcacao.tipo === 'atestado' && d.marcacao.detalhe ? `: ${d.marcacao.detalhe}` : ''}
                      </span>
                    )}
                    {s && (
                      <span title={d.ajuste?.resposta ?? d.ajuste?.motivo} className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: s.fundo, color: s.cor }}>{s.texto}</span>
                    )}
                    {!futuro && d.ajuste?.status !== 'pendente' && (
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

      <div className={aba === 1 ? 'app-card p-5 flex flex-col gap-4' : 'hidden'}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>A área de Pessoas analisa e abona o que você informar.</p>
          <Button type="button" variant="secondary" size="sm" onClick={() => setInformando(true)}>Informar atestado ou ausência</Button>
        </div>
        {ausencias.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Nada informado até agora.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {ausencias.map((a) => {
              const s = SITUACAO_AUSENCIA[a.status]
              const fmt = (d: string) => d.split('-').reverse().join('/')
              return (
                <li key={a.id} className="rounded-xl border bg-white px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-1" style={{ borderColor: 'var(--color-card-border)' }}>
                  <span className="flex-1 min-w-[200px] text-sm" style={{ color: 'var(--color-text-primary)' }}>
                    <strong>{rotuloAusencia(a.tipo)}</strong>
                    <span style={{ color: 'var(--color-text-muted)' }}> · {a.data_inicio === a.data_fim ? fmt(a.data_inicio) : `${fmt(a.data_inicio)} a ${fmt(a.data_fim)}`}</span>
                  </span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: s.fundo, color: s.cor }}>{s.texto}</span>
                  {a.status === 'recusado' && a.resposta && <p className="basis-full text-xs" style={{ color: '#B91C1C' }}>Resposta: {a.resposta}</p>}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {informando && <ModalAusencia onClose={() => setInformando(false)} />}
      {ajustando && <ModalAjuste key={ajustando.data} dia={ajustando} onClose={() => setAjustando(null)} />}
    </>
  )
}
