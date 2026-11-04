'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { aceitarCartaAction, recusarCartaAction } from '../actions'

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
    return <p className="text-sm text-center py-2" style={{ color: 'var(--color-text-secondary)' }}>Sua resposta foi registrada. Obrigado pelo retorno.</p>
  }

  return (
    <div className="flex flex-col gap-4">
      {erro && <p className="text-sm p-3 rounded-lg bg-red-50" style={{ color: 'var(--color-error)' }} role="alert">{erro}</p>}

      {recusando ? (
        <>
          <div className="flex flex-col gap-1">
            <label htmlFor="motivo" className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Quer contar o motivo? (opcional)</label>
            <textarea
              id="motivo"
              rows={3}
              maxLength={1000}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
              style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', backgroundColor: '#fff' }}
            />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setRecusando(false)} disabled={!!enviando}>Voltar</Button>
            <Button type="button" variant="danger" onClick={recusar} loading={enviando === 'recusa'}>Confirmar recusa</Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Ao aceitar, a {empresa} registra a data, a hora e o IP da sua resposta, e você segue para preencher seus dados e enviar os documentos da admissão.
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setRecusando(true)} disabled={!!enviando}>Recusar</Button>
            <Button type="button" onClick={aceitar} loading={enviando === 'aceite'}>Aceitar a proposta</Button>
          </div>
        </>
      )}
    </div>
  )
}
