import { z } from 'zod'

/** Horários digitados de um dia ("08:00", "12:00"...), em ordem */
export const horariosSchema = z
  .array(z.string().regex(/^\d{2}:\d{2}$/, 'Hora inválida'))
  .max(100, 'Use até 100 registros por dia')
  .refine((h) => h.every((v, i) => i === 0 || v > h[i - 1]), 'Cada registro precisa ser depois do anterior')

export const ajustePontoSchema = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
  batidas: horariosSchema.refine((h) => h.length > 0, 'Informe ao menos um horário'),
  motivo: z.string().trim().min(3, 'Informe a observação do ajuste').max(500, 'Use até 500 caracteres'),
})

export type AjustePontoInput = z.infer<typeof ajustePontoSchema>

/** "2026-11-08" + "08:30" → horário de Brasília (sem o offset, o Postgres assumiria UTC) */
export const horaParaTimestamp = (data: string, h: string) => (h ? `${data}T${h}:00-03:00` : null)

const FORMATO_HORA = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })

/** Horário gravado → "08:30" */
export const horaDe = (ts: string | null | undefined) => (ts ? FORMATO_HORA.format(new Date(ts)) : '')

/** Batidas em pares: ["08:00–12:00", "13:00–--:--"] */
export function faixasDeHorario(horarios: string[]): string[] {
  const faixas: string[] = []
  for (let i = 0; i < horarios.length; i += 2) faixas.push(`${horaDe(horarios[i])}–${horaDe(horarios[i + 1]) || '--:--'}`)
  return faixas
}
