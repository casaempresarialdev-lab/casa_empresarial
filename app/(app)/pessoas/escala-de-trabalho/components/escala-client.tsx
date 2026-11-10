'use client'

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { SummaryCard } from '@/components/modules/dashboard/summary-card'
import { ActionMenu } from '@/components/ui/action-menu'
import { AddButton } from '@/components/ui/add-button'
import { FilterResult, SearchField } from '@/components/ui/filter-select'
import { Icon } from '@/components/ui/icon'
import { generateRange, tipoDaRegra } from '@/lib/escala/generate'
import type { DayResult, ScheduleException, ScheduleRule } from '@/lib/escala/generate'
import type { FeriadoEmpresa } from '@/lib/escala/feriados'
import { periodoDoMes } from '@/lib/escala/periodo'
import { baixarArquivo, exportarExcel as gerarExcel, type QuadroExport } from '@/lib/export/escala-export'
import { DEFAULT_BRAND_COLOR } from '@/lib/theme'
import { toast } from '@/lib/toast'
import type { Company } from '../../../empresa/queries'
import { definirDiasAction } from '../actions'
import { ModalFeriados } from './modal-feriados'
import { ModalPadrao } from './modal-padrao'
import { ModalRemoverEscala } from './modal-remover-escala'

interface Props {
  rules: ScheduleRule[]
  exceptions: ScheduleException[]
  employees: { id: string; nome: string; cargo: string | null }[]
  feriados: FeriadoEmpresa[]
  company: Company | null
  companyId: string
  /** Uma data dentro do mês exibido */
  data: string
  readOnly?: boolean
}

type TipoDia = 'folga' | 'trabalho'
type Arraste = { empId: string; tipo: TipoDia; datas: string[] }
type Celula = { dia: DayResult; tipo: DayResult['tipo']; foraDaEscala: boolean; editavel: boolean }

const INICIAIS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const NOMES_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const FERIADO_FUNDO = '#EBF5FB'
const DOMINGO_FUNDO = '#F7F7F7'
const ESTILO_FORA_DA_ESCALA: React.CSSProperties = { backgroundColor: '#FEF3C7', color: '#B45309', boxShadow: 'inset 0 0 0 1.5px #B45309' }

const diaDaSemana = (data: string) => new Date(`${data}T00:00:00`).getDay()
const fmtDia = (data: string) => `${data.slice(8)}/${data.slice(5, 7)}`
const chave = (empId: string, data: string) => `${empId}|${data}`

/** Padrão em vigor no período: as regras chegam ordenadas pelo início */
function regraDoPeriodo(regras: ScheduleRule[], inicio: string, fim: string) {
  return regras.filter((r) => r.data_inicio <= fim && (!r.data_fim || r.data_fim >= inicio)).at(-1) ?? null
}

function descricaoPadrao(r: ScheduleRule | null) {
  if (!r) return 'Sem padrão definido'
  const horario = `${r.hora_entrada.slice(0, 5)}–${r.hora_saida.slice(0, 5)}`
  return r.data_fim ? `${horario} · até ${r.data_fim.split('-').reverse().join('/')}` : horario
}

/** Nome da escala: quem tem o mesmo nome fica no mesmo grupo do quadro */
function nomeEscala(r: ScheduleRule | null) {
  if (!r) return 'Sem escala'
  if (r.tipo_escala === 'ciclo') return r.ciclo_trabalho_dias === 1 && r.ciclo_folga_dias === 1 ? '12x36' : `${r.ciclo_trabalho_dias}x${r.ciclo_folga_dias}`
  const folgas = [1, 2, 3, 4, 5, 6, 0].filter((d) => r.dias_folga.includes(d)).map((d) => NOMES_SEMANA[d])
  return folgas.length ? `Folga ${folgas.join(', ')}` : 'Sem folga fixa'
}

function descricaoCelula(c: Celula) {
  if (c.tipo === 'sem_regra') return 'Sem padrão'
  const base = c.tipo === 'folga' ? 'Folga' : 'Trabalho'
  return c.foraDaEscala ? `${base} fora da escala` : base
}

