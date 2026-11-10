import type { Workbook, Worksheet, Cell, Fill } from 'exceljs'
import type { DayResult } from '@/lib/escala/generate'

// Exportações do quadro de folgas. O PDF fica em components/quadro-escala-pdf.tsx; a planilha, aqui.

export type CelulaExport = { dia: DayResult; tipo: DayResult['tipo']; foraDaEscala: boolean }
export type LinhaExport = {
  nome: string
  cargo: string | null
  /** Nome da escala (6x1, 7x7...): as linhas chegam ordenadas por ele */
  grupo: string
  /** Horário e validade */
  escala: string
  folgas: number
  celulas: CelulaExport[]
}
export type QuadroExport = {
  empresa: string
  rotulo: string
  corMarca: string
  geradoEm: string
  colunas: DayResult[]
  linhas: LinhaExport[]
}

export const SEMANA_CURTA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const SEMANA_LONGA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

export const CORES_ESCALA = { feriado: '#EBF5FB', feriadoForte: '#2471A3', domingo: '#F7F7F7', foraFundo: '#FEF3C7', foraTexto: '#B45309' }

export const diaDaSemana = (data: string) => new Date(`${data}T00:00:00`).getDay()
export const fmtDia = (data: string) => `${data.slice(8)}/${data.slice(5, 7)}`
export const hhmm = (t: string | null | undefined) => t?.slice(0, 5) ?? ''

/** O que aparece na célula do dia, igual nos dois arquivos */
export function textoCelula(c: CelulaExport): string {
  if (c.tipo === 'sem_regra') return '—'
  if (c.tipo === 'folga') return 'F'
  return c.foraDaEscala ? 'T' : '·'
}

/** Quantas pessoas estão em cada escala */
export const totalDoGrupo = (linhas: LinhaExport[], grupo: string) => linhas.filter((l) => l.grupo === grupo).length
export const rotuloGrupo = (linhas: LinhaExport[], grupo: string) => {
  const n = totalDoGrupo(linhas, grupo)
  return `${grupo} · ${n} ${n === 1 ? 'pessoa' : 'pessoas'}`
}

export const feriadosDoPeriodo = (colunas: DayResult[]) => colunas.filter((d) => d.feriado)

const argb = (hex: string) => `FF${hex.replace('#', '').toUpperCase()}`
const preencher = (hex: string): Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: argb(hex) } })
const CINZA_BORDA = { style: 'thin' as const, color: { argb: 'FFE5E7EB' } }
const BORDA = { top: CINZA_BORDA, left: CINZA_BORDA, bottom: CINZA_BORDA, right: CINZA_BORDA }
const ESCURO = '#1F2937'
const SUPERFICIE = '#F3F4F6'

function titulo(ws: Worksheet, q: QuadroExport, subtitulo: string, colunas: number) {
  ws.mergeCells(1, 1, 1, colunas)
  ws.mergeCells(2, 1, 2, colunas)
  const a = ws.getCell(1, 1)
  a.value = q.empresa
  a.font = { name: 'Calibri', size: 14, bold: true, color: { argb: argb(q.corMarca) } }
  const b = ws.getCell(2, 1)
  b.value = subtitulo
  b.font = { name: 'Calibri', size: 11, color: { argb: 'FF4B5563' } }
  ws.getRow(1).height = 22
}

function cabecalho(cell: Cell, cor = ESCURO) {
  cell.fill = preencher(cor)
  cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
  cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  cell.border = BORDA
}

