'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { toast } from '@/lib/toast'
import { CAMPOS_FOLHA, calcularFolha, horas, horasNoturnasPagas, type AjustesFolha, type CampoFolha } from '@/lib/folha/calculo'
import { maskMoeda, normalizarValor } from '../../funcionarios/components/ficha/ficha-config'
import { salvarConferenciaAction } from '../actions'
import type { LinhaFolha } from '../queries'

const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const CAMPOS_DIAS: CampoFolha[] = ['desconto_faltas', 'atestados', 'dsr_perdido']
const ehDias = (c: CampoFolha) => CAMPOS_DIAS.includes(c)

const paraTexto = (campo: CampoFolha, v: number) =>
  ehDias(campo) ? String(v) : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const paraNumero = (campo: CampoFolha, t: string) =>
  ehDias(campo) ? (Number(t.replace(',', '.')) || 0) : (Number(normalizarValor(t)) || 0)
const fmtData = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}`

const AVISO: Record<string, string> = {
  sem_controle: 'Esta pessoa não registra ponto: faltas, atrasos e horas extras devem ser informados aqui.',
  sem_escala: 'Sem escala de trabalho neste mês: não foi possível apurar faltas, atrasos e horas extras.',
  sem_registros: 'Nenhum registro de ponto neste mês: nada foi apurado automaticamente.',
  afastado: 'Pessoa afastada: confira os dias pagos pela empresa (até 15) e informe em Faltas os dias a cargo do INSS.',
}

function Dado({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{rotulo}</p>
      <p className="text-sm font-semibold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>{valor}</p>
    </div>
  )
}

export function ModalConferenciaFolha({ linha, companyId, mesAno, somenteLeitura, onClose }: {
  linha: LinhaFolha
  companyId: string
  mesAno: string
  somenteLeitura: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const { insumos, ponto } = linha
  const inicial = useMemo(() => calcularFolha(insumos, ponto, linha.ajustes), [insumos, ponto, linha.ajustes])
  const auto = inicial.automaticos

  const [textos, setTextos] = useState<Record<CampoFolha, string>>(
    () => Object.fromEntries(CAMPOS_FOLHA.map((c) => [c, paraTexto(c, inicial.valores[c])])) as Record<CampoFolha, string>,
  )
  const [observacao, setObservacao] = useState(linha.observacao ?? '')
  const [salvando, setSalvando] = useState(false)

  const ajustes = useMemo(() => {
    const a: AjustesFolha = {}
    for (const c of CAMPOS_FOLHA) {
      const v = paraNumero(c, textos[c])
      if (Math.abs(v - auto[c]) >= 0.005) a[c] = v
    }
    return a
  }, [textos, auto])
  const r = useMemo(() => calcularFolha(insumos, ponto, ajustes), [insumos, ponto, ajustes])

  async function salvar() {
    setSalvando(true)
    const valores = Object.fromEntries(CAMPOS_FOLHA.map((c) => [c, paraNumero(c, textos[c])]))
    const res = await toast.promise(salvarConferenciaAction(companyId, linha.employee.id, mesAno, { valores, observacao: observacao.trim() || null }), {
      loading: 'Salvando a conferência…',
      success: `Conferência de ${linha.employee.nome} salva.`,
      error: 'Não foi possível salvar.',
    })
    setSalvando(false)
    if ('error' in res) return
    router.refresh()
    onClose()
  }

  function Campo({ campo, rotulo, apurado }: { campo: CampoFolha; rotulo: string; apurado?: string }) {
    const editado = campo in ajustes
    return (
      <div>
        <label htmlFor={`folha-${campo}`} className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>{rotulo}</label>
        <div className="flex items-center h-9 rounded-lg border px-2.5 gap-1.5 bg-white focus-within:ring-2 focus-within:ring-[var(--color-brand)]" style={{ borderColor: editado ? 'var(--color-brand)' : 'var(--color-card-border)' }}>
          {!ehDias(campo) && <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>R$</span>}
          <input
            id={`folha-${campo}`}
            inputMode="decimal"
            disabled={somenteLeitura}
            value={textos[campo]}
            onChange={(e) => setTextos((t) => ({ ...t, [campo]: ehDias(campo) ? e.target.value.replace(/[^\d,]/g, '') : maskMoeda(e.target.value) }))}
            className="w-full min-w-0 text-sm outline-none bg-transparent tabular-nums disabled:opacity-70"
            style={{ color: 'var(--color-text-primary)' }}
          />
          {ehDias(campo) && <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>dias</span>}
        </div>
        <p className="text-[11px] mt-1 flex items-center justify-between gap-2" style={{ color: 'var(--color-text-muted)' }}>
          <span className="truncate">{apurado}</span>
          {editado && !somenteLeitura && (
            <button type="button" onClick={() => setTextos((t) => ({ ...t, [campo]: paraTexto(campo, auto[campo]) }))} className="font-semibold hover:underline shrink-0" style={{ color: 'var(--color-brand)' }}>
              Voltar ao automático
            </button>
          )}
        </p>
      </div>
    )
  }

  const titulo = 'text-xs font-bold uppercase tracking-wide'

  return (
    <Modal open onClose={() => { if (!salvando) onClose() }} title={linha.employee.nome} description={linha.employee.cargo ?? undefined} className="sm:max-w-2xl">
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-3">
          <h3 className={titulo} style={{ color: 'var(--color-text-muted)' }}>Apurado do ponto</h3>
          {ponto.motivo ? (
            <p className="text-sm rounded-lg px-3 py-2" style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-text-secondary)' }}>{AVISO[ponto.motivo]}</p>
          ) : (
            <>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                <Dado rotulo="Na escala" valor={String(ponto.diasEscala)} />
                <Dado rotulo="Trabalhados" valor={String(ponto.diasTrabalhados)} />
                <Dado rotulo="Faltas" valor={String(ponto.faltas)} />
                <Dado rotulo="Atestados" valor={String(ponto.atestados)} />
                <Dado rotulo="Atrasos" valor={horas(ponto.atrasoMin)} />
                <Dado rotulo="Horas extras" valor={horas(ponto.he50Min + ponto.heFeriadoMin + ponto.heDomingoMin)} />
              </div>
              {(ponto.noturnoMin ?? 0) > 0 && (
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  Horário noturno: <strong>{horas(ponto.noturnoMin ?? 0)}</strong> de relógio
                  {insumos.noturno?.reduzida ? <>, pagas como <strong>{horas(Math.round(horasNoturnasPagas(ponto.noturnoMin ?? 0, true) * 60))}</strong> pela hora reduzida</> : null}.
                </p>
              )}
              {ponto.ocorrencias.length > 0 && (
                <ul className="max-h-28 overflow-y-auto rounded-lg border px-3 py-2 flex flex-col gap-1" style={{ borderColor: 'var(--color-card-border)' }}>
                  {ponto.ocorrencias.map((o, i) => (
                    <li key={i} className="text-xs flex gap-2" style={{ color: 'var(--color-text-secondary)' }}>
                      <span className="font-semibold tabular-nums">{fmtData(o.data)}</span>{o.texto}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h3 className={titulo} style={{ color: 'var(--color-text-muted)' }}>Proventos</h3>
          {r.feriasNoRecibo ? (
            <p className="text-sm rounded-lg px-3 py-2" style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-text-secondary)' }}>
              Férias: {r.feriasNoRecibo.dias} dias neste mês, pagos no recibo de férias em {fmtData(r.feriasNoRecibo.pagamentoEm)}. Saem do salário, mas {moeda(r.feriasNoRecibo.valor + r.feriasNoRecibo.terco)} entram na base do INSS e do FGTS.
            </p>
          ) : r.diasFerias + (insumos.diasAbono ?? 0) > 0 && (
            <p className="text-sm rounded-lg px-3 py-2" style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-text-secondary)' }}>
              Férias: {r.diasFerias} dias, {moeda(r.valorFerias)} + 1/3 de {moeda(r.tercoFerias)}{r.abonoFerias > 0 ? ` · abono de ${moeda(r.abonoFerias)}` : ''}.
            </p>
          )}
          {(r.periculosidade > 0 || r.insalubridade > 0) && (
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {r.periculosidade > 0 ? `Adicional de periculosidade (30%): ${moeda(r.periculosidade)}` : `Adicional de insalubridade (${insumos.insalubridade?.pct ?? 0}%): ${moeda(r.insalubridade)}`}, pelo cargo.
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Campo({ campo: 'horas_extras', rotulo: `Hora extra ${Math.round(((insumos.fatorHe?.normal ?? 1.5) - 1) * 100)}%`, apurado: `${horas(ponto.he50Min)} apuradas` })}
            {Campo({ campo: 'horas_extras_feriado', rotulo: `Hora extra feriado ${Math.round(((insumos.fatorHe?.feriado ?? 2) - 1) * 100)}%`, apurado: `${horas(ponto.heFeriadoMin)} apuradas` })}
            {Campo({ campo: 'horas_extras_domingo', rotulo: `Hora extra domingo ${Math.round(((insumos.fatorHe?.domingo ?? 2) - 1) * 100)}%`, apurado: `${horas(ponto.heDomingoMin)} apuradas` })}
            {Campo({ campo: 'adicional_noturno', rotulo: `Adicional noturno ${insumos.noturno?.pct ?? 20}%`, apurado: insumos.noturno ? `${horas(ponto.noturnoMin ?? 0)} apuradas` : 'Desligado nas configurações' })}
            {Campo({ campo: 'bonus', rotulo: 'Comissão', apurado: 'Informado na conferência' })}
          </div>
          {insumos.dsr?.reflexo && (
            <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              DSR sobre horas extras e adicional noturno: <strong>{moeda(r.dsr)}</strong> ({insumos.dsr.descansos} domingos e feriados para {insumos.dsr.diasUteis} dias úteis no período). Acompanha os valores acima.
            </p>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h3 className={titulo} style={{ color: 'var(--color-text-muted)' }}>Descontos e ausências</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Campo({ campo: 'desconto_faltas', rotulo: 'Faltas', apurado: `Desconta ${moeda(r.valorFaltas)}` })}
            {Campo({ campo: 'dsr_perdido', rotulo: 'DSR perdido por falta', apurado: insumos.dsr?.descontaFalta ? `Desconta ${moeda(r.valorDsrPerdido)} · 1 por semana com falta` : 'Desligado nas configurações' })}
            {Campo({ campo: 'atestados', rotulo: 'Atestados', apurado: 'Não desconta do salário' })}
            {Campo({ campo: 'desconto_atrasos', rotulo: 'Atrasos', apurado: `${horas(ponto.atrasoMin)} apuradas` })}
            {Campo({ campo: 'desconto_adiantamento', rotulo: 'Adiantamento', apurado: insumos.adiantamentoPct ? `${insumos.adiantamentoPct}% do salário` : 'Informado na conferência' })}
            {Campo({ campo: 'desconto_vt', rotulo: 'Vale-transporte', apurado: 'Pela regra do benefício' })}
            {Campo({ campo: 'desconto_vr', rotulo: 'Vale-alimentação/refeição', apurado: 'Pela regra do benefício' })}
            {Campo({ campo: 'desconto_outros', rotulo: 'Outros benefícios', apurado: 'Pela regra do benefício' })}
          </div>
        </section>

        <div>
          <label htmlFor="folha-obs" className="block text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Observação para a contabilidade</label>
          <textarea
            id="folha-obs"
            rows={2}
            maxLength={1000}
            disabled={somenteLeitura}
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm resize-y bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)] disabled:opacity-70"
            style={{ borderColor: 'var(--color-card-border)', color: 'var(--color-text-primary)' }}
          />
        </div>

        <div className="rounded-xl px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3" style={{ backgroundColor: 'var(--color-brand-light)' }}>
          <Dado rotulo="Salário bruto" valor={moeda(r.bruto)} />
          <Dado rotulo="INSS" valor={moeda(r.inss)} />
          <Dado rotulo="IRRF" valor={moeda(r.irrf)} />
          <Dado rotulo="Líquido" valor={moeda(r.liquido)} />
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={salvando}>{somenteLeitura ? 'Fechar' : 'Cancelar'}</Button>
          {!somenteLeitura && <Button type="button" loading={salvando} onClick={salvar}>Salvar conferência</Button>}
        </div>
      </div>
    </Modal>
  )
}