function estiloCelula(c: Celula): { texto: string; estilo: React.CSSProperties } {
  if (c.tipo === 'sem_regra') return { texto: '—', estilo: { color: 'var(--color-text-muted)' } }
  if (c.tipo === 'folga') {
    return c.foraDaEscala
      ? { texto: 'F', estilo: ESTILO_FORA_DA_ESCALA }
      : { texto: 'F', estilo: { backgroundColor: 'var(--color-brand)', color: '#fff' } }
  }
  if (c.foraDaEscala) return { texto: 'T', estilo: ESTILO_FORA_DA_ESCALA }
  return { texto: '·', estilo: { color: 'var(--color-text-muted)' } }
}

function Legenda() {
  const itens: [string, React.CSSProperties, string][] = [
    ['·', { color: 'var(--color-text-muted)' }, 'Trabalho'],
    ['F', { backgroundColor: 'var(--color-brand)', color: '#fff' }, 'Folga'],
    ['F', ESTILO_FORA_DA_ESCALA, 'Folga fora da escala'],
    ['T', ESTILO_FORA_DA_ESCALA, 'Trabalho fora da escala'],
    ['', { backgroundColor: FERIADO_FUNDO }, 'Feriado'],
  ]
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
      {itens.map(([marca, estilo, rotulo]) => (
        <span key={rotulo} className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded flex items-center justify-center text-[11px] font-bold" style={estilo}>{marca}</span>
          {rotulo}
        </span>
      ))}
    </div>
  )
}

