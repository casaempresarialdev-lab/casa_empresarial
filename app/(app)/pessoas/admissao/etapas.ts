// Etapas do kanban de admissão: fixas e nesta ordem. O nome diz a ação a fazer.
export const ETAPAS = [
  { key: 'realizar_entrevista', label: 'Realizar entrevista', color: '#818cf8' },
  { key: 'enviar_carta_proposta', label: 'Enviar carta proposta', color: '#fbbf24' },
  { key: 'encaminhar_exame', label: 'Encaminhar para exame', color: '#38bdf8' },
  { key: 'registrar_resultado_exame', label: 'Registrar resultado do exame', color: '#f97316' },
  { key: 'enviar_contabilidade', label: 'Enviar para contabilidade', color: '#a78bfa' },
  { key: 'assinar_contrato', label: 'Assinar contrato', color: '#34d399' },
  { key: 'finalizado', label: 'Finalizado', color: '#22c55e' },
] as const

export type EtapaKey = (typeof ETAPAS)[number]['key']

export const ETAPA_INICIAL: EtapaKey = 'realizar_entrevista'
export const ETAPA_CARTA: EtapaKey = 'enviar_carta_proposta'
/** Etapa seguinte à carta: para onde o card vai quando o candidato termina de preencher os dados */
export const ETAPA_APOS_CARTA: EtapaKey = 'encaminhar_exame'
/** Admissão sem vaga: quem é contratado direto não passa por entrevista */
export const ETAPA_SEM_VAGA: EtapaKey = ETAPA_CARTA
export const ETAPA_FINAL: EtapaKey = 'finalizado'

export const isEtapa = (v: unknown): v is EtapaKey => ETAPAS.some((e) => e.key === v)
