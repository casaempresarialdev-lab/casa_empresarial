import { z } from 'zod'
import { CAMPOS_FOLHA, type CampoFolha } from '@/lib/folha/calculo'

const valor = z.number().min(0, 'Informe um valor positivo').max(9_999_999, 'Valor muito alto').optional()

export const conferenciaFolhaSchema = z.object({
  valores: z.object(Object.fromEntries(CAMPOS_FOLHA.map((c) => [c, valor])) as Record<CampoFolha, typeof valor>),
  observacao: z.string().trim().max(1000, 'Use até 1000 caracteres').nullable(),
})

export type ConferenciaFolhaInput = z.infer<typeof conferenciaFolhaSchema>
