'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { validarPinAction } from '../actions'

function formatCnpj(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 14)
  if (d.length <= 2)  return d
  if (d.length <= 5)  return `${d.slice(0,2)}.${d.slice(2)}`
  if (d.length <= 8)  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
}

export function LoginPontoForm() {
  const router = useRouter()
  const [cnpj, setCnpj] = useState('')
  const [pin, setPin]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const fd = new FormData()
    fd.set('cnpj', cnpj)
    fd.set('pin', pin)

    const result = await validarPinAction(fd)
    setLoading(false)

    if ('error' in result) { setError(result.error); return }
    router.push('/registrar-ponto/ponto')
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 16px',
    borderRadius: 12,
    border: '1px solid var(--color-bg-surface)',
    fontSize: '1rem',
    color: 'var(--color-text-primary)',
    backgroundColor: 'white',
    outline: 'none',
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
          CNPJ da empresa
        </label>
        <input
          type="text"
          inputMode="numeric"
          value={cnpj}
          onChange={e => setCnpj(formatCnpj(e.target.value))}
          placeholder="00.000.000/0001-00"
          required
          style={inputStyle}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
          PIN (4 dígitos)
        </label>
        <input
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={pin}
          onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          placeholder="••••"
          required
          style={{ ...inputStyle, fontSize: '1.5rem', letterSpacing: '0.5rem', textAlign: 'center' }}
        />
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl text-sm" style={{ backgroundColor: '#FDEDEC', color: '#C0392B' }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || cnpj.replace(/\D/g, '').length < 14 || pin.length < 4}
        className="w-full py-3.5 rounded-xl font-semibold text-sm transition-opacity"
        style={{
          backgroundColor: 'var(--color-primary-darker)',
          color: 'white',
          opacity: loading || cnpj.replace(/\D/g, '').length < 14 || pin.length < 4 ? 0.5 : 1,
          cursor: loading ? 'wait' : 'pointer',
        }}
      >
        {loading ? 'Verificando...' : 'Entrar'}
      </button>
    </form>
  )
}
