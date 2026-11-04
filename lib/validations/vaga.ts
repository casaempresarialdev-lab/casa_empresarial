import { z } from 'zod'
import { isValidCpf } from './auth'

export const TIPOS_CONTRATO = ['clt', 'estagio', 'menor_aprendiz', 'pj', 'autonomo'] as const

export const vagaSchema = z.object({
  titulo: z.string().trim().min(1, 'Informe o título da vaga').max(120, 'Use até 120 caracteres'),
  descricao: z.string().trim().max(5000, 'Use até 5.000 caracteres'),
  cargo: z.string().trim().max(120, 'Use até 120 caracteres'),
  departamento: z.string().trim().max(120, 'Use até 120 caracteres'),
  local_trabalho: z.string().trim().max(160, 'Use até 160 caracteres'),
  tipo_contrato: z.enum(TIPOS_CONTRATO, { message: 'Selecione a forma de contratação' }),
  salario: z.string().trim().regex(/^(\d{1,3}(\.\d{3})*|\d+)([.,]\d{1,2})?$|^$/, 'Informe um valor válido, como 2.500,00'),
  exibir_salario: z.boolean(),
  posicoes: z.string().regex(/^[1-9]\d{0,3}$/, 'Informe ao menos 1 posição'),
  data_limite: z.string().regex(/^\d{4}-\d{2}-\d{2}$|^$/, 'Informe uma data válida'),
  benefit_ids: z.array(z.string().uuid()),
})

export type VagaInput = z.infer<typeof vagaSchema>

// Formulário público de candidatura
export const candidaturaSchema = z.object({
  nome: z.string().trim().min(3, 'Informe o nome completo').max(160, 'Use até 160 caracteres')
    .refine((v) => v.split(/\s+/).length >= 2, 'Informe o nome completo'),
  cpf: z.string().refine((v) => {
    const d = v.replace(/\D/g, '')
    return d.length === 11 && isValidCpf(d)
  }, 'Informe um CPF válido'),
  email: z.string().trim().toLowerCase().email('Informe um e-mail válido').max(200, 'E-mail muito longo'),
  telefone: z.string().refine((v) => /^\d{10,11}$/.test(v.replace(/\D/g, '')), 'Informe o telefone com DDD'),
  aceite: z.boolean().refine((v) => v, 'É preciso aceitar para enviar a candidatura'),
  // Campo escondido: só robôs preenchem
  site: z.string().optional(),
})

export type CandidaturaInput = z.infer<typeof candidaturaSchema>

// Anexo da candidatura: formatos aceitos (o tipo gravado vem desta lista, não do navegador)
export const ANEXO_MAX_BYTES = 10 * 1024 * 1024
export const ANEXO_TIPOS: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}
export const ANEXO_ACCEPT = Object.keys(ANEXO_TIPOS).map((e) => `.${e}`).join(',')

export function extensaoAnexo(nome: string) {
  const ext = nome.split('.').pop()?.toLowerCase() ?? ''
  return ext in ANEXO_TIPOS ? ext : null
}
