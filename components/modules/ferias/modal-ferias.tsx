'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Select } from '@/components/ui/select'
import { somarDias } from '@/lib/escala/periodo'
import {
  ABONO_MAX, DIREITO_DIAS, FRACAO_LONGA, FRACAO_MIN, FRACOES_MAX,
  calcularPeriodos, fimDasFerias, fmt, validarFerias, type ConfigFerias, type FeriasRegistro, type PeriodoAquisitivo,
} from '@/lib/ferias/regras'
import { toast } from '@/lib/toast'

type Pessoa = { id: string; nome: string; data_admissao: string | null }
type Modo = 'inteiro' | 'dividir'

const texto = { color: 'var(--color-text-secondary)' }
const COR_VENDA = '#D97706'

function Opcao({ ativa, onClick, titulo, descricao }: { ativa: boolean; onClick: () => void; titulo: string; descricao: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativa}
      className={`flex-1 min-w-[140px] text-left rounded-xl border px-3 py-2.5 transition-colors cursor-pointer ${ativa ? '' : 'hover:bg-gray-50'}`}
      style={ativa ? { borderColor: 'var(--color-brand)', backgroundColor: 'var(--color-brand-light)' } : { borderColor: 'var(--color-card-border)' }}
    >
      <span className="block text-sm font-semibold" style={{ color: ativa ? 'var(--color-brand)' : 'var(--color-text-primary)' }}>{titulo}</span>
      <span className="block text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{descricao}</span>
    </button>
  )
}

function Contador({ rotulo, valor, min, max, onChange, dica }: { rotulo: string; valor: number; min: number; max: number; onChange: (n: number) => void; dica?: string }) {
  const limitar = (n: number) => Math.min(max, Math.max(min, Number.isFinite(n) ? Math.round(n) : min))
  const botao = 'w-10 h-10 flex items-center justify-center text-lg font-bold cursor-pointer hover:bg-[var(--color-brand-light)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors'
  return (
    <div>
      <p className="text-sm font-medium mb-1" style={texto}>{rotulo}</p>
      <div className="flex items-center rounded-lg border overflow-hidden bg-white" style={{ borderColor: 'var(--color-card-border)' }}>
        <button type="button" disabled={valor <= min} onClick={() => onChange(limitar(valor - 1))} aria-label={`Diminuir ${rotulo}`} className={botao} style={{ color: 'var(--color-brand)' }}>−</button>
        <input
          type="number"
          aria-label={rotulo}
          value={valor}
          min={min}
          max={max}
          onChange={(e) => onChange(limitar(Number(e.target.value)))}
          className="flex-1 min-w-0 h-10 text-center text-lg font-extrabold tabular-nums outline-none bg-transparent [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}
        />
        <button type="button" disabled={valor >= max} onClick={() => onChange(limitar(valor + 1))} aria-label={`Aumentar ${rotulo}`} className={botao} style={{ color: 'var(--color-brand)' }}>+</button>
      </div>
      {dica && <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{dica}</p>}
    </div>
  )
}

/** Como os 30 dias do período ficam: já marcados, esta parte, vendidos e o que sobra */
function BarraPeriodo({ periodo, dias, abono }: { periodo: PeriodoAquisitivo; dias: number; abono: number }) {
  const marcados = DIREITO_DIAS - periodo.saldo
  const sobra = Math.max(0, periodo.saldo - dias - abono)
  const partes = [
    { rotulo: 'Já marcados', valor: marcados, cor: '#9CA3AF' },
    { rotulo: 'Estas férias', valor: dias, cor: 'var(--color-brand)' },
    { rotulo: 'Vendidos', valor: abono, cor: COR_VENDA },
    { rotulo: 'Sobram', valor: sobra, cor: '#E5E7EB' },
  ].filter((p) => p.valor > 0)
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-3 rounded-full overflow-hidden" style={{ backgroundColor: '#E5E7EB' }} aria-hidden>
        {partes.map((p) => <div key={p.rotulo} style={{ width: `${(p.valor / DIREITO_DIAS) * 100}%`, backgroundColor: p.cor }} />)}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs" style={texto}>
        {partes.map((p) => (
          <span key={p.rotulo} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: p.cor, border: p.rotulo === 'Sobram' ? '1px solid #D1D5DB' : undefined }} />
            {p.rotulo}: <strong className="tabular-nums">{p.valor} {p.valor === 1 ? 'dia' : 'dias'}</strong>
          </span>
        ))}
      </div>
    </div>
  )
}