function folhaQuadro(wb: Workbook, q: QuadroExport) {
  const ws = wb.addWorksheet('Quadro', {
    views: [{ state: 'frozen', xSplit: 2, ySplit: 4, showGridLines: false }],
    pageSetup: { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  })
  const total = q.colunas.length + 3
  const colFolgas = total
  titulo(ws, q, `Escala de Trabalho — ${q.rotulo}`, total)

  ws.getColumn(1).width = 32
  ws.getColumn(2).width = 26
  q.colunas.forEach((_, i) => { ws.getColumn(i + 3).width = 5.5 })
  ws.getColumn(colFolgas).width = 9

  // Títulos
  const HEADER = 4
  ws.getRow(HEADER).height = 32
  ws.getCell(HEADER, 1).value = 'Pessoa'
  ws.getCell(HEADER, 2).value = 'Horário'
  q.colunas.forEach((d, i) => {
    const c = ws.getCell(HEADER, i + 3)
    c.value = `${SEMANA_CURTA[diaDaSemana(d.date)]}\n${d.date.slice(8)}`
    if (d.feriado_nome) c.note = d.feriado_nome
    cabecalho(c, d.feriado ? CORES_ESCALA.feriadoForte : ESCURO)
  })
  ws.getCell(HEADER, colFolgas).value = 'Folgas'
  for (const col of [1, 2, colFolgas]) cabecalho(ws.getCell(HEADER, col))
  ws.getCell(HEADER, 1).alignment = { horizontal: 'left', vertical: 'middle' }
  ws.getCell(HEADER, 2).alignment = { horizontal: 'left', vertical: 'middle' }

  // Pessoas
  let r = HEADER
  q.linhas.forEach((l, n) => {
    if (l.grupo !== q.linhas[n - 1]?.grupo) {
      r++
      ws.mergeCells(r, 1, r, total)
      const grupo = ws.getCell(r, 1)
      grupo.value = rotuloGrupo(q.linhas, l.grupo)
      grupo.fill = preencher(SUPERFICIE)
      grupo.font = { name: 'Calibri', size: 10, bold: true, color: { argb: argb(q.corMarca) } }
      grupo.alignment = { vertical: 'middle' }
      grupo.border = BORDA
      ws.getRow(r).height = 20
    }
    r++
    ws.getRow(r).height = 20
    const nome = ws.getCell(r, 1)
    nome.value = l.nome
    nome.font = { name: 'Calibri', size: 10, bold: true }
    nome.alignment = { vertical: 'middle', wrapText: true }
    nome.border = BORDA
    const escala = ws.getCell(r, 2)
    escala.value = l.escala
    escala.font = { name: 'Calibri', size: 9, color: { argb: 'FF4B5563' } }
    escala.alignment = { vertical: 'middle' }
    escala.border = BORDA

    l.celulas.forEach((c, i) => {
      const cel = ws.getCell(r, i + 3)
      cel.value = textoCelula(c)
      cel.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
      cel.border = BORDA
      cel.font = { name: 'Calibri', size: 10, bold: c.tipo === 'folga' || c.foraDaEscala, color: { argb: 'FF4B5563' } }
      if (c.foraDaEscala) {
        cel.fill = preencher(CORES_ESCALA.foraFundo)
        cel.font = { ...cel.font, color: { argb: argb(CORES_ESCALA.foraTexto) } }
      } else if (c.tipo === 'folga') {
        cel.fill = preencher(q.corMarca)
        cel.font = { ...cel.font, color: { argb: 'FFFFFFFF' } }
      } else if (c.dia.feriado) cel.fill = preencher(CORES_ESCALA.feriado)
      else if (c.dia.domingo) cel.fill = preencher(CORES_ESCALA.domingo)
    })

    const folgas = ws.getCell(r, colFolgas)
    folgas.value = l.folgas
    folgas.font = { name: 'Calibri', size: 10, bold: true }
    folgas.alignment = { horizontal: 'center', vertical: 'middle' }
    folgas.border = BORDA
  })

  // Total por dia
  const TOTAL = r + 1
  ws.mergeCells(TOTAL, 1, TOTAL, 2)
  const rotulo = ws.getCell(TOTAL, 1)
  rotulo.value = 'Trabalhando'
  q.colunas.forEach((_, i) => {
    ws.getCell(TOTAL, i + 3).value = q.linhas.filter((l) => l.celulas[i]?.tipo === 'trabalho').length
  })
  for (let col = 1; col <= total; col++) {
    const c = ws.getCell(TOTAL, col)
    c.fill = preencher(SUPERFICIE)
    c.font = { name: 'Calibri', size: 10, bold: true }
    c.alignment = { horizontal: col === 1 ? 'left' : 'center', vertical: 'middle' }
    c.border = BORDA
  }

  // Legenda e feriados
  let linha = TOTAL + 2
  const legenda: [string, string, string, string][] = [
    ['F', q.corMarca, '#FFFFFF', 'Folga'],
    ['F', CORES_ESCALA.foraFundo, CORES_ESCALA.foraTexto, 'Folga fora da escala'],
    ['T', CORES_ESCALA.foraFundo, CORES_ESCALA.foraTexto, 'Trabalho fora da escala'],
    ['', CORES_ESCALA.feriado, ESCURO, 'Feriado'],
  ]
  for (const [marca, fundo, cor, texto] of legenda) {
    const c = ws.getCell(linha, 1)
    c.value = marca ? `${marca}  —  ${texto}` : texto
    c.fill = preencher(fundo)
    c.font = { name: 'Calibri', size: 9, bold: true, color: { argb: argb(cor) } }
    linha++
  }
  const feriados = feriadosDoPeriodo(q.colunas)
  if (feriados.length) {
    linha++
    ws.getCell(linha, 1).value = 'Feriados no período'
    ws.getCell(linha, 1).font = { name: 'Calibri', size: 10, bold: true }
    for (const f of feriados) {
      linha++
      ws.getCell(linha, 1).value = `${fmtDia(f.date)} · ${f.feriado_nome ?? 'Feriado'}`
      ws.getCell(linha, 1).font = { name: 'Calibri', size: 9, color: { argb: 'FF4B5563' } }
    }
  }
  linha += 2
  ws.getCell(linha, 1).value = `Gerado em ${q.geradoEm}`
  ws.getCell(linha, 1).font = { name: 'Calibri', size: 8, color: { argb: 'FF9CA3AF' } }
}

function folhaDias(wb: Workbook, q: QuadroExport) {
  const ws = wb.addWorksheet('Dias de trabalho', {
    views: [{ state: 'frozen', ySplit: 4, showGridLines: false }],
    pageSetup: { orientation: 'portrait', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  })
  const titulos = ['Funcionário', 'Cargo', 'Data', 'Dia', 'Entrada', 'Almoço', 'Saída', 'Feriado', 'Escala', 'Situação']
  titulo(ws, q, `Dias de trabalho — ${q.rotulo}`, titulos.length)
  ;[32, 24, 12, 12, 10, 16, 10, 24, 20, 18].forEach((w, i) => { ws.getColumn(i + 1).width = w })

  const HEADER = 4
  ws.getRow(HEADER).height = 22
  titulos.forEach((t, i) => {
    const c = ws.getCell(HEADER, i + 1)
    c.value = t
    cabecalho(c)
  })

  const dias = q.linhas
    .flatMap((l) => l.celulas.filter((c) => c.tipo === 'trabalho').map((c) => ({ l, c })))
    .sort((a, b) => a.c.dia.date.localeCompare(b.c.dia.date) || a.l.nome.localeCompare(b.l.nome))

  dias.forEach(({ l, c }, n) => {
    const d = c.dia
    const [ano, mes, dia] = d.date.split('-')
    const almoco = d.hora_almoco_inicio && d.hora_almoco_fim ? `${hhmm(d.hora_almoco_inicio)}–${hhmm(d.hora_almoco_fim)}` : ''
    const r = HEADER + 1 + n
    const valores = [l.nome, l.cargo ?? '', `${dia}/${mes}/${ano}`, SEMANA_LONGA[diaDaSemana(d.date)], hhmm(d.hora_entrada), almoco, hhmm(d.hora_saida), d.feriado ? d.feriado_nome ?? 'Sim' : '', l.grupo, c.foraDaEscala ? 'Fora da escala' : 'Na escala']
    valores.forEach((v, i) => {
      const cel = ws.getCell(r, i + 1)
      cel.value = v
      cel.border = BORDA
      cel.font = { name: 'Calibri', size: 10, bold: i === 0 }
      cel.alignment = { vertical: 'middle', horizontal: i >= 2 && i <= 6 ? 'center' : 'left' }
      if (c.foraDaEscala) { cel.fill = preencher(CORES_ESCALA.foraFundo); cel.font = { ...cel.font, color: { argb: argb(CORES_ESCALA.foraTexto) } } }
      else if (d.feriado) cel.fill = preencher(CORES_ESCALA.feriado)
      else if (n % 2 === 1) cel.fill = preencher('#F9FAFB')
    })
  })
  if (dias.length) ws.autoFilter = { from: { row: HEADER, column: 1 }, to: { row: HEADER + dias.length, column: titulos.length } }
}

/** Monta a planilha: o quadro colorido e a lista dos dias de trabalho */
export async function montarPlanilha(q: QuadroExport): Promise<Workbook> {
  const modulo = await import('exceljs')
  // O pacote chega com ou sem "default", conforme o empacotador
  const ExcelJS = (modulo as unknown as { default?: typeof modulo }).default ?? modulo
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Casa Empresarial'
  folhaQuadro(wb, q)
  folhaDias(wb, q)
  return wb
}

export function baixarArquivo(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  a.click()
  URL.revokeObjectURL(url)
}

export async function exportarExcel(q: QuadroExport, arquivo: string) {
  const wb = await montarPlanilha(q)
  const dados = await wb.xlsx.writeBuffer()
  baixarArquivo(new Blob([dados], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${arquivo}.xlsx`)
}
