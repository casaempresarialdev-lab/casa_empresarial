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

// ── Reprovação ───────────────────────────────────────────────────────────────

export const REPROVACAO_ASSUNTO_PADRAO = 'Retorno do seu processo seletivo: {empresa}'

export const REPROVACAO_MODELO_PADRAO = `Olá, {nome}.

Agradecemos o seu interesse na vaga {vaga} e o tempo dedicado ao nosso processo seletivo.

Depois de avaliar as candidaturas, decidimos não seguir com a sua neste momento.

Desejamos sucesso na sua trajetória profissional.

Atenciosamente,
{empresa}`

/** Campos disponíveis no e-mail de reprovação */
export const CAMPOS_REPROVACAO = CAMPOS_CARTA.filter((c) => (['nome', 'empresa', 'vaga', 'cargo'] as string[]).includes(c.campo))

// ── Exame admissional ────────────────────────────────────────────────────────

export const EXAME_ASSUNTO_PADRAO = 'Exame admissional: {empresa}'

export const EXAME_MODELO_PADRAO = `Olá, {nome}.

Você foi encaminhado para o exame admissional da {empresa}.

Clínica: {clinica}
Endereço: {endereco}
Telefone: {telefone_clinica}
Quando: {data_exame}

Orientações:
{orientacoes}

Atenciosamente,
{empresa}`

/** Campos disponíveis no e-mail de encaminhamento para o exame */
export const CAMPOS_EXAME = [
  ...CAMPOS_REPROVACAO,
  { campo: 'clinica', descricao: 'Nome da clínica' },
  { campo: 'endereco', descricao: 'Endereço da clínica' },
  { campo: 'telefone_clinica', descricao: 'Telefone da clínica' },
  { campo: 'data_exame', descricao: 'Data e hora do exame' },
  { campo: 'orientacoes', descricao: 'Orientações' },
] as const

type CampoModelo = CampoCarta | (typeof CAMPOS_EXAME)[number]['campo']
const CAMPOS_CONHECIDOS = new Set<string>([...CAMPOS_CARTA, ...CAMPOS_EXAME].map((c) => c.campo))

/** Troca os campos {nome}, {cargo}… pelos valores; os vazios viram "A combinar" */
export function preencherModelo(modelo: string, valores: Partial<Record<CampoModelo, string>>) {
  return modelo.replace(/\{(\w+)\}/g, (original, campo: string) => {
    if (!CAMPOS_CONHECIDOS.has(campo)) return original
    return valores[campo as CampoModelo]?.trim() || 'A combinar'
  })
}

export const clinicaSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome da clínica').max(120, 'Use até 120 caracteres'),
  endereco: z.string().trim().max(300, 'Use até 300 caracteres'),
  telefone: z.string().trim().max(30, 'Use até 30 caracteres'),
  orientacoes: z.string().trim().max(2000, 'Use até 2.000 caracteres'),
})

export type ClinicaInput = z.infer<typeof clinicaSchema>

/** Encaminhamento: data e hora juntas, ou nenhuma das duas (ordem de chegada) */
export const exameSchema = z.object({
  clinic_id: z.string().uuid('Escolha a clínica'),
  data: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Data inválida'),
  hora: z.string().regex(/^(\d{2}:\d{2})?$/, 'Hora inválida'),
  orientacoes: z.string().trim().max(2000, 'Use até 2.000 caracteres'),
}).superRefine((d, ctx) => {
  if (d.data && !d.hora) ctx.addIssue({ code: 'custom', path: ['hora'], message: 'Informe a hora, ou deixe a data em branco' })
  if (d.hora && !d.data) ctx.addIssue({ code: 'custom', path: ['data'], message: 'Informe a data, ou deixe a hora em branco' })
})

export type ExameInput = z.infer<typeof exameSchema>

// ── Resultado do exame ───────────────────────────────────────────────────────