/**
 * Programar (área de Pessoas) ou solicitar (colaborador) férias. Os dias de férias e os vendidos sempre fecham com o
 * saldo do período; a regra do feriado e da folga é conferida no servidor, que conhece a escala.
 */
export function ModalFerias({ titulo, pessoas, feriasDe, config, origem, acao, onClose, onSalvo }: {
  titulo: string
  /** Uma pessoa só (colaborador) ou a lista para escolher (área de Pessoas) */
  pessoas: Pessoa[]
  feriasDe: (employeeId: string) => FeriasRegistro[]
  config: ConfigFerias
  origem: 'colaborador' | 'gestor'
  acao: (dados: { employee_id?: string; periodo_inicio: string; data_inicio: string; dias: number; dias_abono: number; observacao: string }) => Promise<{ error?: string } | { success: true }>
  onClose: () => void
  onSalvo: () => void
}) {
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
  const [empId, setEmpId] = useState(pessoas.length === 1 ? pessoas[0].id : '')
  const pessoa = pessoas.find((p) => p.id === empId) ?? null

  const periodos = useMemo(() => (pessoa ? calcularPeriodos(pessoa.data_admissao, hoje, feriasDe(pessoa.id)) : []), [pessoa, hoje, feriasDe])
  const escolhiveis = periodos.filter((p) => p.saldo > 0 && (origem === 'gestor' || p.situacao !== 'em_aquisicao'))

  const [periodoInicio, setPeriodoInicio] = useState('')
  const periodo = escolhiveis.find((p) => p.inicio === periodoInicio) ?? escolhiveis[0] ?? null
  const minimo = somarDias(hoje, origem === 'colaborador' ? config.ferias_antecedencia_dias : 0)

  const [modoEscolhido, setModoEscolhido] = useState<Modo>('inteiro')
  const [diasParte, setDiasParte] = useState(FRACAO_LONGA)
  const [abono, setAbono] = useState(0)
  const [inicio, setInicio] = useState('')
  const [observacao, setObservacao] = useState('')
  const [salvando, setSalvando] = useState(false)

  // O que este período ainda permite
  const podeVender = !!periodo && config.ferias_permite_abono && !periodo.abonoUsado
  const podeDividir = !!periodo && config.ferias_permite_fracionar && periodo.fracoes < FRACOES_MAX - 1
  const modo: Modo = podeDividir ? modoEscolhido : 'inteiro'
  const saldo = periodo?.saldo ?? 0
  const abonoMax = podeVender ? Math.max(0, Math.min(ABONO_MAX, saldo - FRACAO_MIN)) : 0
  const abonoAtual = Math.min(abono, abonoMax)
  const paraTirar = saldo - abonoAtual
  // Dividindo, esta parte deixa saldo para outra de ao menos 5 dias
  const maxParte = Math.max(FRACAO_MIN, paraTirar - FRACAO_MIN)
  const dias = modo === 'inteiro' ? paraTirar : Math.min(Math.max(diasParte, FRACAO_MIN), maxParte)

  // Sugestões de tamanho para a parte, só as que a CLT aceita
  const sugestoes = periodo && modo === 'dividir'
    ? [...new Set([FRACAO_LONGA, 15, 20, Math.floor(paraTirar / 2), paraTirar - FRACAO_LONGA])]
      .filter((n) => n >= FRACAO_MIN && n <= maxParte)
      .filter((n) => !validarFerias({ periodo, pedido: { inicio: somarDias(periodo.fim, 1), dias: n, abono: abonoAtual }, config, hoje, origem: 'gestor' }))
      .sort((a, b) => a - b)
    : []

  const erro = periodo ? validarFerias({ periodo, pedido: { inicio, dias, abono: abonoAtual }, config, hoje, origem }) : null
  const fim = inicio && dias >= 1 ? fimDasFerias(inicio, dias) : null

  function trocarPeriodo(valor: string) {
    setPeriodoInicio(valor)
    setAbono(0)
    setModoEscolhido('inteiro')
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!pessoa) { toast.error('Selecione o funcionário.'); return }
    if (!periodo) { toast.error('Não há período com saldo para estas férias.'); return }
    if (!inicio) { toast.error('Informe o início das férias.'); return }
    if (erro) { toast.error(erro); return }
    setSalvando(true)
    const r = await toast.promise(acao({ employee_id: origem === 'gestor' ? pessoa.id : undefined, periodo_inicio: periodo.inicio, data_inicio: inicio, dias, dias_abono: abonoAtual, observacao }), {
      loading: origem === 'gestor' ? 'Programando as férias…' : 'Enviando o pedido…',
      success: origem === 'gestor' ? 'Férias programadas.' : 'Pedido enviado para aprovação.',
      error: 'Não foi possível concluir.',
    })
    setSalvando(false)
    if ('error' in r) return
    onSalvo()
  }

  const semPeriodo = pessoa && !escolhiveis.length
  const continuacao = !!periodo && periodo.fracoes > 0

  return (
    <Modal open onClose={() => { if (!salvando) onClose() }} title={titulo} description={origem === 'gestor' && pessoa ? pessoa.nome : undefined} className="sm:max-w-xl">
      <form onSubmit={salvar} noValidate className="flex flex-col gap-5">
        {pessoas.length > 1 && (
          <Select label="Funcionário *" placeholder="Selecionar..." options={pessoas.map((p) => ({ value: p.id, label: p.nome }))} value={empId} onChange={(e) => { setEmpId(e.target.value); trocarPeriodo('') }} />
        )}

        {pessoa && !pessoa.data_admissao && (
          <p className="text-sm rounded-lg px-3 py-2" style={{ backgroundColor: '#FEF3C7', color: '#B45309' }}>Sem data de admissão na ficha: não dá para calcular os períodos de férias.</p>
        )}
        {semPeriodo && pessoa?.data_admissao && (
          <p className="text-sm rounded-lg px-3 py-2" style={{ backgroundColor: 'var(--color-brand-light)', ...texto }}>
            {origem === 'colaborador' ? 'Você ainda não tem período com saldo para pedir férias.' : 'Esta pessoa não tem período com saldo de férias.'}
          </p>
        )}

        {periodo && (
          <>
            <div className="flex flex-col gap-1">
              <Select
                label="Período aquisitivo *"
                options={escolhiveis.map((p) => ({ value: p.inicio, label: `${fmt(p.inicio)} a ${fmt(p.fim)} · saldo de ${p.saldo} dias${p.situacao === 'em_aquisicao' ? ' (em aquisição)' : ''}` }))}
                value={periodo.inicio}
                onChange={(e) => trocarPeriodo(e.target.value)}
              />
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>As férias deste período precisam começar até {fmt(periodo.concessivoFim)}.</p>
            </div>

            {podeDividir ? (
              <div className="flex flex-wrap gap-2">
                <Opcao
                  ativa={modo === 'inteiro'}
                  onClick={() => setModoEscolhido('inteiro')}
                  titulo={continuacao ? 'Usar todo o saldo' : 'Tudo de uma vez'}
                  descricao={`${paraTirar} dias seguidos${abonoAtual ? `, mais ${abonoAtual} vendidos` : ''}`}
                />
                <Opcao
                  ativa={modo === 'dividir'}
                  onClick={() => setModoEscolhido('dividir')}
                  titulo={continuacao ? 'Mais uma parte' : 'Dividir em partes'}
                  descricao={`Até ${FRACOES_MAX} partes${periodo.temFracaoLonga ? '' : `, uma de ${FRACAO_LONGA}+ dias`}`}
                />
              </div>
            ) : config.ferias_permite_fracionar && continuacao ? (
              <p className="text-sm" style={texto}>Esta é a última parte permitida: são os {paraTirar} dias que restam no período.</p>
            ) : null}

            <div className={`grid gap-3 ${podeVender ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
              {modo === 'dividir' ? (
                <Contador rotulo="Dias desta parte" valor={dias} min={FRACAO_MIN} max={maxParte} onChange={setDiasParte} dica={`Sobram ${paraTirar - dias} dias para as próximas partes.`} />
              ) : (
                <div>
                  <p className="text-sm font-medium mb-1" style={texto}>Dias de férias</p>
                  <div className="h-10 rounded-lg flex items-center px-3 text-lg font-extrabold tabular-nums" style={{ fontFamily: 'Manrope', backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}>{dias}</div>
                  <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{abonoAtual ? `Saldo de ${saldo} menos ${abonoAtual} vendidos.` : 'O saldo inteiro do período.'}</p>
                </div>
              )}
              {podeVender && (
                <Contador rotulo="Dias vendidos" valor={abonoAtual} min={0} max={abonoMax} onChange={setAbono} dica={`Até ${abonoMax} dias, pagos com 1/3 a mais.`} />
              )}
            </div>

            {sugestoes.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 -mt-2">
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Sugestões:</span>
                {sugestoes.map((n) => (
                  <button key={n} type="button" onClick={() => setDiasParte(n)} className="h-7 px-2.5 rounded-full border text-xs font-semibold cursor-pointer hover:bg-[var(--color-brand-light)]" style={n === dias ? { borderColor: 'var(--color-brand)', color: 'var(--color-brand)', backgroundColor: 'var(--color-brand-light)' } : { borderColor: 'var(--color-card-border)', ...texto }}>
                    {n} + {paraTirar - n}
                  </button>
                ))}
              </div>
            )}

            <BarraPeriodo periodo={periodo} dias={dias} abono={abonoAtual} />

            <div className="flex flex-col gap-1">
              <Input label="Início *" type="date" min={origem === 'colaborador' ? minimo : undefined} value={inicio} onChange={(e) => setInicio(e.target.value)} />
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {origem === 'colaborador' ? `Com ${config.ferias_antecedencia_dias} dias de antecedência: a partir de ${fmt(minimo)}. ` : ''}Não pode cair nos 2 dias antes de feriado ou folga.
              </p>
            </div>

            {inicio && (
              <div className="text-sm rounded-lg px-3 py-2.5 leading-relaxed" style={{ backgroundColor: erro ? '#FEF3C7' : 'var(--color-brand-light)', color: erro ? '#B45309' : 'var(--color-text-secondary)' }}>
                {erro
                  ? <p className="font-semibold">{erro}</p>
                  : fim && <p>Férias de <strong>{fmt(inicio)}</strong> a <strong>{fmt(fim)}</strong>, volta ao trabalho em <strong>{fmt(somarDias(fim, 1))}</strong>{abonoAtual ? <>. Os {abonoAtual} dias vendidos são pagos junto</> : null}.</p>}
              </div>
            )}

            <Input label="Observação" maxLength={500} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          </>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={salvando}>Cancelar</Button>
          <Button type="submit" loading={salvando} disabled={!periodo}>{origem === 'gestor' ? 'Programar' : 'Enviar pedido'}</Button>
        </div>
      </form>
    </Modal>
  )
}
