import { jsPDF } from 'jspdf'

/**
 * PDF da carta proposta aceita: o texto como o candidato leu e o registro do aceite (data, hora e IP).
 * Gerado no servidor, no momento do aceite, e guardado nos arquivos do funcionário.
 */
export function gerarCartaPdf(opcoes: {
  empresa: string
  candidato: string
  conteudo: string
  aceitaEm: string
  ip: string | null
}) {
  const { empresa, candidato, conteudo, aceitaEm, ip } = opcoes
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const margem = 56
  const largura = doc.internal.pageSize.getWidth() - margem * 2
  const fimDaPagina = doc.internal.pageSize.getHeight() - margem
  let y = margem

  function escrever(texto: string, tamanho: number, negrito = false, entrelinha = 1.45) {
    doc.setFont('helvetica', negrito ? 'bold' : 'normal')
    doc.setFontSize(tamanho)
    for (const linha of doc.splitTextToSize(texto, largura) as string[]) {
      if (y > fimDaPagina) { doc.addPage(); y = margem }
      doc.text(linha, margem, y)
      y += tamanho * entrelinha
    }
  }

  escrever(empresa, 13, true)
  y += 4
  escrever('Carta proposta', 18, true)
  y += 14
  escrever(conteudo, 11)
  y += 24

  if (y > fimDaPagina - 70) { doc.addPage(); y = margem }
  doc.setDrawColor(200)
  doc.line(margem, y, margem + largura, y)
  y += 20
  escrever('Registro do aceite', 10, true)
  escrever(`Aceita por ${candidato} em ${aceitaEm} (horário de Brasília)${ip ? `, a partir do IP ${ip}` : ''}.`, 10)

  return Buffer.from(doc.output('arraybuffer'))
}
