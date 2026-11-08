// Regras do registro de ponto usadas no servidor e na tela

/** Tempo mínimo entre uma batida e outra, para evitar registros repetidos */
export const INTERVALO_MINUTOS = 10

/** Minutos que faltam para a próxima batida (0 = liberado). Recebe os horários já batidos no dia. */
export function minutosDeEspera(batidas: (string | null | undefined)[], agora: Date): number {
  const ultima = Math.max(0, ...batidas.filter((b): b is string => !!b).map((b) => Date.parse(b)))
  if (!ultima) return 0
  const faltam = ultima + INTERVALO_MINUTOS * 60_000 - agora.getTime()
  return faltam > 0 ? Math.ceil(faltam / 60_000) : 0
}
