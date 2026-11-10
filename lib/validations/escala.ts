import { z } from 'zod'

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida')
const hora = z.string().regex(/^\d{2}:\d{2}$/, 'Hora inválida')

/** Padrão de folgas e horário, aplicado a uma ou mais pessoas */
export const padraoEscalaSchema = z.object({
  employee_ids: z.array(z.string().uuid()).min(1, 'Selecione ao menos uma pessoa'),
  data_inicio: data,
  /** Último dia da escala; sem data, não expira */
  data_fim: data.nullable().optional(),
  /** Ao editar um ciclo sem mudar os dias: mantém a contagem original */
  data_referencia: data.nullable().optional(),
  tipo_escala: z.enum(['semanal', 'ciclo']),
  dias_folga: z.array(z.number().int().min(0).max(6)),
  ciclo_trabalho_dias: z.number().int().min(1).max(60).nullable(),
  ciclo_folga_dias: z.number().int().min(1).max(60).nullable(),
  hora_entrada: hora,
  hora_saida: hora,
  hora_almoco_inicio: hora.nullable(),
  hora_almoco_fim: hora.nullable(),
}).superRefine((d, ctx) => {
  if (d.tipo_escala === 'ciclo' && (!d.ciclo_trabalho_dias || !d.ciclo_folga_dias)) {
    ctx.addIssue({ code: 'custom', path: ['ciclo_trabalho_dias'], message: 'Informe quantos dias trabalha e quantos folga' })
  }
  if (!!d.hora_almoco_inicio !== !!d.hora_almoco_fim) {
    ctx.addIssue({ code: 'custom', path: ['hora_almoco_inicio'], message: 'Informe o início e o fim do almoço, ou deixe os dois em branco' })
  }
  if (d.data_fim && d.data_fim < d.data_inicio) {
    ctx.addIssue({ code: 'custom', path: ['data_fim'], message: 'A data de expiração precisa ser igual ou depois do início' })
  }
  if (d.hora_entrada === d.hora_saida) {
    ctx.addIssue({ code: 'custom', path: ['hora_saida'], message: 'A saída precisa ser diferente da entrada' })
  }
})

export type PadraoEscalaInput = z.infer<typeof padraoEscalaSchema>

/** Feriado acrescentado pela empresa */
export const feriadoSchema = z.object({
  data,
  nome: z.string().trim().min(2, 'Informe o nome do feriado').max(80, 'Use até 80 caracteres'),
  recorrente: z.boolean(),
})

/** Encerra a escala de uma pessoa a partir de uma data */
export const removerEscalaSchema = z.object({
  employee_id: z.string().uuid(),
  a_partir_de: data,
})

/** Marca dias de uma pessoa como folga ou trabalho */
export const diasEscalaSchema = z.object({
  employee_id: z.string().uuid(),
  datas: z.array(data).min(1).max(62),
  tipo: z.enum(['folga', 'trabalho']),
})
