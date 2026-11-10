'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { tipoDaRegra, type ScheduleRule } from '@/lib/escala/generate'
import { somarDias } from '@/lib/escala/periodo'
import { toast } from '@/lib/toast'
import { padraoEscalaSchema } from '@/lib/validations/escala'
import { definirPadraoAction } from '../actions'

const SEMANA = [
  { dia: 1, rotulo: 'Seg' }, { dia: 2, rotulo: 'Ter' }, { dia: 3, rotulo: 'Qua' }, { dia: 4, rotulo: 'Qui' },
  { dia: 5, rotulo: 'Sex' }, { dia: 6, rotulo: 'Sáb' }, { dia: 0, rotulo: 'Dom' },
]
const INICIAIS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const ATALHOS_CICLO: [string, number, number][] = [['6x1', 6, 1], ['5x2', 5, 2], ['4x2', 4, 2], ['12x36', 1, 1], ['7x7', 7, 7], ['14x14', 14, 14], ['15x21', 15, 21]]
const DIAS_PREVIA = 14
const MAX_PREVIA = 56

type Modo = 'semanal' | 'ciclo'
type Pessoa = { id: string; nome: string; cargo?: string | null }

const hhmm = (t: string | null | undefined) => t?.slice(0, 5) ?? ''
const corRotulo = { color: 'var(--color-text-secondary)' }
const limitar = (n: number) => Math.min(60, Math.max(1, n || 1))

function Opcao({ ativa, onClick, children }: { ativa: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativa}
      className={`h-9 px-3 rounded-lg border text-sm transition-colors cursor-pointer ${ativa ? 'font-semibold' : 'hover:bg-gray-50'}`}
      style={ativa
        ? { borderColor: 'var(--color-brand)', backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }
        : { borderColor: 'var(--color-card-border)', color: 'var(--color-text-secondary)' }}
    >
      {children}
    </button>
  )
}

function Contador({ rotulo, valor, onChange }: { rotulo: string; valor: number; onChange: (n: number) => void }) {
  const botao = 'w-11 h-12 flex items-center justify-center text-xl font-bold cursor-pointer hover:bg-[var(--color-brand-light)] transition-colors'
  return (
    <div className="flex-1 min-w-32">
      <p className="text-sm font-medium mb-1 text-center" style={corRotulo}>{rotulo}</p>
      <div className="flex items-center rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-card-border)' }}>
        <button type="button" onClick={() => onChange(limitar(valor - 1))} aria-label={`Diminuir ${rotulo}`} className={botao} style={{ color: 'var(--color-brand)' }}>−</button>
        <input
          type="number"
          min={1}
          max={60}
          value={valor}
          aria-label={rotulo}
          onChange={(e) => onChange(limitar(Number(e.target.value)))}
          className="flex-1 min-w-0 h-12 text-center text-xl font-extrabold tabular-nums outline-none bg-transparent [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}
        />
        <button type="button" onClick={() => onChange(limitar(valor + 1))} aria-label={`Aumentar ${rotulo}`} className={botao} style={{ color: 'var(--color-brand)' }}>+</button>
      </div>
    </div>
  )
}

