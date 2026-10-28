'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Modal } from '@/components/ui/modal'
import { CodeInput } from '@/components/ui/code-input'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'

/** Link para cadastrar o PIN: perfil já aberto na aba Segurança */
export const LINK_CADASTRAR_PIN = '/perfil?aba=seguranca'

interface PinConfirmacaoProps {
  open: boolean
  titulo: string
  /** Texto acima do PIN (o que vai acontecer) */
  descricao: React.ReactNode
  /** Nome do item, abaixo do título */
  subtitulo?: string
  acaoLabel: string
  /** Ação destrutiva (ex.: remover): botão no tom de perigo */
  perigo?: boolean
  onClose: () => void
  /**
   * Confere o PIN no servidor e executa a ação. Devolve o erro (mostrado abaixo do PIN)
   * ou um conteúdo para exibir no lugar do PIN depois de confirmado (ex.: botão de baixar o arquivo).
   */
  onConfirmar: (pin: string) => Promise<{ error?: string; concluido?: React.ReactNode } | void>
}

// Confirmação com PIN de segurança: PIN centralizado e botão de confirmar embaixo, na largura toda
export function ModalPinConfirmacao({ open, titulo, descricao, subtitulo, acaoLabel, perigo, onClose, onConfirmar }: PinConfirmacaoProps) {
  const [pin, setPin] = useState('')
  const [erro, setErro] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)
  // Conteúdo exibido depois do PIN confirmado (quando a ação devolve um)
  const [concluido, setConcluido] = useState<React.ReactNode>(null)

  function fechar() {
    if (loading) return
    setPin(''); setErro(undefined); setConcluido(null)
    onClose()
  }

  async function confirmar(e: React.FormEvent) {
    e.preventDefault()
    if (!/^\d{6}$/.test(pin)) { setErro('Digite os 6 números do PIN.'); return }
    setLoading(true)
    const r = await onConfirmar(pin)
    setLoading(false)
    if (r && r.error) { setErro(r.error); setPin(''); return }
    setPin(''); setErro(undefined)
    if (r && r.concluido) setConcluido(r.concluido)
  }

  return (
    <Modal open={open} onClose={fechar} title={titulo} description={subtitulo} className="sm:max-w-md">
      {concluido ? (
        <div className="animate-enter flex flex-col gap-3">
          {concluido}
          <Button type="button" variant="secondary" className="w-full" onClick={fechar}>Fechar</Button>
        </div>
      ) : (
      <form onSubmit={confirmar} className="flex flex-col items-center gap-5">
        <div className="text-sm text-center" style={{ color: 'var(--color-text-muted)' }}>{descricao}</div>
        <CodeInput mask autoFocus value={pin} onChange={(v) => { setPin(v); setErro(undefined) }} error={erro} />
        <Button
          type="submit"
          loading={loading}
          className="w-full"
          style={perigo ? { backgroundColor: 'var(--color-error)', color: '#fff' } : undefined}
        >
          {acaoLabel}
        </Button>
      </form>
      )}
    </Modal>
  )
}

// Sem PIN cadastrado: explica e leva ao perfil, na aba Segurança
export function ModalSemPin({ open, onClose, motivo }: {
  open: boolean
  onClose: () => void
  /** O que exige o PIN (ex.: "ver, editar ou compartilhar senhas do cofre") */
  motivo: string
}) {
  return (
    <Modal open={open} onClose={onClose} title="PIN de segurança necessário">
      <div className="flex flex-col items-center text-center gap-3">
        <span className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}>
          <Icon name="lock" size={26} />
        </span>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Para {motivo}, é preciso confirmar com o seu <strong>PIN de segurança</strong>. Você ainda não cadastrou um.
        </p>
        <div className="flex gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Agora não</Button>
          <Link
            href={LINK_CADASTRAR_PIN}
            className="inline-flex items-center justify-center h-10 px-4 rounded-lg text-sm font-semibold text-white"
            style={{ backgroundColor: 'var(--color-brand)' }}
          >
            Cadastrar PIN
          </Link>
        </div>
      </div>
    </Modal>
  )
}
