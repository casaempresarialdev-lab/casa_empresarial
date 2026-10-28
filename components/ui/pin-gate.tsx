'use client'

import { useState } from 'react'
import { CodeInput } from '@/components/ui/code-input'
import { Button } from '@/components/ui/button'
import { verificarPinAction } from '@/lib/actions/pin'

// Troca de etapa: o formulário entra pela direita e empurra o PIN para a esquerda
const SLIDE = 'transform 450ms cubic-bezier(0.65, 0, 0.35, 1), opacity 300ms ease'

interface Props {
  /** Exige o PIN antes de mostrar o conteúdo (ex.: só na edição) */
  ativo: boolean
  /** PIN já conferido (null = ainda não) — guardado pelo pai para enviar junto na ação final */
  pin: string | null
  onLiberado: (pin: string) => void
  descricao: React.ReactNode
  acaoLabel?: string
  children: React.ReactNode
}

// Etapa de PIN antes de um formulário protegido: PIN centralizado → confere no servidor → desliza para o formulário
export function PinGate({ ativo, pin, onLiberado, descricao, acaoLabel = 'Continuar', children }: Props) {
  const [digitado, setDigitado] = useState('')
  const [erro, setErro] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)

  if (!ativo) return <>{children}</>
  const liberado = pin !== null

  async function confirmar(e: React.FormEvent) {
    e.preventDefault()
    if (!/^\d{6}$/.test(digitado)) { setErro('Digite os 6 números do PIN.'); return }
    setLoading(true)
    const r = await verificarPinAction(digitado)
    setLoading(false)
    if ('error' in r) { setErro(r.error); setDigitado(''); return }
    onLiberado(digitado)
    setDigitado('')
  }

  return (
    // As duas etapas ocupam a mesma célula (a altura acompanha a maior); a folga evita cortar o anel de foco
    <div className="grid overflow-hidden -m-1 p-1">
      <form
        onSubmit={confirmar}
        inert={liberado}
        aria-hidden={liberado}
        className="[grid-area:1/1] flex flex-col items-center justify-center gap-5 motion-reduce:transition-none"
        style={{ transition: SLIDE, transform: liberado ? 'translateX(-110%)' : 'none', opacity: liberado ? 0 : 1 }}
      >
        <div className="text-sm text-center" style={{ color: 'var(--color-text-muted)' }}>{descricao}</div>
        {!liberado && <CodeInput mask autoFocus value={digitado} onChange={(v) => { setDigitado(v); setErro(undefined) }} error={erro} />}
        <Button type="submit" loading={loading} className="w-full max-w-sm">{acaoLabel}</Button>
      </form>

      <div
        inert={!liberado}
        aria-hidden={!liberado}
        className="[grid-area:1/1] motion-reduce:transition-none"
        style={{ transition: SLIDE, transform: liberado ? 'none' : 'translateX(110%)', opacity: liberado ? 1 : 0 }}
      >
        {liberado && children}
      </div>
    </div>
  )
}
