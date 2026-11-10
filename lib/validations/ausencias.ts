import { z } from 'zod'

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data')

export const TIPOS_AUSENCIA = [
  { value: 'atestado', label: 'Atestado médico' },
  { value: 'acompanhamento', label: 'Acompanhamento médico' },
  { value: 'luto', label: 'Falecimento na família' },
  { value: 'casamento', label: 'Casamento' },
  { value: 'doacao_sangue', label: 'Doação de sangue' },
  { value: 'outro', label: 'Outra ausência' },
] as const

export type TipoAusencia = (typeof TIPOS_AUSENCIA)[number]['value']
export const rotuloAusencia = (t: string) => TIPOS_AUSENCIA.find((x) => x.value === t)?.label ?? 'Ausência'

export const MAX_DIAS_AUSENCIA = 180

export const ausenciaSchema = z.object({
  tipo: z.enum(['atestado', 'acompanhamento', 'luto', 'casamento', 'doacao_sangue', 'outro'], 'Escolha o tipo'),
  data_inicio: data,
  data_fim: data,
  motivo: z.string().trim().max(500, 'Use até 500 caracteres'),
})
  .refine((d) => d.data_fim >= d.data_inicio, { path: ['data_fim'], message: 'O fim precisa ser igual ou depois do início' })
  .refine((d) => d.tipo !== 'outro' || d.motivo.length >= 5, { path: ['motivo'], message: 'Explique na observação o motivo da ausência' })
