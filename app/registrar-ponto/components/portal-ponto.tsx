'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { registrarPontoAction, sairPontoAction } from '../actions'
import type { PontoSession, TipoBatida } from '../actions'

const MapaPonto = dynamic(
  () => import('./mapa-ponto').then(m => m.MapaPonto),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-xl flex items-center justify-center" style={{ height: 160, backgroundColor: 'var(--color-bg-surface)' }}>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Carregando mapa...</p>
      </div>
    ),
  }
)

type RegistroHoje = {
  id: string
  entrada: string | null
  saida_almoco: string | null
  retorno_almoco: string | null
  saida: string | null
  data: string
} | null

interface Props {
  session: PontoSession
  registroHoje: RegistroHoje
}

type Estado = 'sem_registro' | 'primeiro_turno' | 'almoco' | 'segundo_turno' | 'completo'

function getEstado(r: RegistroHoje): Estado {
  if (!r || !r.entrada)    return 'sem_registro'
  if (!r.saida_almoco)     return 'primeiro_turno'
  if (!r.retorno_almoco)   return 'almoco'
  if (!r.saida)            return 'segundo_turno'
  return 'completo'
}

function formatTime(ts: string | null) {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(d: Date) {
  return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
}

const BATIDA_CONFIG: Record<TipoBatida, { emoji: string; label: string; cor: string }> = {
  entrada:        { emoji: '▶',  label: 'REGISTRAR ENTRADA',    cor: 'var(--color-primary-darker)' },
  saida_almoco:   { emoji: '⏸', label: 'SAÍDA P/ ALMOÇO',      cor: '#D35400' },
  retorno_almoco: { emoji: '▶',  label: 'RETORNO DO ALMOÇO',    cor: '#2471A3' },
  saida:          { emoji: '⏹', label: 'REGISTRAR SAÍDA',       cor: '#1E8449' },
}

const FEEDBACK_MSG: Record<TipoBatida, string> = {
  entrada:        'Entrada registrada!',
  saida_almoco:   'Bom almoço!',
  retorno_almoco: 'Bem-vindo de volta!',
  saida:          'Saída registrada!',
}

export function PortalPonto({ session, registroHoje }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [now,       setNow]      = useState(new Date())
  const [lat,       setLat]      = useState<number | null>(null)
  const [lng,       setLng]      = useState<number | null>(null)
  const [endereco,  setEndereco] = useState<string | null>(null)
  const [geoStatus, setGeoStatus] = useState<'loading' | 'ok' | 'denied' | 'idle'>('idle')
  const [registro,  setRegistro] = useState(registroHoje)
  const [feedback,  setFeedback] = useState<{ tipo: TipoBatida; hora: string } | null>(null)
  const [error,     setError]    = useState('')
  const [loading,   setLoading]  = useState<TipoBatida | null>(null)

  const estado = getEstado(registro)

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!navigator.geolocation) { setGeoStatus('denied'); return }
    setGeoStatus('loading')
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude, longitude } = pos.coords
        setLat(latitude); setLng(longitude); setGeoStatus('ok')
        try {
          const res  = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
            { headers: { 'Accept-Language': 'pt-BR' } },
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
          setEndereco(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`)
        }
      },
      () => setGeoStatus('denied'),
      { timeout: 10000 },
    )
  }, [])

  async function handleBatida(tipoBatida: TipoBatida) {
    setLoading(tipoBatida); setError('')
    const result = await registrarPontoAction(
      session.employeeId, session.companyId, lat, lng, endereco, tipoBatida,
    )
    setLoading(null)
    if ('error' in result) { setError(result.error); return }
    const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    setFeedback({ tipo: result.tipo, hora })
    setTimeout(() => {
      setFeedback(null)
      startTransition(() => router.refresh())
    }, 2500)
  }

  async function handleSair() {
    await sairPontoAction()
    router.push('/registrar-ponto')
  }

  const gmapsUrl = lat && lng ? `https://www.google.com/maps?q=${lat},${lng}` : null

  return (
    <div className="w-full max-w-sm space-y-4">

      {/* Feedback overlay */}
      {feedback && (
        <div className="fixed inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl p-8 text-center shadow-2xl max-w-xs mx-4">
            <div className="text-5xl mb-4">
              {feedback.tipo === 'entrada' ? '✅' : feedback.tipo === 'saida_almoco' ? '🍽️' : feedback.tipo === 'retorno_almoco' ? '💪' : '👋'}
            </div>
            <p className="text-xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
              {FEEDBACK_MSG[feedback.tipo]}
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
              {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
            <p className="text-xs mt-1 capitalize" style={{ color: 'var(--color-text-muted)' }}>
              {formatDate(now)}
            </p>
          </div>

          {/* Status do ponto hoje */}
          <div className="rounded-xl p-3 space-y-1.5" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
            {!registro && (
              <p className="text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>Sem registro hoje</p>
            )}
            {registro && (
              <>
                {[
                  { label: 'Entrada',          value: registro.entrada,        cor: '#1E8449' },
                  { label: 'Saída p/ almoço',  value: registro.saida_almoco,   cor: '#D35400' },
                  { label: 'Retorno almoço',   value: registro.retorno_almoco, cor: '#2471A3' },
                  { label: 'Saída',            value: registro.saida,          cor: '#566573' },
                ].map(item => item.value && (
                  <div key={item.label} className="flex justify-between items-center">
                    <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{item.label}</span>
                    <span className="text-xs font-semibold" style={{ color: item.cor }}>{formatTime(item.value)}</span>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Localização */}
          <div>
            {geoStatus === 'loading' && (
              <p className="text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>📍 Obtendo localização...</p>
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

          {error && (
            <p className="text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: '#FDEDEC', color: '#C0392B' }}>{error}</p>
          )}

          {/* Botões de batida */}
          {estado === 'sem_registro' && (
            <BotaoBatida tipo="entrada" loading={loading} onBatida={handleBatida} isPending={isPending} feedback={feedback} />
          )}

          {estado === 'primeiro_turno' && (
            <div className="space-y-2">
              <BotaoBatida tipo="saida_almoco" loading={loading} onBatida={handleBatida} isPending={isPending} feedback={feedback} />
              <button
                onClick={() => handleBatida('saida')}
                disabled={!!loading || isPending || !!feedback}
                className="w-full py-3 rounded-xl font-semibold text-sm transition-all"
                style={{ backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-secondary)', opacity: loading || isPending ? 0.7 : 1 }}>
                ⏹ Encerrar sem almoço
              </button>
            </div>
          )}

          {estado === 'almoco' && (
            <BotaoBatida tipo="retorno_almoco" loading={loading} onBatida={handleBatida} isPending={isPending} feedback={feedback} />
          )}

          {estado === 'segundo_turno' && (
            <BotaoBatida tipo="saida" loading={loading} onBatida={handleBatida} isPending={isPending} feedback={feedback} />
          )}

          {estado === 'completo' && (
            <div className="text-center py-2">
              <p className="text-sm font-medium" style={{ color: '#1E8449' }}>✓ Jornada completa registrada</p>
            </div>
          )}
        </div>
      </div>

      {/* Sair */}
      <button
        onClick={handleSair}
        className="w-full py-2.5 rounded-xl text-sm transition-colors"
        style={{ color: 'var(--color-text-muted)', border: '1px solid var(--color-bg-surface)', backgroundColor: 'white' }}>
        Sair
      </button>
    </div>
  )
}

function BotaoBatida({
  tipo, loading, onBatida, isPending, feedback,
}: {
  tipo: TipoBatida
  loading: TipoBatida | null
  onBatida: (t: TipoBatida) => void
  isPending: boolean
  feedback: unknown
}) {
  const cfg = BATIDA_CONFIG[tipo]
  const isLoading = loading === tipo
  return (
    <button
      onClick={() => onBatida(tipo)}
      disabled={!!loading || isPending || !!feedback}
      className="w-full py-4 rounded-xl font-bold text-base transition-all"
      style={{ backgroundColor: cfg.cor, color: 'white', opacity: loading || isPending ? 0.7 : 1, letterSpacing: '0.02em' }}>
      {isLoading ? 'Registrando...' : `${cfg.emoji} ${cfg.label}`}
    </button>
  )
}