// Quadro de folgas: pessoas nas linhas e dias nas colunas. Marca-se a folga; o resto é trabalho.
export function EscalaClient({ rules, exceptions, employees, feriados, company, companyId, data, readOnly = false }: Props) {
  const router = useRouter()
  const [busca, setBusca] = useState('')
  // Modal da escala: adicionar pessoas (sem `pessoa`) ou editar quem já está no quadro
  const [editor, setEditor] = useState<{ pessoa?: { id: string; nome: string } } | null>(null)
  const [remover, setRemover] = useState<{ id: string; nome: string } | null>(null)
  const [gerirFeriados, setGerirFeriados] = useState(false)
  const [arraste, setArrasteState] = useState<Arraste | null>(null)
  const [otimista, setOtimista] = useState<Record<string, TipoDia>>({})
  const arrasteRef = useRef<Arraste | null>(null)
  const emAndamento = useRef(0)
  const ultimoFoiMouse = useRef(false)
  const [exportando, setExportando] = useState(false)

  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
  const periodo = useMemo(() => periodoDoMes(data), [data])
  const { inicio, fim } = periodo

  // Dias do período com feriados e domingos, independente de pessoa
  const colunas = useMemo(() => generateRange([], [], inicio, fim, '', feriados), [inicio, fim, feriados])

  // No quadro fica quem tem escala no período; quem foi removido hoje já some da tela do período atual
  const noPeriodoAtual = hoje >= inicio && hoje <= fim
  const noQuadro = useMemo(() => {
    const limite = noPeriodoAtual ? hoje : inicio
    return employees.filter((e) => rules.some((r) => r.employee_id === e.id && r.data_inicio <= fim && (!r.data_fim || r.data_fim >= limite)))
  }, [employees, rules, noPeriodoAtual, hoje, inicio, fim])

  const q = busca.trim().toLowerCase()
  const visiveis = useMemo(() => noQuadro.filter((e) => !q || e.nome.toLowerCase().includes(q) || (e.cargo ?? '').toLowerCase().includes(q)), [noQuadro, q])

  const porPessoa = useMemo(() => visiveis.map((emp) => ({
    emp,
    regras: rules.filter((r) => r.employee_id === emp.id),
    dias: generateRange(rules, exceptions, inicio, fim, emp.id, feriados),
  })), [visiveis, rules, exceptions, feriados, inicio, fim])

  // O servidor já respondeu: o que veio dele substitui o que estava só na tela
  useEffect(() => {
    if (emAndamento.current === 0) setOtimista({})
  }, [rules, exceptions])

  const tipoNaTela = (empId: string, d: DayResult): DayResult['tipo'] => {
    if (arraste?.empId === empId && arraste.datas.includes(d.date)) return arraste.tipo
    return otimista[chave(empId, d.date)] ?? d.tipo
  }

  const linhas = porPessoa.map(({ emp, regras, dias }) => {
    const regra = regraDoPeriodo(regras, inicio, fim)
    const celulas: Celula[] = dias.map((dia) => {
      const tipo = tipoNaTela(emp.id, dia)
      const base = tipoDaRegra(regras, dia.date)
      return { dia, tipo, foraDaEscala: base !== 'sem_regra' && tipo !== base, editavel: !readOnly && base !== 'sem_regra' }
    })
    return { emp, regras, celulas, regra, grupo: nomeEscala(regra), folgas: celulas.filter((c) => c.tipo === 'folga').length }
  }).sort((a, b) => a.grupo.localeCompare(b.grupo, 'pt-BR', { numeric: true }) || a.emp.nome.localeCompare(b.emp.nome, 'pt-BR'))

  const indicadores = {
    folgas: linhas.reduce((s, l) => s + l.folgas, 0),
    foraDaEscala: linhas.reduce((s, l) => s + l.celulas.filter((c) => c.foraDaEscala).length, 0),
  }

  const setArraste = (a: Arraste | null) => { arrasteRef.current = a; setArrasteState(a) }

  async function salvar({ empId, tipo, datas }: Arraste) {
    setOtimista((o) => ({ ...o, ...Object.fromEntries(datas.map((d) => [chave(empId, d), tipo])) }))
    emAndamento.current++
    let erro: string | null = null
    try {
      const r = await definirDiasAction(companyId, empId, datas, tipo)
      if ('error' in r) erro = r.error ?? 'Não foi possível salvar.'
    } catch {
      erro = 'Não foi possível salvar. Verifique sua conexão.'
    }
    emAndamento.current--
    if (erro) {
      toast.error(erro)
      setOtimista((o) => Object.fromEntries(Object.entries(o).filter(([k]) => !datas.some((d) => k === chave(empId, d)))))
    }
    if (emAndamento.current === 0) router.refresh()
  }

  // Arrastando com o mouse: ao soltar, em qualquer lugar da tela, grava os dias marcados
  const arrastando = !!arraste
  useEffect(() => {
    if (!arrastando) return
    const soltar = () => {
      const a = arrasteRef.current
      setArraste(null)
      if (a) salvar(a)
    }
    window.addEventListener('pointerup', soltar)
    return () => window.removeEventListener('pointerup', soltar)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrastando])

  const oposto = (c: Celula): TipoDia => (c.tipo === 'folga' ? 'trabalho' : 'folga')

  function iniciarArraste(e: React.PointerEvent, empId: string, c: Celula) {
    ultimoFoiMouse.current = e.pointerType === 'mouse'
    if (!c.editavel || e.pointerType !== 'mouse' || e.button !== 0) return
    setArraste({ empId, tipo: oposto(c), datas: [c.dia.date] })
  }

  function continuarArraste(empId: string, c: Celula) {
    const a = arrasteRef.current
    if (!a || a.empId !== empId || !c.editavel || a.datas.includes(c.dia.date)) return
    setArraste({ ...a, datas: [...a.datas, c.dia.date] })
  }

  /** Toque e teclado; o mouse já foi tratado no arraste */
  function clicar(e: React.MouseEvent, empId: string, c: Celula) {
    if (!c.editavel || (e.detail !== 0 && ultimoFoiMouse.current)) return
    salvar({ empId, tipo: oposto(c), datas: [c.dia.date] })
  }

  function irPara(novaData: string) {
    router.push(`/pessoas/escala-de-trabalho?data=${novaData}`, { scroll: false })
  }


  const foraDoQuadro = employees.filter((e) => !noQuadro.some((n) => n.id === e.id))

  function adicionar() {
    if (!foraDoQuadro.length) { toast.error(employees.length ? 'Todos os colaboradores já estão no quadro.' : 'Nenhum colaborador ativo para adicionar.'); return }
    setEditor({})
  }

  /** O que está na tela agora, pronto para os arquivos */
  const dadosExportacao = (): QuadroExport => ({
    empresa: company?.nome_fantasia || company?.razao_social || 'Empresa',
    rotulo: periodo.rotulo,
    corMarca: company?.cor_primaria || DEFAULT_BRAND_COLOR,
    geradoEm: new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date()),
    colunas,
    linhas: linhas.map((l) => ({ nome: l.emp.nome, cargo: l.emp.cargo, grupo: l.grupo, escala: descricaoPadrao(l.regra), folgas: l.folgas, celulas: l.celulas })),
  })
  const nomeArquivo = `escala-${inicio}-a-${fim}`

  async function exportar(tipo: string, gerar: () => Promise<void>) {
    setExportando(true)
    try {
      await toast.promise(gerar(), { loading: `Gerando o ${tipo}…`, success: `${tipo} baixado.`, error: `Não foi possível gerar o ${tipo}.` })
    } catch {
      // A mensagem de erro já apareceu
    }
    setExportando(false)
  }

  const exportarPDF = () => exportar('PDF', async () => {
    const [{ pdf }, { QuadroEscalaPdf }] = await Promise.all([import('@react-pdf/renderer'), import('./quadro-escala-pdf')])
    baixarArquivo(await pdf(<QuadroEscalaPdf company={company} q={dadosExportacao()} />).toBlob(), `${nomeArquivo}.pdf`)
  })

  const exportarExcel = () => exportar('Excel', () => gerarExcel(dadosExportacao(), nomeArquivo))

  const regrasDe = (id: string) => rules.filter((r) => r.employee_id === id)
  const escalaAtual = editor?.pessoa ? regraDoPeriodo(regrasDe(editor.pessoa.id), inicio, fim) : null
  const inicioSugerido = noPeriodoAtual ? hoje : inicio
  const inicioEscalaDe = (id: string) => regrasDe(id)[0]?.data_inicio ?? hoje

  const seta = 'w-9 h-9 rounded-lg flex items-center justify-center transition-colors hover:bg-gray-100'
  const botao = 'inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border text-sm font-medium transition-colors hover:bg-gray-50 shrink-0'
  const estiloBotao = { borderColor: 'var(--color-card-border)', color: 'var(--color-text-secondary)' }
  const borda = { borderColor: 'var(--color-card-border)' }
  const fundoColuna = (d: DayResult) => (d.feriado ? FERIADO_FUNDO : d.domingo ? DOMINGO_FUNDO : undefined)

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>Escala de Trabalho</h1>
        <Breadcrumb />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <SummaryCard icon="users" title="No quadro" value={noQuadro.length} caption={`de ${employees.length} ${employees.length === 1 ? 'colaborador' : 'colaboradores'}`} />
        <SummaryCard icon="calendar" title="Folgas" value={indicadores.folgas} caption="no mês" delay={60} />
        <SummaryCard icon="info" title="Fora da escala" value={indicadores.foraDaEscala} caption="dias diferentes do padrão" accent={indicadores.foraDaEscala > 0 ? 'yellow' : undefined} delay={120} />
      </div>

      <div className="app-card p-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1" style={{ color: 'var(--color-sidebar-text)' }}>
            <button type="button" onClick={() => irPara(periodo.anterior)} aria-label="Mês anterior" className={seta}><Icon name="chevron-left" size={18} /></button>
            <span className="min-w-36 px-1 text-center text-sm font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>{periodo.rotulo}</span>
            <button type="button" onClick={() => irPara(periodo.proximo)} aria-label="Próximo mês" className={seta}><Icon name="chevron-right" size={18} /></button>
            {!noPeriodoAtual && (
              <button type="button" onClick={() => irPara(hoje)} className="ml-1 text-sm font-semibold cursor-pointer hover:underline" style={{ color: 'var(--color-brand)' }}>Hoje</button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!readOnly && <button type="button" onClick={() => setGerirFeriados(true)} className={botao} style={estiloBotao}><Icon name="calendar" size={16} /> Feriados</button>}
            <button type="button" onClick={exportarPDF} disabled={exportando} className={`${botao} disabled:opacity-50`} style={estiloBotao}><Icon name="download" size={16} /> PDF</button>
            <button type="button" onClick={exportarExcel} disabled={exportando} className={`${botao} disabled:opacity-50`} style={estiloBotao}><Icon name="download" size={16} /> Excel</button>
            {!readOnly && <AddButton onClick={adicionar} label="Adicionar colaborador" />}
          </div>
        </div>

        {noQuadro.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <SearchField value={busca} onChange={setBusca} placeholder="Pesquisar por nome ou cargo..." />
            {busca && <FilterResult total={visiveis.length} onClear={() => setBusca('')} />}
          </div>
        )}

        <div className="rounded-xl border overflow-x-auto" style={borda}>
          <table className="w-full border-collapse text-sm select-none bg-white">
            <thead>
              <tr style={{ backgroundColor: 'var(--color-bg-surface)' }}>
                <th className="sticky left-0 z-10 text-left px-3 py-2 min-w-56" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
                  <span className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Pessoa</span>
                </th>
                {colunas.map((d) => (
                  <th key={d.date} title={d.feriado_nome ?? undefined} className="py-1.5 text-center min-w-8" style={{ backgroundColor: fundoColuna(d) }}>
                    <span className="block text-[10px] font-medium" style={{ color: 'var(--color-text-muted)' }}>{INICIAIS_SEMANA[diaDaSemana(d.date)]}</span>
                    <span
                      className="mx-auto w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold tabular-nums"
                      style={d.date === hoje ? { backgroundColor: 'var(--color-brand)', color: '#fff' } : { color: 'var(--color-text-secondary)' }}
                    >
                      {Number(d.date.slice(8))}
                    </span>
                  </th>
                ))}
                <th className="px-3 py-2 text-xs font-semibold text-center" style={{ color: 'var(--color-text-secondary)' }}>Folgas</th>
                {!readOnly && <th className="w-10" />}
              </tr>
            </thead>

            <tbody>
              {linhas.length === 0 && (
                <tr><td colSpan={colunas.length + 3} className="text-center py-10" style={{ color: 'var(--color-text-muted)' }}>
                  {noQuadro.length ? 'Nenhuma pessoa encontrada.' : readOnly ? 'Você ainda não tem escala neste mês.' : 'Ninguém no quadro neste mês. Use Adicionar colaborador para começar.'}
                </td></tr>
              )}
              {linhas.map(({ emp, celulas, regra, folgas, grupo }, n) => (
                <Fragment key={emp.id}>
                {grupo !== linhas[n - 1]?.grupo && (
                  <tr className="border-t" style={{ ...borda, backgroundColor: 'var(--color-brand-light)' }}>
                    <td colSpan={colunas.length + 3} className="px-3 py-1.5">
                      <span className="sticky left-3 text-xs font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>
                        {grupo}
                        <span className="font-medium ml-2">{linhas.filter((l) => l.grupo === grupo).length} {linhas.filter((l) => l.grupo === grupo).length === 1 ? 'pessoa' : 'pessoas'}</span>
                      </span>
                    </td>
                  </tr>
                )}
                <tr className="border-t" style={borda}>
                  <td className="sticky left-0 z-10 bg-white px-3 py-1.5">
                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={() => setEditor({ pessoa: { id: emp.id, nome: emp.nome } })}
                      className={`min-w-0 text-left ${readOnly ? 'cursor-default' : 'cursor-pointer group'}`}
                    >
                      <span className="block text-sm font-bold truncate max-w-48 group-hover:underline" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>{emp.nome}</span>
                      <span className="block text-[11px] truncate max-w-48" style={{ color: 'var(--color-text-muted)' }}>{descricaoPadrao(regra)}</span>
                    </button>
                  </td>
                  {celulas.map((c) => {
                    const { texto, estilo } = estiloCelula(c)
                    const descricao = `${fmtDia(c.dia.date)}: ${descricaoCelula(c)}${c.dia.feriado_nome ? ` (${c.dia.feriado_nome})` : ''}`
                    return (
                      <td key={c.dia.date} className="p-0.5 text-center" style={{ backgroundColor: fundoColuna(c.dia) }}>
                        <button
                          type="button"
                          disabled={!c.editavel}
                          title={descricao}
                          aria-label={`${emp.nome}, ${descricao}`}
                          onPointerDown={(e) => iniciarArraste(e, emp.id, c)}
                          onPointerEnter={() => continuarArraste(emp.id, c)}
                          onClick={(e) => clicar(e, emp.id, c)}
                          className={`w-full rounded flex flex-col items-center justify-center font-bold transition-colors h-8 text-xs ${c.editavel ? 'cursor-pointer hover:ring-1 hover:ring-[var(--color-brand)]' : 'cursor-default'}`}
                          style={estilo}
                        >
                          {texto}
                        </button>
                      </td>
                    )
                  })}
                  <td className="px-3 text-center text-sm font-semibold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>{folgas}</td>
                  {!readOnly && (
                    <td className="px-1">
                      <ActionMenu
                        label={`Ações de ${emp.nome}`}
                        items={[
                          { icon: 'pencil', label: 'Editar escala', onClick: () => setEditor({ pessoa: { id: emp.id, nome: emp.nome } }) },
                          { icon: 'trash', label: 'Remover do quadro', tone: 'danger', onClick: () => setRemover({ id: emp.id, nome: emp.nome }) },
                        ]}
                      />
                    </td>
                  )}
                </tr>
                </Fragment>
              ))}
            </tbody>

            {linhas.length > 1 && (
              <tfoot>
                <tr className="border-t" style={{ ...borda, backgroundColor: 'var(--color-bg-surface)' }}>
                  <td className="sticky left-0 z-10 px-3 py-1.5 text-xs font-semibold" style={{ backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-secondary)' }}>Trabalhando</td>
                  {colunas.map((d, i) => {
                    const total = linhas.filter((l) => l.celulas[i]?.tipo === 'trabalho').length
                    return <td key={d.date} className="text-center text-xs font-semibold tabular-nums" style={{ color: total === 0 ? 'var(--color-error)' : 'var(--color-text-secondary)' }}>{total}</td>
                  })}
                  <td />
                  {!readOnly && <td />}
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <Legenda />
        {!readOnly && (
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Clique em um dia para alternar entre folga e trabalho, ou arraste para marcar vários. Clique no nome da pessoa para editar a escala.
          </p>
        )}
      </div>

      {editor && (
        <ModalPadrao
          companyId={companyId}
          disponiveis={editor.pessoa ? undefined : foraDoQuadro}
          pessoa={editor.pessoa}
          atual={escalaAtual}
          inicioSugerido={inicioSugerido}
          onClose={() => setEditor(null)}
          onSalvo={() => { setEditor(null); setOtimista({}) }}
        />
      )}

      {gerirFeriados && <ModalFeriados companyId={companyId} feriados={feriados} anoInicial={Number(inicio.slice(0, 4))} onClose={() => setGerirFeriados(false)} />}

      {remover && (
        <ModalRemoverEscala
          companyId={companyId}
          pessoa={remover}
          inicioEscala={inicioEscalaDe(remover.id)}
          hoje={hoje}
          onClose={() => setRemover(null)}
          onRemovida={() => { setRemover(null); setOtimista({}) }}
        />
      )}
    </>
  )
}
