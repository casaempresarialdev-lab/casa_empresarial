'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { aceitarCartaAction, recusarCartaAction } from '../actions'

// A cor da empresa pode ser clara demais para texto: o botão secundário usa tons neutros
const SECUNDARIO: React.CSSProperties = { color: 'var(--color-text-secondary)', borderColor: 'var(--color-card-border-hover)' }

export function RespostaCarta({ token, empresa }: { token: string; empresa: string }) {
  const [recusando, setRecusando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState<'aceite' | 'recusa' | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [recusada, setRecusada] = useState(false)

  async function aceitar() {
    setEnviando('aceite')
    setErro(null)
    const r = await aceitarCartaAction(token)
    if (r.url) { window.location.assign(r.url); return }
    setEnviando(null)
    setErro(r.error ?? 'Não foi possível registrar o aceite.')
  }

  async function recusar() {
    setEnviando('recusa')
    setErro(null)
    const r = await recusarCartaAction(token, motivo)
    setEnviando(null)
    if (r.error) { setErro(r.error); return }
    setRecusada(true)
  }

  if (recusada) {
    return (
      <div className="flex flex-col items-center text-center gap-3 py-2">
        <span className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}>
          <Icon name="info" size={22} />
        </span>
        <h2 className="text-lg font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>Proposta recusada</h2>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Sua resposta foi registrada. Obrigado pelo retorno.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {recusando ? (
        <>
          <div>
            <h2 className="text-lg font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>Recusar a proposta</h2>
            <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Se quiser, conte o motivo para a {empresa}. Esta resposta não pode ser desfeita.</p>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="motivo" className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Motivo (opcional)</label>
            <textarea
              id="motivo"
              rows={3}
              maxLength={1000}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
              style={{ borderColor: 'var(--color-card-border)', color: 'var(--color-text-primary)', backgroundColor: '#fff' }}
            />
          </div>
          {erro && <p className="text-sm p-3 rounded-lg bg-red-50" style={{ color: '#B91C1C' }} role="alert">{erro}</p>}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button type="button" variant="secondary" style={SECUNDARIO} onClick={() => setRecusando(false)} disabled={!!enviando}>Voltar</Button>
            <Button type="button" variant="danger" onClick={recusar} loading={enviando === 'recusa'}>Confirmar recusa</Button>
          </div>
        </>
      ) : (
        <>
          <div>
            <h2 className="text-lg font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>O que você decidiu?</h2>
            <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              Ao aceitar, a {empresa} registra a data, a hora e o IP da sua resposta, e você segue para preencher seus dados e enviar os documentos da admissão.
            </p>
          </div>
          {erro && <p className="text-sm p-3 rounded-lg bg-red-50" style={{ color: '#B91C1C' }} role="alert">{erro}</p>}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button type="button" variant="secondary" size="lg" style={SECUNDARIO} onClick={() => setRecusando(true)} disabled={!!enviando}>Recusar</Button>
            <Button type="button" size="lg" style={{ color: 'var(--cor-sobre-marca)' }} onClick={aceitar} loading={enviando === 'aceite'}>Aceitar a proposta</Button>
          </div>
        </>
      )}
    </div>
  )
}
