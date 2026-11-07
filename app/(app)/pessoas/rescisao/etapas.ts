// Etapas do kanban de rescisão. Mesmo motor da admissão (lib/etapas-processo.ts): as padrão têm ordem fixa e
// o nome diz a ação a fazer; a empresa escolhe quais usa e pode incluir etapas próprias.
import {
  montarEtapasDe, paraSalvarDe, primeiraEtapaDe, proximaEtapaDe, temEtapaAtiva as temAtiva,
  type DefProcesso, type Etapa,
} from '@/lib/etapas-processo'

export { indiceEtapa, isPersonalizada, labelEtapa, type Etapa } from '@/lib/etapas-processo'

export const ETAPAS_RESCISAO = [
  { key: 'registrar_aviso_previo', label: 'Registrar aviso prévio' },
  { key: 'encaminhar_exame_demissional', label: 'Encaminhar para exame demissional' },
  { key: 'registrar_retorno_exame', label: 'Registrar retorno do exame' },
  { key: 'enviar_contabilidade', label: 'Enviar para contabilidade' },
  { key: 'aguardar_contabilidade', label: 'Aguardando contabilidade' },
  { key: 'assinar_trct', label: 'Assinar TRCT' },
  { key: 'finalizado', label: 'Finalizado' },
] as const

export type EtapaRescisaoKey = (typeof ETAPAS_RESCISAO)[number]['key']

export const R_AVISO: EtapaRescisaoKey = 'registrar_aviso_previo'
export const R_EXAME: EtapaRescisaoKey = 'encaminhar_exame_demissional'
export const R_RETORNO_EXAME: EtapaRescisaoKey = 'registrar_retorno_exame'
export const R_CONTABILIDADE: EtapaRescisaoKey = 'enviar_contabilidade'
export const R_AGUARDAR_CONTABILIDADE: EtapaRescisaoKey = 'aguardar_contabilidade'
export const R_TRCT: EtapaRescisaoKey = 'assinar_trct'
export const R_FINAL: EtapaRescisaoKey = 'finalizado'

export const isEtapaRescisao = (v: unknown): v is EtapaRescisaoKey => ETAPAS_RESCISAO.some((e) => e.key === v)

export const DEF_RESCISAO: DefProcesso = {
  etapas: ETAPAS_RESCISAO,
  final: R_FINAL,
  vinculadaA: {
    [R_RETORNO_EXAME]: R_EXAME,
    [R_AGUARDAR_CONTABILIDADE]: R_CONTABILIDADE,
  },
  reserva: R_AVISO,
  descricao: {
    [R_AVISO]: 'Trabalhado, indenizado ou dispensado, com a data da comunicação e o último dia.',
    [R_EXAME]: 'Encaminhamento à clínica, com a guia. Ativa e inativa junto com o retorno. Não vale para PJ e autônomo.',
    [R_RETORNO_EXAME]: 'Retorno com o ASO demissional. Ativa e inativa junto com o encaminhamento.',
    [R_CONTABILIDADE]: 'Ficha em PDF para a contabilidade. Ativa e inativa junto com "Aguardando contabilidade".',
    [R_AGUARDAR_CONTABILIDADE]: 'Retorno da contabilidade. Ativa e inativa junto com "Enviar para contabilidade".',
    [R_TRCT]: 'TRCT assinado anexado e data do desligamento. Não vale para PJ e autônomo.',
    [R_FINAL]: 'A pessoa sai da Equipe: Demitido (ou Inativo, para PJ e autônomo).',
  },
}

/** PJ e autônomo não fazem exame demissional nem assinam TRCT: essas etapas são puladas para eles */
export const etapasPuladas = (pj: boolean): string[] => (pj ? [R_EXAME, R_RETORNO_EXAME, R_TRCT] : [])

export const temEtapaAtivaRescisao = (etapas: Etapa[]) => temAtiva(DEF_RESCISAO, etapas)
export const montarEtapasRescisao = (salvas: unknown) => montarEtapasDe(DEF_RESCISAO, salvas)
export const paraSalvarRescisao = (etapas: Etapa[]) => paraSalvarDe(DEF_RESCISAO, etapas)
export const primeiraEtapaRescisao = (etapas: Etapa[], pj: boolean) => primeiraEtapaDe(DEF_RESCISAO, etapas, etapasPuladas(pj))
export const proximaEtapaRescisao = (etapas: Etapa[], atual: string, pj: boolean) => proximaEtapaDe(DEF_RESCISAO, etapas, atual, etapasPuladas(pj))

// ── Tipos de desligamento e aviso prévio ─────────────────────────────────────

export const TIPOS_DESLIGAMENTO = [
  { value: 'pedido_demissao', label: 'Pedido de demissão' },
  { value: 'sem_justa_causa', label: 'Dispensa sem justa causa' },
  { value: 'justa_causa', label: 'Dispensa por justa causa' },
  { value: 'acordo', label: 'Acordo entre as partes (art. 484-A)' },
  { value: 'termino_contrato', label: 'Término de contrato' },
] as const

export type TipoDesligamento = (typeof TIPOS_DESLIGAMENTO)[number]['value']
export const tipoDesligamentoLabel = (v: string | null | undefined) => TIPOS_DESLIGAMENTO.find((t) => t.value === v)?.label ?? '—'

export const MODALIDADES_AVISO = [
  { value: 'trabalhado', label: 'Trabalhado (cumprido)' },
  { value: 'indenizado', label: 'Indenizado (não cumprido)' },
  { value: 'dispensado', label: 'Dispensado' },
] as const

export type ModalidadeAviso = (typeof MODALIDADES_AVISO)[number]['value']
export const modalidadeAvisoLabel = (v: string | null | undefined) => MODALIDADES_AVISO.find((m) => m.value === v)?.label ?? '—'

/** Dias de aviso prévio (Lei 12.506/2011): 30 + 3 por ano completo de casa, até 90 */
export function diasAvisoPrevio(dataAdmissao: string | null | undefined, dataComunicacao: string): number {
  if (!dataAdmissao) return 30
  const [ay, am, ad] = dataAdmissao.split('-').map(Number)
  const [cy, cm, cd] = dataComunicacao.split('-').map(Number)
  let anos = cy - ay
  if (cm < am || (cm === am && cd < ad)) anos--
  return Math.min(90, 30 + 3 * Math.max(0, anos))
}
