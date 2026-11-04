import { z } from 'zod'

const linkValido = (v: string) => { try { return ['http:', 'https:'].includes(new URL(v).protocol) } catch { return false } }

export const DURACOES_ENTREVISTA = [
  { value: '30', label: '30 minutos' },
  { value: '45', label: '45 minutos' },
  { value: '60', label: '1 hora' },
  { value: '90', label: '1h30' },
  { value: '120', label: '2 horas' },
]

export const entrevistaSchema = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data'),
  hora: z.string().regex(/^\d{2}:\d{2}$/, 'Informe a hora'),
  duracao_min: z.enum(['30', '45', '60', '90', '120']),
  entrevistador_id: z.string().uuid('Escolha o entrevistador'),
  link_reuniao: z.string().trim().max(500).refine((v) => !v || linkValido(v), 'Informe um link válido (https://…)'),
})

export type EntrevistaInput = z.infer<typeof entrevistaSchema>

// ── Carta proposta ───────────────────────────────────────────────────────────

export const VALIDADE_PADRAO = 7

export const ASSUNTO_PADRAO = 'Carta proposta: {empresa}'

export const MODELO_PADRAO = `Olá, {nome}.

Temos a satisfação de convidar você para integrar a equipe da {empresa}, nas seguintes condições:

Cargo: {cargo}
Forma de contratação: {tipo_contrato}
Remuneração: {salario}
Benefícios: {beneficios}
Data de início: {data_inicio}
Local de trabalho: {local}

Esta proposta é válida até {validade}. Ao aceitar, você será direcionado para preencher seus dados e enviar os documentos da admissão.

Atenciosamente,
{empresa}`

/** Campos automáticos do modelo */
export const CAMPOS_CARTA = [
  { campo: 'nome', descricao: 'Nome do candidato' },
  { campo: 'empresa', descricao: 'Nome da empresa' },
  { campo: 'vaga', descricao: 'Título da vaga' },
  { campo: 'cargo', descricao: 'Cargo' },
  { campo: 'tipo_contrato', descricao: 'Forma de contratação' },
  { campo: 'salario', descricao: 'Remuneração' },
  { campo: 'beneficios', descricao: 'Benefícios' },
  { campo: 'data_inicio', descricao: 'Data de início' },
  { campo: 'local', descricao: 'Local de trabalho' },
  { campo: 'validade', descricao: 'Validade da proposta' },
] as const

type CampoCarta = (typeof CAMPOS_CARTA)[number]['campo']

/** Troca os campos {nome}, {cargo}… pelos valores; os vazios viram "A combinar" */
export function preencherModelo(modelo: string, valores: Partial<Record<CampoCarta, string>>) {
  return modelo.replace(/\{(\w+)\}/g, (original, campo: string) => {
    if (!CAMPOS_CARTA.some((c) => c.campo === campo)) return original
    return valores[campo as CampoCarta]?.trim() || 'A combinar'
  })
}

export const configAdmissaoSchema = z.object({
  carta_validade_dias: z.string().regex(/^\d{1,2}$/, 'Informe de 1 a 60 dias').refine((v) => Number(v) >= 1 && Number(v) <= 60, 'Informe de 1 a 60 dias'),
  carta_assunto: z.string().trim().min(1, 'Informe o assunto').max(200, 'Use até 200 caracteres'),
  carta_modelo: z.string().trim().min(1, 'Escreva o modelo da carta').max(10000, 'Use até 10.000 caracteres'),
})

export type ConfigAdmissaoInput = z.infer<typeof configAdmissaoSchema>

export const cartaSchema = z.object({
  cargo: z.string().trim().max(120, 'Use até 120 caracteres'),
  salario: z.string().trim().regex(/^(\d{1,3}(\.\d{3})*|\d+)([.,]\d{1,2})?$|^$/, 'Informe um valor válido, como 2.500,00'),
  beneficios: z.string().trim().max(1000, 'Use até 1.000 caracteres'),
  data_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data de início'),
  local_trabalho: z.string().trim().max(160, 'Use até 160 caracteres'),
  conteudo: z.string().trim().min(1, 'Escreva o texto da carta').max(10000, 'Use até 10.000 caracteres'),
})

export type CartaInput = z.infer<typeof cartaSchema>

/** Horário do Brasil (sem horário de verão): o mesmo em todas as telas e e-mails */
export const entrevistaParaIso = (data: string, hora: string) => new Date(`${data}T${hora}:00-03:00`).toISOString()

const FUSO = 'America/Sao_Paulo'
const formatoDataHora = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: FUSO })

/** "10/11/2026 às 14:30" */
export const fmtDataHora = (iso: string) => formatoDataHora.format(new Date(iso)).replace(', ', ' às ')

/** Campos do formulário a partir de uma data gravada */
export function isoParaCampos(iso: string) {
  const d = new Date(iso)
  return {
    data: new Intl.DateTimeFormat('en-CA', { timeZone: FUSO }).format(d),
    hora: new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: FUSO }).format(d),
  }
}