export const EXAME_REPROVACAO_ASSUNTO_PADRAO = 'Resultado do exame admissional: {empresa}'

export const EXAME_REPROVACAO_MODELO_PADRAO = `Olá, {nome}.

Agradecemos a sua participação no processo de admissão para a vaga {vaga}.

O resultado do exame admissional não permitiu seguir com a sua contratação neste momento.

Desejamos sucesso na sua trajetória profissional.

Atenciosamente,
{empresa}`

/** Inapto: novo exame (volta para o encaminhamento) ou reprovação */
export const resultadoExameSchema = z.object({
  resultado: z.enum(['apto', 'inapto'], { message: 'Escolha o resultado' }),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data do exame'),
  observacoes: z.string().trim().max(1000, 'Use até 1.000 caracteres'),
  decisao: z.enum(['novo_exame', 'reprovar']).optional(),
}).superRefine((d, ctx) => {
  if (d.resultado === 'inapto' && !d.decisao) ctx.addIssue({ code: 'custom', path: ['decisao'], message: 'Escolha o que fazer com o candidato' })
})

export type ResultadoExameInput = z.infer<typeof resultadoExameSchema>

/** Contrato assinado: PDF ou imagem, até 20 MB */
export const CONTRATO_MAX_BYTES = 20 * 1024 * 1024

/** ASO: PDF ou imagem, até 10 MB */
export const ASO_MAX_BYTES = 10 * 1024 * 1024

/** Guias de encaminhamento: PDF ou imagem, até 4 MB (vai anexada no e-mail) */
export const GUIA_TIPOS = ['application/pdf', 'image/jpeg', 'image/png']
export const GUIA_MAX_BYTES = 4 * 1024 * 1024

export const configAdmissaoSchema = z.object({
  carta_validade_dias: z.string().regex(/^\d{1,2}$/, 'Informe de 1 a 60 dias').refine((v) => Number(v) >= 1 && Number(v) <= 60, 'Informe de 1 a 60 dias'),
  carta_assunto: z.string().trim().min(1, 'Informe o assunto').max(200, 'Use até 200 caracteres'),
  carta_modelo: z.string().trim().min(1, 'Escreva o modelo da carta').max(10000, 'Use até 10.000 caracteres'),
  reprovacao_notificar: z.boolean(),
  reprovacao_assunto: z.string().trim().min(1, 'Informe o assunto').max(200, 'Use até 200 caracteres'),
  reprovacao_modelo: z.string().trim().min(1, 'Escreva o texto do e-mail').max(10000, 'Use até 10.000 caracteres'),
  exame_notificar: z.boolean(),
  exame_assunto: z.string().trim().min(1, 'Informe o assunto').max(200, 'Use até 200 caracteres'),
  exame_modelo: z.string().trim().min(1, 'Escreva o texto do e-mail').max(10000, 'Use até 10.000 caracteres'),
  exame_reprovacao_notificar: z.boolean(),
  exame_reprovacao_assunto: z.string().trim().min(1, 'Informe o assunto').max(200, 'Use até 200 caracteres'),
  exame_reprovacao_modelo: z.string().trim().min(1, 'Escreva o texto do e-mail').max(10000, 'Use até 10.000 caracteres'),
})

export type ConfigAdmissaoInput = z.infer<typeof configAdmissaoSchema>

export const cartaSchema = z.object({
  /** Cargo da Estrutura */
  position_id: z.string().uuid().or(z.literal('')).optional(),
  cargo: z.string().trim().min(1, 'Informe o cargo').max(120, 'Use até 120 caracteres'),
  salario: z.string().trim()
    .min(1, 'Informe a remuneração')
    .regex(/^(\d{1,3}(\.\d{3})*|\d+)([.,]\d{1,2})?$/, 'Informe um valor válido, como 2.500,00')
    .refine((v) => Number(v.replace(/\./g, '').replace(',', '.')) > 0, 'Informe a remuneração'),
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
