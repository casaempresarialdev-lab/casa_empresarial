import type { LocalBatida } from '@/lib/ponto'

export function LinkMapa({ lat, lng, texto }: { lat: number; lng: number; texto?: string | null }) {
  return (
    <a href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noreferrer" className="hover:underline break-words" style={{ color: 'var(--color-brand)' }}>
      {texto || `${lat.toFixed(5)}, ${lng.toFixed(5)}`}
    </a>
  )
}

/** Endereço com link para o mapa ou o motivo de não haver localização */
export function TextoLocal({ local }: { local: LocalBatida }) {
  if (local.lat == null || local.lng == null) return <>{local.falha === 'negada' ? 'Localização não autorizada' : 'Localização indisponível'}</>
  return <><LinkMapa lat={local.lat} lng={local.lng} texto={local.endereco} />{local.precisao != null && ` (±${local.precisao} m)`}</>
}