/** Adiciona uma ou mais pessoas ao quadro, ou edita a escala de quem já está nele */
export function ModalPadrao({ companyId, disponiveis, pessoa, atual, inicioSugerido, onClose, onSalvo }: {
  companyId: string
  /** Quem pode ser adicionado (ao adicionar) */
  disponiveis?: Pessoa[]
  /** Quem está sendo editado */
  pessoa?: Pessoa
  atual: ScheduleRule | null
  inicioSugerido: string
  onClose: () => void
  onSalvo: () => void
}) {
  const router = useRouter()
  const [marcados, setMarcados] = useState<string[]>(disponiveis?.length === 1 ? [disponiveis[0].id] : [])
  const [busca, setBusca] = useState('')
  const [modo, setModo] = useState<Modo>(atual?.tipo_escala ?? 'ciclo')
  const [folgas, setFolgas] = useState<number[]>(atual?.dias_folga.length ? atual.dias_folga : [6, 0])
  const [trabalha, setTrabalha] = useState(atual?.ciclo_trabalho_dias ?? 6)
  const [folga, setFolga] = useState(atual?.ciclo_folga_dias ?? 1)
  const [entrada, setEntrada] = useState(hhmm(atual?.hora_entrada) || '08:00')
  const [saida, setSaida] = useState(hhmm(atual?.hora_saida) || '17:00')
  const [almocoInicio, setAlmocoInicio] = useState(atual ? hhmm(atual.hora_almoco_inicio) : '12:00')
  const [almocoFim, setAlmocoFim] = useState(atual ? hhmm(atual.hora_almoco_fim) : '13:00')
  const [inicio, setInicio] = useState(inicioSugerido)
  const [expira, setExpira] = useState(atual?.data_fim ?? '')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  // Editando só o horário de um ciclo, a contagem continua de onde estava
  const mantemCiclo = modo === 'ciclo' && atual?.tipo_escala === 'ciclo' && atual.ciclo_trabalho_dias === trabalha && atual.ciclo_folga_dias === folga
  const referencia = mantemCiclo ? atual.data_referencia : null

  const q = busca.trim().toLowerCase()
  const lista = (disponiveis ?? []).filter((p) => !q || p.nome.toLowerCase().includes(q))

  // Mostra ao menos um ciclo inteiro, para a folga de escalas longas aparecer
  const diasPrevia = modo === 'ciclo' ? Math.max(DIAS_PREVIA, Math.min(trabalha + folga, MAX_PREVIA)) : DIAS_PREVIA

  const previa = useMemo(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio)) return []
    const regra: ScheduleRule = {
      id: '', employee_id: '', data_inicio: inicio, data_fim: expira || null, hora_entrada: entrada, hora_saida: saida, hora_almoco_inicio: null, hora_almoco_fim: null,
      tipo_escala: modo, dias_folga: modo === 'semanal' ? folgas : [], data_referencia: modo === 'ciclo' ? referencia ?? inicio : null,
      ciclo_trabalho_dias: modo === 'ciclo' ? trabalha : null, ciclo_folga_dias: modo === 'ciclo' ? folga : null, folga_patterns: [],
    }
    return Array.from({ length: diasPrevia }, (_, i) => {
      const data = somarDias(inicio, i)
      return { data, tipo: tipoDaRegra([regra], data) }
    }).filter((d) => d.tipo !== 'sem_regra')
  }, [inicio, expira, modo, folgas, trabalha, folga, entrada, saida, referencia, diasPrevia])

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    const ids = pessoa ? [pessoa.id] : marcados
    const dados = {
      employee_ids: ids,
      data_inicio: inicio,
      data_fim: expira || null,
      data_referencia: referencia,
      tipo_escala: modo,
      dias_folga: modo === 'semanal' ? folgas : [],
      ciclo_trabalho_dias: modo === 'ciclo' ? trabalha : null,
      ciclo_folga_dias: modo === 'ciclo' ? folga : null,
      hora_entrada: entrada,
      hora_saida: saida,
      hora_almoco_inicio: almocoInicio || null,
      hora_almoco_fim: almocoFim || null,
    }
    const v = padraoEscalaSchema.safeParse(dados)
    if (!v.success) { setErro(v.error.issues[0].message); return }

    setErro('')
    setSalvando(true)
    const r = await toast.promise(definirPadraoAction(companyId, dados), {
      loading: 'Salvando a escala…',
      success: pessoa ? `Escala de ${pessoa.nome} salva.` : ids.length === 1 ? 'Colaborador adicionado ao quadro.' : `${ids.length} colaboradores adicionados ao quadro.`,
      error: 'Não foi possível salvar a escala.',
    })
    setSalvando(false)
    if ('error' in r) return
    onSalvo()
    router.refresh()
  }

  const dicaInicio = `${modo === 'ciclo'
    ? (mantemCiclo ? 'O ciclo continua na contagem atual.' : 'O ciclo começa a contar neste dia.')
    : 'Os dias anteriores continuam como estavam.'} Daqui em diante, as trocas avulsas são apagadas.`

  return (
    <Modal open onClose={() => { if (!salvando) onClose() }} title={pessoa ? 'Editar escala' : 'Adicionar colaborador'} description={pessoa?.nome}>
      <form onSubmit={salvar} noValidate className="flex flex-col gap-5">
        {disponiveis && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium" style={corRotulo}>Colaboradores{marcados.length ? ` (${marcados.length})` : ''}</p>
            {disponiveis.length > 6 && <Input aria-label="Pesquisar colaborador" placeholder="Pesquisar..." value={busca} onChange={(e) => setBusca(e.target.value)} />}
            <div className="max-h-40 overflow-y-auto rounded-xl border divide-y" style={{ borderColor: 'var(--color-card-border)' }}>
              {lista.length === 0 && <p className="px-3 py-3 text-sm" style={{ color: 'var(--color-text-muted)' }}>Ninguém encontrado.</p>}
              {lista.map((p) => (
                <label key={p.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50" style={{ borderColor: 'var(--color-card-border)', color: 'var(--color-text-primary)' }}>
                  <input
                    type="checkbox"
                    checked={marcados.includes(p.id)}
                    onChange={() => setMarcados((m) => (m.includes(p.id) ? m.filter((x) => x !== p.id) : [...m, p.id]))}
                    style={{ accentColor: 'var(--color-brand)' }}
                  />
                  <span className="truncate">{p.nome}</span>
                  {p.cargo && <span className="truncate text-xs ml-auto" style={{ color: 'var(--color-text-muted)' }}>{p.cargo}</span>}
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Opcao ativa={modo === 'ciclo'} onClick={() => setModo('ciclo')}>Trabalha x folga</Opcao>
          <Opcao ativa={modo === 'semanal'} onClick={() => setModo('semanal')}>Folga em dias fixos</Opcao>
        </div>

        {modo === 'ciclo' ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-3">
              <Contador rotulo="Trabalha (dias)" valor={trabalha} onChange={setTrabalha} />
              <Contador rotulo="Folga (dias)" valor={folga} onChange={setFolga} />
            </div>
            <div className="flex flex-wrap gap-2">
              {ATALHOS_CICLO.map(([rotulo, t, f]) => (
                <Opcao key={rotulo} ativa={trabalha === t && folga === f} onClick={() => { setTrabalha(t); setFolga(f) }}>{rotulo}</Opcao>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {SEMANA.map(({ dia, rotulo }) => (
              <Opcao key={dia} ativa={folgas.includes(dia)} onClick={() => setFolgas((f) => (f.includes(dia) ? f.filter((d) => d !== dia) : [...f, dia]))}>{rotulo}</Opcao>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label={modo === 'ciclo' ? 'Começa em' : 'Vale a partir de'} type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} hint={dicaInicio} />
          <Input label="Expira em" type="date" min={inicio} value={expira} onChange={(e) => setExpira(e.target.value)} hint="Último dia da escala. Em branco, não expira." />
        </div>

        {previa.length > 0 && (
          <div>
            <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Próximos {previa.length} {previa.length === 1 ? 'dia' : 'dias'}</p>
            <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${DIAS_PREVIA}, minmax(0, 1fr))` }}>
              {previa.map(({ data, tipo }) => {
                const emFolga = tipo === 'folga'
                return (
                  <div key={data} className="min-w-0 text-center" title={`${data.slice(8)}/${data.slice(5, 7)}: ${emFolga ? 'folga' : 'trabalho'}`}>
                    <span className="block text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{INICIAIS[new Date(`${data}T00:00:00`).getDay()]}</span>
                    <span
                      className="flex items-center justify-center h-7 rounded text-[11px] font-bold tabular-nums"
                      style={emFolga ? { backgroundColor: 'var(--color-brand)', color: '#fff' } : { backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-secondary)' }}
                    >
                      {Number(data.slice(8))}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Input label="Entrada" type="time" value={entrada} onChange={(e) => setEntrada(e.target.value)} />
          <Input label="Saída" type="time" value={saida} onChange={(e) => setSaida(e.target.value)} />
          <Input label="Início do almoço" type="time" value={almocoInicio} onChange={(e) => setAlmocoInicio(e.target.value)} />
          <Input label="Fim do almoço" type="time" value={almocoFim} onChange={(e) => setAlmocoFim(e.target.value)} />
        </div>

        {erro && <p className="text-sm" style={{ color: 'var(--color-error)' }}>{erro}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={salvando}>Cancelar</Button>
          <Button type="submit" loading={salvando}>
            {!salvando && !pessoa && <Icon name="plus" size={16} />}
            {pessoa ? 'Salvar escala' : 'Adicionar ao quadro'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
