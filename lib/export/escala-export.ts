import type { WorkSchedule } from '@/app/(app)/pessoas/escala-de-trabalho/queries'

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DIAS_SEMANA = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado']

const TURNO_LABELS: Record<string, string> = {
  manha: 'Manhã',
  tarde: 'Tarde',
  noite: 'Noite',
  custom: 'Personalizado',
}

function formatTime(t: string | null) {
  if (!t) return ''
  return t.slice(0, 5)
}

function diaSemana(dateStr: string) {
  return DIAS_SEMANA[new Date(dateStr + 'T00:00:00').getDay()]
}

// ── PDF: Lista ────────────────────────────────────────────────────────────────
export async function exportListaPDF(schedules: WorkSchedule[], mes: number, ano: number) {
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

  // Cabeçalho da tabela
  const headers = ['Funcionário', 'Data', 'Dia', 'Turno', 'Entrada', 'Saída']
  const colWidths = [60, 25, 25, 30, 20, 20]
  const colX = colWidths.reduce<number[]>((acc, w, i) => {
    acc.push(i === 0 ? 14 : acc[i - 1] + colWidths[i - 1])
    return acc
  }, [])

  let y = 30
  const rowH = 7

  // Header row
  doc.setFillColor(245, 245, 245)
  doc.rect(14, y, colWidths.reduce((a, b) => a + b, 0), rowH, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  headers.forEach((h, i) => doc.text(h, colX[i] + 2, y + 5))
  y += rowH

  // Data rows
  doc.setFont('helvetica', 'normal')
  const sorted = [...schedules].sort((a, b) => a.data.localeCompare(b.data))
  sorted.forEach((s, idx) => {
    if (y > 190) {
      doc.addPage()
      y = 16
    }
    if (idx % 2 === 0) {
      doc.setFillColor(252, 252, 252)
      doc.rect(14, y, colWidths.reduce((a, b) => a + b, 0), rowH, 'F')
    }
    const [yr, mo, day] = s.data.split('-')
    const row = [
      s.employee.nome,
      `${day}/${mo}/${yr}`,
      diaSemana(s.data),
      TURNO_LABELS[s.turno ?? ''] ?? s.turno ?? '—',
      formatTime(s.hora_inicio),
      formatTime(s.hora_fim),
    ]
    row.forEach((cell, i) => doc.text(String(cell), colX[i] + 2, y + 5))
    y += rowH
  })

  // Linha final
  doc.setDrawColor(220)
  doc.line(14, y, 14 + colWidths.reduce((a, b) => a + b, 0), y)

  doc.save(`escala-lista-${ano}-${String(mes).padStart(2, '0')}.pdf`)
}

// ── PDF: Calendário (captura DOM) ─────────────────────────────────────────────
export async function exportCalendarioPDF(element: HTMLElement, mes: number, ano: number) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ])

  const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
  const imgData = canvas.toDataURL('image/png')

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 10

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(`Escala de Trabalho — ${MESES[mes - 1]} ${ano}`, margin, margin + 4)

  const imgW = pageW - margin * 2
  const imgH = (canvas.height * imgW) / canvas.width
  const maxH = pageH - margin * 2 - 14
  const finalH = Math.min(imgH, maxH)

  doc.addImage(imgData, 'PNG', margin, margin + 10, imgW, finalH)
  doc.save(`escala-calendario-${ano}-${String(mes).padStart(2, '0')}.pdf`)
}

// ── Excel ─────────────────────────────────────────────────────────────────────
export async function exportExcel(schedules: WorkSchedule[], mes: number, ano: number) {
  const { utils, writeFile } = await import('xlsx')

  const sorted = [...schedules].sort((a, b) => a.data.localeCompare(b.data))

  const rows = sorted.map(s => {
    const [yr, mo, day] = s.data.split('-')
    return {
      Funcionário: s.employee.nome,
      Data: `${day}/${mo}/${yr}`,
      'Dia da Semana': diaSemana(s.data),
      Turno: TURNO_LABELS[s.turno ?? ''] ?? s.turno ?? '',
      Entrada: formatTime(s.hora_inicio),
      Saída: formatTime(s.hora_fim),
    }
  })

  const ws = utils.json_to_sheet(rows)

  // Larguras das colunas
  ws['!cols'] = [{ wch: 30 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 10 }]

  const wb = utils.book_new()
  utils.book_append_sheet(wb, ws, `${MESES[mes - 1]} ${ano}`)

  writeFile(wb, `escala-${ano}-${String(mes).padStart(2, '0')}.xlsx`)
}
