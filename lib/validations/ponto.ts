import { z } from 'zod'

const hora = z.string().regex(/^(\d{2}:\d{2})?$/, 'Hora inválida')

export const CAMPOS_PONTO = ['entrada', 'saida_almoco', 'retorno_almoco', 'saida'] as const
export type CampoPonto = (typeof CAMPOS_PONTO)[number]

export const ROTULOS_PONTO: Record<CampoPonto, string> = {
  entrada: 'Entrada',
  saida_almoco: 'Saída almoço',
  retorno_almoco: 'Retorno almoço',
  saida: 'Saída',
}

export const ajustePontoSchema = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
  entrada: hora,
  saida_almoco: hora,
  retorno_almoco: hora,
  saida: hora,
  motivo: z.string().trim().min(3, 'Informe o motivo do ajuste').max(500, 'Use até 500 caracteres'),
}).superRefine((d, ctx) => {
  const preenchidos = CAMPOS_PONTO.filter((c) => d[c])
  if (!preenchidos.length) ctx.addIssue({ code: 'custom', path: ['entrada'], message: 'Informe ao menos um horário' })
  for (let i = 1; i < preenchidos.length; i++) {
    if (d[preenchidos[i]] <= d[preenchidos[i - 1]]) {
      ctx.addIssue({ code: 'custom', path: [preenchidos[i]], message: `${ROTULOS_PONTO[preenchidos[i]]} precisa ser depois de ${ROTULOS_PONTO[preenchidos[i - 1]].toLowerCase()}` })
    }
  }
})

export type AjustePontoInput = z.infer<typeof ajustePontoSchema>

/** "2026-11-08" + "08:30" → horário de Brasília (sem o offset, o Postgres assumiria UTC) */
export const horaParaTimestamp = (data: string, h: string) => (h ? `${data}T${h}:00-03:00` : null)

const FORMATO_HORA = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })

/** Horário gravado → "08:30" */
export const horaDe = (ts: string | null | undefined) => (ts ? FORMATO_HORA.format(new Date(ts)) : '')
