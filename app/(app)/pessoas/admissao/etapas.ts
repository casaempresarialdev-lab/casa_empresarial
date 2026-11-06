// Etapas do kanban de admissão: fixas e nesta ordem. O nome diz a ação a fazer.
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
/** Etapa seguinte à carta: para onde o card vai quando o candidato termina de preencher os dados */
export const ETAPA_APOS_CARTA: EtapaKey = 'encaminhar_exame'
export const ETAPA_EXAME: EtapaKey = 'encaminhar_exame'
export const ETAPA_RESULTADO_EXAME: EtapaKey = 'registrar_resultado_exame'
/** Apto no exame: para onde o card vai */
export const ETAPA_POS_EXAME: EtapaKey = 'enviar_contabilidade'
export const ETAPA_CONTABILIDADE: EtapaKey = 'enviar_contabilidade'
export const ETAPA_AGUARDAR_CONTABILIDADE: EtapaKey = 'aguardar_contabilidade'
export const ETAPA_CONTRATO: EtapaKey = 'assinar_contrato'
/** Admissão sem vaga: quem é contratado direto não passa por entrevista */
export const ETAPA_SEM_VAGA: EtapaKey = ETAPA_CARTA
export const ETAPA_FINAL: EtapaKey = 'finalizado'

export const isEtapa = (v: unknown): v is EtapaKey => ETAPAS.some((e) => e.key === v)
