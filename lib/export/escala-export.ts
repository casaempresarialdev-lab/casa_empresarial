import type { DayResult } from '@/lib/escala/generate'

const MESES     = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DIAS_FULL = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado']

type ExportRow = DayResult & { employeeName: string }

function formatTime(t: string | null) {
  if (!t) return ''
  return t.slice(0, 5)
}

function diaSemana(dateStr: string) {
  return DIAS_FULL[new Date(dateStr + 'T00:00:00').getDay()]
}

// ── PDF: Lista ────────────────────────────────────────────────────────────────
export async function exportListaPDF(rows: ExportRow[], mes: number, ano: number) {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  const title = `Escala de Trabalho — ${MESES[mes - 1]} ${ano}`
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.text(title, 14, 16)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(120)
  doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')}`, 14, 22)
  doc.setTextColor(0)

  const headers   = ['Funcionário', 'Data', 'Dia', 'Entrada', 'Almoço', 'Saída']
  const colWidths = [60, 25, 25, 22, 35, 22]
  const colX      = colWidths.reduce<number[]>((acc, w, i) => {
    acc.push(i === 0 ? 14 : acc[i - 1] + colWidths[i - 1])
    return acc
  }, [])

  let y      = 30
  const rowH = 7
  const totalW = colWidths.reduce((a, b) => a + b, 0)

  doc.setFillColor(245, 245, 245)
  doc.rect(14, y, totalW, rowH, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  headers.forEach((h, i) => doc.text(h, colX[i] + 2, y + 5))
  y += rowH

  doc.setFont('helvetica', 'normal')
  rows.forEach((r, idx) => {
    if (y > 190) { doc.addPage(); y = 16 }
    if (idx % 2 === 0) {
      doc.setFillColor(252, 252, 252)
      doc.rect(14, y, totalW, rowH, 'F')
    }
    const [yr, mo, day] = r.date.split('-')
    const almoco = r.hora_almoco_inicio && r.hora_almoco_fim
      ? `${formatTime(r.hora_almoco_inicio)}–${formatTime(r.hora_almoco_fim)}`
      : '—'
    const row = [
      r.employeeName,
      `${day}/${mo}/${yr}`,
      diaSemana(r.date),
      formatTime(r.hora_entrada) || '—',
      almoco,
      formatTime(r.hora_saida) || '—',
    ]
    row.forEach((cell, i) => doc.text(String(cell), colX[i] + 2, y + 5))
    y += rowH
  })

  doc.setDrawColor(220)
  doc.line(14, y, 14 + totalW, y)

  doc.save(`escala-lista-${ano}-${String(mes).padStart(2, '0')}.pdf`)
}

// ── PDF: Calendário (captura DOM) ─────────────────────────────────────────────
export async function exportCalendarioPDF(element: HTMLElement, mes: number, ano: number) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ])

  const canvas  = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
  const imgData = canvas.toDataURL('image/png')

  const doc    = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageW  = doc.internal.pageSize.getWidth()
  const pageH  = doc.internal.pageSize.getHeight()
  const margin = 10

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(`Escala de Trabalho — ${MESES[mes - 1]} ${ano}`, margin, margin + 4)

  const imgW   = pageW - margin * 2
  const imgH   = (canvas.height * imgW) / canvas.width
  const maxH   = pageH - margin * 2 - 14
  const finalH = Math.min(imgH, maxH)

  doc.addImage(imgData, 'PNG', margin, margin + 10, imgW, finalH)
  doc.save(`escala-calendario-${ano}-${String(mes).padStart(2, '0')}.pdf`)
}

// ── Excel ─────────────────────────────────────────────────────────────────────
export async function exportExcel(rows: ExportRow[], mes: number, ano: number) {
  const { utils, writeFile } = await import('xlsx')

  const data = rows.map(r => {
    const [yr, mo, day] = r.date.split('-')
    const almoco = r.hora_almoco_inicio && r.hora_almoco_fim
      ? `${formatTime(r.hora_almoco_inicio)}–${formatTime(r.hora_almoco_fim)}`
      : ''
    return {
      Funcionário:     r.employeeName,
      Data:            `${day}/${mo}/${yr}`,
      'Dia da Semana': diaSemana(r.date),
      Entrada:         formatTime(r.hora_entrada),
      Almoço:          almoco,
      Saída:           formatTime(r.hora_saida),
      Feriado:         r.feriado ? (r.feriado_nome ?? 'Sim') : '',
    }
  })

  const ws = utils.json_to_sheet(data)
  ws['!cols'] = [{ wch: 30 }, { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 18 }, { wch: 10 }, { wch: 22 }]

  const wb = utils.book_new()
  utils.book_append_sheet(wb, ws, `${MESES[mes - 1]} ${ano}`)
  writeFile(wb, `escala-${ano}-${String(mes).padStart(2, '0')}.xlsx`)
}
