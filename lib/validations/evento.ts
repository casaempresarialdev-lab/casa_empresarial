import { z } from 'zod'

// Eventos do calendário (pessoais do usuário). Aviso opcional antes do horário.

// Antecedência do aviso, em minutos (0 = no horário)
export const ANTECEDENCIAS = [
  { value: 0,    label: 'No horário' },
  { value: 5,    label: '5 minutos antes' },
  { value: 15,   label: '15 minutos antes' },
  { value: 30,   label: '30 minutos antes' },
  { value: 60,   label: '1 hora antes' },
  { value: 1440, label: '1 dia antes' },
] as const

// Duração do evento: digitada em horas e minutos (HH:MM), guardada em minutos (término = início + duração)
const pad = (n: number) => String(n).padStart(2, '0')
/** 90 → "01:30" (valor do campo) */
export const duracaoParaCampo = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`
/** "01:30" → 90 */
export const duracaoDoCampo = (v: string) => { const [h, m] = v.split(':').map(Number); return h * 60 + m }
/** 90 → "1h30"; 45 → "45 min"; 120 → "2h" */
export const formatarDuracao = (min: number) => {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (!h) return `${m} min`
  return m ? `${h}h${pad(m)}` : `${h}h`
}

export const RECORRENCIAS = [
  { value: 'nenhuma', label: 'Não se repete' },
  { value: 'diaria',  label: 'Todos os dias' },
  { value: 'semanal', label: 'Toda semana' },
  { value: 'mensal',  label: 'Todo mês' },
] as const

/** Limite de ocorrências geradas por série (ex.: diária por 1 ano) */
export const MAX_OCORRENCIAS = 366

const recorrencia = z.enum(['nenhuma', 'diaria', 'semanal', 'mensal'])
const linkValido = (v: string) => { try { return ['http:', 'https:'].includes(new URL(v).protocol) } catch { return false } }

export const eventoSchema = z.object({
  titulo: z.string().trim().min(1, 'Informe o título').max(120),
  descricao: z.string().max(1000).optional(),
  /** Data e hora em ISO (convertidas do fuso do usuário no navegador) */
  data_hora: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Informe a data e a hora'),
  duracao_min: z.number().int().min(5).max(1440),
  notificar: z.boolean(),
  antecedencia_min: z.number().int().min(0).max(10080),
  notificar_email: z.boolean(),
  /** Endereço (presencial) e/ou link (online); os dois = híbrido */
  local: z.string().trim().max(300).optional(),
  link_reuniao: z.string().trim().max(500).optional().refine((v) => !v || linkValido(v), 'Informe um link válido (https://…)'),
  recorrencia,
  /** Último dia da repetição (YYYY-MM-DD) */
  recorrencia_ate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  /** E-mails dos convidados (usuários do sistema) */
  convidados: z.array(z.string().trim().toLowerCase().email()).max(50),
}).refine((d) => d.recorrencia === 'nenhuma' || !!d.recorrencia_ate, { message: 'Informe até quando o evento se repete', path: ['recorrencia_ate'] })

export type EventoData = z.infer<typeof eventoSchema>

// Formulário da tela: data e hora em campos separados (juntados no fuso do usuário antes de enviar)
export const eventoFormSchema = z.object({
  titulo: z.string().trim().min(1, 'Informe o título').max(120),
  descricao: z.string().max(1000).optional(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data'),
  hora: z.string().regex(/^\d{2}:\d{2}$/, 'Informe a hora'),
  // Horas e minutos (HH:MM): de 5 min a 24h
  duracao: z.string()
    .regex(/^\d{1,2}:\d{2}$/, 'Informe a duração (hh:mm)')
    .refine((v) => { const [h, m] = v.split(':').map(Number); return m < 60 && h * 60 + m >= 5 && h * 60 + m <= 1440 }, 'Entre 00:05 e 24:00'),
  notificar: z.boolean(),
  antecedencia_min: z.number().int().min(0),
  notificar_email: z.boolean(),
  local: z.string().max(300).optional(),
  link_reuniao: z.string().max(500).optional(),
  recorrencia,
  recorrencia_ate: z.string().optional(),
}).superRefine((d, ctx) => {
  if (d.link_reuniao?.trim() && !linkValido(d.link_reuniao.trim())) {
    ctx.addIssue({ code: 'custom', message: 'Informe um link válido (https://…)', path: ['link_reuniao'] })
  }
  if (d.recorrencia !== 'nenhuma') {
    if (!d.recorrencia_ate) ctx.addIssue({ code: 'custom', message: 'Informe até quando', path: ['recorrencia_ate'] })
    else if (d.recorrencia_ate < d.data) ctx.addIssue({ code: 'custom', message: 'Deve ser depois do início', path: ['recorrencia_ate'] })
  }
})

export type EventoFormData = z.infer<typeof eventoFormSchema>
