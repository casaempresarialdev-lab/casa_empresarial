// Regras do registro de ponto usadas no servidor e na tela

/** Localização lida no aparelho no momento da batida */
export type LocalBatida = {
  lat: number | null
  lng: number | null
  /** Margem de erro, em metros */
  precisao: number | null
  endereco: string | null
  falha: 'negada' | 'indisponivel' | null
}

/** De onde a batida foi feita */
export type OrigemBatida = LocalBatida & {
  ip: string | null
  /** Horário original da batida */
  em: string
}

/** Uma batida do dia (time_records.batidas); sem origem, foi lançada à mão */
export type Batida = { em: string; origem?: OrigemBatida | null }

/** As batidas se alternam: 1ª entrada, 2ª saída, 3ª entrada... */
export const rotuloBatida = (indice: number) => (indice % 2 === 0 ? 'Entrada' : 'Saída')

/** Soma dos pares entrada/saída fechados; a última entrada sem saída não conta */
export function minutosTrabalhados(horarios: string[]): number {
  let total = 0
  for (let i = 0; i + 1 < horarios.length; i += 2) total += Math.round((Date.parse(horarios[i + 1]) - Date.parse(horarios[i])) / 60000)
  return Math.max(0, total)
}

/** Lista nova de horários, mantendo a batida original (com a origem) quando o horário não mudou */
export function mesclarBatidas(antigas: Batida[], novos: string[]): Batida[] {
  const minuto = (ts: string) => Math.floor(Date.parse(ts) / 60000)
  const restantes = [...antigas]
  return novos.map((em) => {
    const i = restantes.findIndex((b) => minuto(b.em) === minuto(em))
    return i >= 0 ? restantes.splice(i, 1)[0] : { em, origem: null }
  })
}

/** Quanto o envio espera pela localização; passou disso, registra sem ela */
const ESPERA_LOCAL_MS = 5000

export const semLocal = (falha: 'negada' | 'indisponivel'): LocalBatida => ({ lat: null, lng: null, precisao: null, endereco: null, falha })

async function enderecoDe(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, {
      headers: { 'Accept-Language': 'pt-BR' },
      signal: AbortSignal.timeout(3000),
    })
    const a = (await res.json())?.address
    return a ? [a.road ?? a.pedestrian, a.house_number, a.suburb ?? a.neighbourhood ?? a.city_district, a.city ?? a.town ?? a.village].filter(Boolean).join(', ') || null : null
  } catch {
    return null
  }
}

/** Lê a localização do aparelho (só no navegador). Nunca falha: sem localização, devolve o motivo. */
export function lerLocal(): Promise<LocalBatida> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(semLocal('indisponivel')); return }
    navigator.geolocation.getCurrentPosition(
      async ({ coords: { latitude: lat, longitude: lng, accuracy } }) => {
        resolve({ lat, lng, precisao: accuracy, endereco: await enderecoDe(lat, lng), falha: null })
      },
      (e) => resolve(semLocal(e.code === e.PERMISSION_DENIED ? 'negada' : 'indisponivel')),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    )
  })
}

/** Espera a leitura já iniciada, sem segurar o envio além do limite */
export function aguardarLocal(leitura: Promise<LocalBatida> | null): Promise<LocalBatida> {
  return Promise.race([
    leitura ?? Promise.resolve(semLocal('indisponivel')),
    new Promise<LocalBatida>((resolve) => setTimeout(() => resolve(semLocal('indisponivel')), ESPERA_LOCAL_MS)),
  ])
}

/** A localização vem do aparelho: no servidor, só guarda o que for válido */
export function limparLocal(l: LocalBatida | null | undefined): LocalBatida {
  if (!l || typeof l.lat !== 'number' || typeof l.lng !== 'number' || !(Math.abs(l.lat) <= 90) || !(Math.abs(l.lng) <= 180)) {
    return semLocal(l?.falha === 'negada' ? 'negada' : 'indisponivel')
  }
  return {
    lat: l.lat,
    lng: l.lng,
    precisao: typeof l.precisao === 'number' && l.precisao >= 0 ? Math.round(l.precisao) : null,
    endereco: typeof l.endereco === 'string' ? l.endereco.slice(0, 200) || null : null,
    falha: null,
  }
}

/** Tempo mínimo entre uma batida e outra, para evitar registros repetidos */
export const INTERVALO_MINUTOS = 10

/** Minutos que faltam para a próxima batida (0 = liberado). Recebe os horários já batidos no dia. */
export function minutosDeEspera(batidas: (string | null | undefined)[], agora: Date): number {
  const ultima = Math.max(0, ...batidas.filter((b): b is string => !!b).map((b) => Date.parse(b)))
  if (!ultima) return 0
  const faltam = ultima + INTERVALO_MINUTOS * 60_000 - agora.getTime()
  return faltam > 0 ? Math.ceil(faltam / 60_000) : 0
}
