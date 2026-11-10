// Período do quadro de folgas: sempre um mês. As datas são "AAAA-MM-DD".

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

const paraData = (iso: string) => {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d))
}
const paraIso = (d: Date) => d.toISOString().slice(0, 10)

export function somarDias(iso: string, dias: number): string {
  const d = paraData(iso)
  d.setUTCDate(d.getUTCDate() + dias)
  return paraIso(d)
}

export type Periodo = {
  inicio: string
  fim: string
  /** Uma data dentro do mês anterior e uma dentro do próximo */
  anterior: string
  proximo: string
  rotulo: string
}

/** O mês que contém a data */
export function periodoDoMes(dataIso: string): Periodo {
  const d = paraData(dataIso)
  const inicio = paraIso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)))
  const fim = paraIso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)))
  return { inicio, fim, anterior: somarDias(inicio, -1), proximo: somarDias(fim, 1), rotulo: `${MESES[d.getUTCMonth()]} ${d.getUTCFullYear()}` }
}
