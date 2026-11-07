// Etapas do kanban de admissão. As padrão têm ordem fixa e o nome diz a ação a fazer; cada empresa escolhe
// quais usa e pode incluir etapas próprias (controle interno, sem integração). Motor em lib/etapas-processo.ts.
import {
  montarEtapasDe, paraSalvarDe, primeiraEtapaDe, proximaEtapaDe, temEtapaAtiva as temAtiva,
  type DefProcesso, type Etapa,
} from '@/lib/etapas-processo'

export {
  ETAPA_LABEL_MAX, PREFIXO_PERSONALIZADA, indiceEtapa, isPersonalizada, labelEtapa,
  type Etapa, type EtapaSalva,
} from '@/lib/etapas-processo'

export const ETAPAS = [
  { key: 'realizar_entrevista', label: 'Realizar entrevista' },
  { key: 'enviar_carta_proposta', label: 'Enviar carta proposta' },
  { key: 'encaminhar_exame', label: 'Encaminhar para exame' },
  { key: 'registrar_resultado_exame', label: 'Registrar resultado do exame' },
  { key: 'enviar_contabilidade', label: 'Enviar para contabilidade' },
  { key: 'aguardar_contabilidade', label: 'Aguardando contabilidade' },
  { key: 'assinar_contrato', label: 'Assinar contrato' },
  { key: 'finalizado', label: 'Finalizado' },
] as const

export type EtapaKey = (typeof ETAPAS)[number]['key']

export const ETAPA_INICIAL: EtapaKey = 'realizar_entrevista'
export const ETAPA_CARTA: EtapaKey = 'enviar_carta_proposta'
export const ETAPA_EXAME: EtapaKey = 'encaminhar_exame'
export const ETAPA_RESULTADO_EXAME: EtapaKey = 'registrar_resultado_exame'
export const ETAPA_CONTABILIDADE: EtapaKey = 'enviar_contabilidade'
export const ETAPA_AGUARDAR_CONTABILIDADE: EtapaKey = 'aguardar_contabilidade'
export const ETAPA_CONTRATO: EtapaKey = 'assinar_contrato'
export const ETAPA_FINAL: EtapaKey = 'finalizado'

export const isEtapa = (v: unknown): v is EtapaKey => ETAPAS.some((e) => e.key === v)

export const DEF_ADMISSAO: DefProcesso = {
  etapas: ETAPAS,
  final: ETAPA_FINAL,
  vinculadaA: {
    [ETAPA_RESULTADO_EXAME]: ETAPA_EXAME,
    [ETAPA_AGUARDAR_CONTABILIDADE]: ETAPA_CONTABILIDADE,
  },
  reserva: ETAPA_CONTRATO,
  descricao: {
    [ETAPA_INICIAL]: 'Agenda da entrevista e aprovação. Só para quem vem de uma vaga.',
    [ETAPA_CARTA]: 'Carta proposta por e-mail, aceite e link para o candidato preencher os dados.',
    [ETAPA_EXAME]: 'Encaminhamento à clínica, com a guia. Ativa e inativa junto com o resultado do exame.',
    [ETAPA_RESULTADO_EXAME]: 'Resultado com o ASO. Ativa e inativa junto com "Encaminhar para exame".',
    [ETAPA_CONTABILIDADE]: 'Ficha em PDF para a contabilidade. Ativa e inativa junto com "Aguardando contabilidade".',
    [ETAPA_AGUARDAR_CONTABILIDADE]: 'Retorno da contabilidade. Ativa e inativa junto com "Enviar para contabilidade".',
    [ETAPA_CONTRATO]: 'Contrato assinado anexado e data de admissão.',
    [ETAPA_FINAL]: 'A pessoa entra na Equipe.',
  },
}

export const temEtapaAtiva = (etapas: Etapa[]) => temAtiva(DEF_ADMISSAO, etapas)
export const montarEtapas = (salvas: unknown) => montarEtapasDe(DEF_ADMISSAO, salvas)
export const paraSalvar = (etapas: Etapa[]) => paraSalvarDe(DEF_ADMISSAO, etapas)

/** Primeira etapa ativa. Sem vaga, a entrevista é pulada: quem é contratado direto não passa por ela. */
export const primeiraEtapa = (etapas: Etapa[], comVaga: boolean) => primeiraEtapaDe(DEF_ADMISSAO, etapas, comVaga ? [] : [ETAPA_INICIAL])

/** Próxima etapa ativa depois da atual; sem nenhuma, "Finalizado" (a admissão é concluída) */
export const proximaEtapa = (etapas: Etapa[], atual: string) => proximaEtapaDe(DEF_ADMISSAO, etapas, atual)
