'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { registrarPontoAction, sairPontoAction } from '../actions'
import type { PontoSession } from '../actions'

const MapaPonto = dynamic(
  () => import('./mapa-ponto').then(m => m.MapaPonto),
  { ssr: false, loading: () => (
    <div className="rounded-xl flex items-center justify-center" style={{ height: 160, backgroundColor: 'var(--color-bg-surface)' }}>
      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Carregando mapa...</p>
    </div>
  )}
)

interface Props {
  session: PontoSession
  registroHoje: { id: string; entrada: string | null; saida: string | null; data: string } | null
}

function formatTime(ts: string | null) {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(d: Date) {
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function PortalPonto({ session, registroHoje }: Props) {
  const router    = useRouter()
  const [isPending, startTransition] = useTransition()

  const [now, setNow]                   = useState(new Date())
  const [lat, setLat]                   = useState<number | null>(null)
  const [lng, setLng]                   = useState<number | null>(null)
  const [endereco, setEndereco]         = useState<string | null>(null)
  const [geoStatus, setGeoStatus]       = useState<'loading' | 'ok' | 'denied' | 'idle'>('idle')
  const [registro, setRegistro]         = useState(registroHoje)
  const [feedback, setFeedback]         = useState<{ tipo: 'entrada' | 'saida'; hora: string } | null>(null)
  const [error, setError]               = useState('')
  const [loading, setLoading]           = useState(false)

  // Relógio em tempo real
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Geolocalização ao montar
  useEffect(() => {
    if (!navigator.geolocation) { setGeoStatus('denied'); return }
    setGeoStatus('loading')
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude, longitude } = pos.coords
        setLat(latitude)
        setLng(longitude)
        setGeoStatus('ok')
        // Geocoding reverso via Nominatim (OpenStreetMap — gratuito, sem API key)
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
            { headers: { 'Accept-Language': 'pt-BR' } }
          )
          const json = await res.json()
          const addr = json?.address
          if (addr) {
            const partes = [
              addr.road ?? addr.pedestrian,
              addr.house_number,
              addr.suburb ?? addr.neighbourhood ?? addr.city_district,
              addr.city ?? addr.town ?? addr.village,
            ].filter(Boolean)
            setEndereco(partes.join(', '))
          }
        } catch {
          // sem endereço — mostra coordenadas
          setEndereco(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`)
        }
      },
      () => setGeoStatus('denied'),
      { timeout: 10000 }
    )
  }, [])

  // Status: aberto = tem entrada mas não saída
  const temEntradaAberta  = !!registro?.entrada && !registro?.saida
  const temRegistroFechado = !!registro?.entrada && !!registro?.saida

  async function handleRegistrar() {
    setLoading(true)
    setError('')

    const result = await registrarPontoAction(
      session.employeeId,
      session.companyId,
      lat,
      lng,
      endereco,
    )

    setLoading(false)

    if ('error' in result) { setError(result.error); return }

    const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    setFeedback({ tipo: result.tipo, hora })

    // Recarrega dados do servidor após 2s
    setTimeout(() => {
      setFeedback(null)
      startTransition(() => router.refresh())
    }, 2500)
  }

  async function handleSair() {
    await sairPontoAction()
    router.push('/registrar-ponto')
  }

  const horaDisplay = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const dataDisplay = formatDate(now)

  const gmapsUrl = lat && lng
    ? `https://www.google.com/maps?q=${lat},${lng}`
    : null

  return (
    <div className="w-full max-w-sm space-y-4">

      {/* Feedback de sucesso */}
      {feedback && (
        <div className="fixed inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl p-8 text-center shadow-2xl max-w-xs mx-4">
            <div className="text-5xl mb-4">{feedback.tipo === 'entrada' ? '✅' : '👋'}</div>
            <p className="text-xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
              {feedback.tipo === 'entrada' ? 'Entrada registrada!' : 'Saída registrada!'}
            </p>
            <p className="text-3xl font-mono font-bold mt-2" style={{ color: 'var(--color-primary-darker)' }}>
              {feedback.hora}
            </p>
          </div>
        </div>
      )}

      {/* Card principal */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: '1px solid var(--color-bg-surface)' }}>

        {/* Header empresa */}
        <div className="px-5 py-4 text-center" style={{ backgroundColor: 'var(--color-primary)' }}>
          <p className="text-xs font-medium" style={{ color: 'var(--color-primary-darker)' }}>
            {session.companyName}
          </p>
        </div>

        <div className="px-5 py-5 space-y-4">
          {/* Colaborador */}
          <div className="text-center">
            <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-2"
              style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-darker)' }}>
              {session.employeeName.charAt(0).toUpperCase()}
            </div>
            <p className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{session.employeeName}</p>
          </div>

          {/* Relógio */}
          <div className="text-center">
            <p className="text-4xl font-mono font-bold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
              {horaDisplay}
            </p>
            <p className="text-xs mt-1 capitalize" style={{ color: 'var(--color-text-muted)' }}>
              {dataDisplay}
            </p>
          </div>

          {/* Status do ponto hoje */}
          <div className="rounded-xl p-3 text-sm" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
            {!registro && (
              <p className="text-center" style={{ color: 'var(--color-text-muted)' }}>Sem registro hoje</p>
            )}
            {temEntradaAberta && (
              <div className="flex justify-between">
                <span style={{ color: 'var(--color-text-secondary)' }}>Entrada</span>
                <span className="font-semibold" style={{ color: '#1E8449' }}>{formatTime(registro!.entrada)}</span>
              </div>
            )}
            {temRegistroFechado && (
              <>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--color-text-secondary)' }}>Entrada</span>
                  <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{formatTime(registro!.entrada)}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span style={{ color: 'var(--color-text-secondary)' }}>Saída</span>
                  <span className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{formatTime(registro!.saida)}</span>
                </div>
              </>
            )}
          </div>

          {/* Localização */}
          <div>
            {geoStatus === 'loading' && (
              <p className="text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>
                📍 Obtendo localização...
              </p>
            )}
            {geoStatus === 'denied' && (
              <p className="text-xs text-center" style={{ color: '#D4AC0D' }}>
                ⚠️ Localização não autorizada — o ponto será registrado sem coordenadas.
              </p>
            )}
            {geoStatus === 'ok' && lat && lng && (
              <div className="space-y-2">
                <MapaPonto lat={lat} lng={lng} />
                {endereco && (
                  <div className="flex items-start gap-1.5">
                    <span className="text-xs mt-0.5">📍</span>
                    <div>
                      <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{endereco}</p>
                      {gmapsUrl && (
                        <a href={gmapsUrl} target="_blank" rel="noreferrer"
                          className="text-xs underline" style={{ color: 'var(--color-text-muted)' }}>
                          Ver no Maps
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Botão de registro */}
          {error && (
            <p className="text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: '#FDEDEC', color: '#C0392B' }}>{error}</p>
          )}

          {!temRegistroFechado && (
            <button
              onClick={handleRegistrar}
              disabled={loading || isPending || !!feedback}
              className="w-full py-4 rounded-xl font-bold text-base transition-all"
              style={{
                backgroundColor: temEntradaAberta ? '#1E8449' : 'var(--color-primary-darker)',
                color: 'white',
                opacity: loading || isPending ? 0.7 : 1,
                letterSpacing: '0.02em',
              }}
            >
              {loading ? 'Registrando...' : temEntradaAberta ? '⏹ REGISTRAR SAÍDA' : '▶ REGISTRAR ENTRADA'}
            </button>
          )}

          {temRegistroFechado && (
            <div className="text-center py-2">
              <p className="text-sm font-medium" style={{ color: '#1E8449' }}>
                ✓ Jornada completa registrada
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Sair */}
      <button
        onClick={handleSair}
        className="w-full py-2.5 rounded-xl text-sm transition-colors"
        style={{ color: 'var(--color-text-muted)', border: '1px solid var(--color-bg-surface)', backgroundColor: 'white' }}
      >
        Sair
      </button>
    </div>
  )
}
