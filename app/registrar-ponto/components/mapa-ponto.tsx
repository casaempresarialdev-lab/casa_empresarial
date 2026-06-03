'use client'

import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import type { LatLngExpression } from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Corrige ícone padrão do Leaflet que quebra no bundler
import L from 'leaflet'
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView([lat, lng], 17)
  }, [lat, lng, map])
  return null
}

interface Props {
  lat: number
  lng: number
}

export function MapaPonto({ lat, lng }: Props) {
  const position: LatLngExpression = [lat, lng]

  return (
    <MapContainer
      center={position}
      zoom={17}
      scrollWheelZoom={false}
      style={{ height: '160px', width: '100%', borderRadius: '12px' }}
      attributionControl={false}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OpenStreetMap'
      />
      <Marker position={position} />
      <Recenter lat={lat} lng={lng} />
    </MapContainer>
  )
}
