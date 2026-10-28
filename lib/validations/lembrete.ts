import { z } from 'zod'

// Antecedência do aviso, em minutos (0 = no horário)
export const ANTECEDENCIAS = [
  { value: 0,    label: 'No horário' },
  { value: 5,    label: '5 minutos antes' },
  { value: 15,   label: '15 minutos antes' },
  { value: 30,   label: '30 minutos antes' },
  { value: 60,   label: '1 hora antes' },
  { value: 1440, label: '1 dia antes' },
] as const

export const lembreteSchema = z.object({
  titulo: z.string().trim().min(1, 'Informe o título').max(120),
  descricao: z.string().max(1000).optional(),
  /** Data e hora em ISO (convertidas do fuso do usuário no navegador) */
  data_hora: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Informe a data e a hora'),
  notificar: z.boolean(),
  antecedencia_min: z.number().int().min(0).max(10080),
  notificar_email: z.boolean(),
})

export type LembreteData = z.infer<typeof lembreteSchema>

// Formulário da tela: data e hora em campos separados (juntados no fuso do usuário antes de enviar)
export const lembreteFormSchema = z.object({
  titulo: z.string().trim().min(1, 'Informe o título').max(120),
  descricao: z.string().max(1000).optional(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data'),
  hora: z.string().regex(/^\d{2}:\d{2}$/, 'Informe a hora'),
  notificar: z.boolean(),
  antecedencia_min: z.number().int().min(0), // o select envia número (valueAsNumber)
  notificar_email: z.boolean(),
})

export type LembreteFormData = z.infer<typeof lembreteFormSchema>
