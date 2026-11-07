import { z } from 'zod'
import { CAMPOS_EXAME } from './admissao'

// ── Início ───────────────────────────────────────────────────────────────────

export const iniciarRescisaoSchema = z.object({
  tipo: z.enum(['pedido_demissao', 'sem_justa_causa', 'justa_causa', 'acordo', 'termino_contrato'], { message: 'Escolha o tipo de desligamento' }),
  motivo: z.string().trim().max(1000, 'Use até 1.000 caracteres'),
})

export type IniciarRescisaoInput = z.infer<typeof iniciarRescisaoSchema>

// ── Aviso prévio ─────────────────────────────────────────────────────────────

export const avisoPrevioSchema = z.object({
  modalidade: z.enum(['trabalhado', 'indenizado', 'dispensado'], { message: 'Escolha a modalidade do aviso' }),
  comunicacao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data da comunicação'),
  dias: z.string().regex(/^\d{1,3}$/, 'Informe os dias').refine((v) => Number(v) >= 0 && Number(v) <= 120, 'Informe de 0 a 120 dias'),
  ultimo_dia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe o último dia de trabalho'),
}).superRefine((d, ctx) => {
  if (d.ultimo_dia < d.comunicacao) ctx.addIssue({ code: 'custom', path: ['ultimo_dia'], message: 'O último dia não pode ser antes da comunicação' })
})

export type AvisoPrevioInput = z.infer<typeof avisoPrevioSchema>

// ── Exame demissional ────────────────────────────────────────────────────────

export const EXAME_DEMISSIONAL_ASSUNTO_PADRAO = 'Exame demissional: {empresa}'

export const EXAME_DEMISSIONAL_MODELO_PADRAO = `Olá, {nome}.

Você foi encaminhado para o exame demissional.

Clínica: {clinica}
Endereço: {endereco}
Telefone: {telefone_clinica}
Quando: {data_exame}

Orientações:
{orientacoes}

Atenciosamente,
{empresa}`

/** Mesmos campos do e-mail do exame admissional, sem os da vaga */
export const CAMPOS_EXAME_DEMISSIONAL = CAMPOS_EXAME.filter((c) => c.campo !== 'vaga')

/** Retorno do exame: data e ASO (opcional), com o resultado e as observações */
export const retornoExameSchema = z.object({
  resultado: z.enum(['apto', 'inapto'], { message: 'Escolha o resultado' }),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data do exame'),
  observacoes: z.string().trim().max(1000, 'Use até 1.000 caracteres'),
})

export type RetornoExameInput = z.infer<typeof retornoExameSchema>

// ── Configurações ────────────────────────────────────────────────────────────

export const configRescisaoSchema = z.object({
  exame_notificar: z.boolean(),
  exame_assunto: z.string().trim().min(1, 'Informe o assunto').max(200, 'Use até 200 caracteres'),
  exame_modelo: z.string().trim().min(1, 'Escreva o texto do e-mail').max(10000, 'Use até 10.000 caracteres'),
})

export type ConfigRescisaoInput = z.infer<typeof configRescisaoSchema>
