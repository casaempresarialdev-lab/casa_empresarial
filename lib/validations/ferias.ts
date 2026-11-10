import { z } from 'zod'

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data')

/** Pedido do colaborador ou programação da área de Pessoas; as regras da CLT ficam em lib/ferias/regras.ts */
export const feriasSchema = z.object({
  employee_id: z.string().uuid('Selecione o funcionário').optional(),
  periodo_inicio: data,
  data_inicio: data,
  dias: z.number('Informe os dias').int().min(1).max(30, 'Até 30 dias'),
  dias_abono: z.number().int().min(0).max(10, 'O abono vai até 10 dias'),
  observacao: z.string().trim().max(500, 'Use até 500 caracteres'),
})

export type FeriasInput = z.infer<typeof feriasSchema>

export const configFeriasSchema = z.object({
  ferias_solicitacao_ativa: z.boolean(),
  ferias_antecedencia_dias: z.number('Informe os dias').int('Informe os dias').min(0, 'Use de 0 a 120').max(120, 'Use de 0 a 120'),
  ferias_permite_fracionar: z.boolean(),
  ferias_permite_abono: z.boolean(),
})

export type ConfigFeriasInput = z.infer<typeof configFeriasSchema>
