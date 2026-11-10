import { z } from 'zod'
import { CAMPOS_FOLHA, type CampoFolha } from '@/lib/folha/calculo'

const valor = z.number().min(0, 'Informe um valor positivo').max(9_999_999, 'Valor muito alto').optional()

export const conferenciaFolhaSchema = z.object({
  valores: z.object(Object.fromEntries(CAMPOS_FOLHA.map((c) => [c, valor])) as Record<CampoFolha, typeof valor>),
  observacao: z.string().trim().max(1000, 'Use até 1000 caracteres').nullable(),
})

export type ConferenciaFolhaInput = z.infer<typeof conferenciaFolhaSchema>

const dia = z.number('Informe o dia').int('Informe o dia').min(1, 'Use um dia de 1 a 28').max(28, 'Use um dia de 1 a 28')
const percentual = z.number('Informe o percentual').min(0, 'Use de 0 a 200').max(200, 'Use de 0 a 200')
const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Informe a hora')

export const configFolhaSchema = z.object({
  modo_periodo: z.enum(['mes', 'corte']),
  dia_corte: dia.nullable(),
  pagamento_tipo: z.enum(['dia_util', 'dia_fixo']),
  pagamento_dia: dia,
  adiantamento_ativo: z.boolean(),
  adiantamento_dia: dia,
  adiantamento_percentual: z.number('Informe o percentual').min(0, 'Use de 0 a 100').max(100, 'Use de 0 a 100'),
  guias_dia: dia,
  beneficios_dia: dia.nullable(),
  he_percentual: percentual,
  he_feriado_percentual: percentual,
  he_domingo_percentual: percentual,
  tolerancia_minutos: z.number('Informe os minutos').int().min(0, 'Use de 0 a 60').max(60, 'Use de 0 a 60'),
  responsavel_calculo: z.enum(['sistema', 'contabilidade']),
  /** Na tela: não disponibilizar, gerado pelo sistema ou PDF da contabilidade (vira holerite_ativo + holerite_fonte) */
  holerite_modo: z.enum(['nao', 'sistema', 'arquivo']),
  dsr_reflexo_ativo: z.boolean(),
  dsr_desconta_falta: z.boolean(),
  noturno_ativo: z.boolean(),
  noturno_inicio: hora,
  noturno_fim: hora,
  noturno_percentual: percentual,
  noturno_hora_reduzida: z.boolean(),
  insalubridade_base: z.enum(['salario_minimo', 'salario_base']),
  salario_minimo: z.number('Informe o salário mínimo').min(1, 'Informe o salário mínimo').max(100_000, 'Valor muito alto'),
})
  .refine((d) => d.modo_periodo === 'mes' || d.dia_corte !== null, { path: ['dia_corte'], message: 'Informe o dia de corte' })
  .refine((d) => !d.noturno_ativo || d.noturno_inicio !== d.noturno_fim, { path: ['noturno_fim'], message: 'O fim precisa ser diferente do início' })

export type ConfigFolhaInput = z.infer<typeof configFolhaSchema>

export const ADICIONAIS_CARGO = ['nenhum', 'insalubridade_10', 'insalubridade_20', 'insalubridade_40', 'periculosidade'] as const
