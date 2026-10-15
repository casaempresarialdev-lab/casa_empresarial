'use client'

import { useState, useTransition } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { createSupportTicketAction } from '@/app/(app)/suporte/actions'

interface Props {
  companyId: string | null
}

/**
 * Botão flutuante da mascote "Cá" — canto inferior direito, fica visível em
 * qualquer tela do sistema (ver 4.4/4.14 da especificação da Carol). Abre um
 * formulário simples; a mensagem é só registrada no sistema (tabela
 * support_tickets), sem abrir WhatsApp nem e-mail, e sem nenhum assistente
 * de IA por trás. Usa emoji como placeholder — a arte final da mascote
 * ainda não foi enviada pela Carol.
 */
export function MascoteSuporteButton({ companyId }: Props) {
  const [open, setOpen] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [enviado, setEnviado] = useState(false)

  if (!companyId) return null

  function handleClose() {
    setOpen(false)
    setMensagem('')
    setError('')
    setEnviado(false)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    startTransition(async () => {
      const result = await createSupportTicketAction(companyId!, mensagem)
      if (result?.error) setError(result.error)
      else {
        setEnviado(true)
        setMensagem('')
      }
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full flex items-center justify-center text-2xl shadow-lg hover:scale-105 transition-transform"
        style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-darker)' }}
        aria-label="Falar com o suporte"
        title="Falar com o suporte"
      >
        🙋‍♀️
      </button>

      <Modal open={open} onClose={handleClose} title="Precisa de ajuda?" description="Conta pra gente o que está acontecendo — a mensagem fica registrada aqui dentro, sem precisar de WhatsApp ou e-mail.">
        {enviado ? (
          <div className="flex flex-col gap-4 items-center text-center py-4">
            <div className="text-4xl">✅</div>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              Chamado registrado! Você pode acompanhar em Suporte, no menu do seu avatar.
            </p>
            <Button type="button" onClick={handleClose}>Fechar</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <textarea
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              placeholder="Descreva o que você precisa..."
              rows={5}
              autoFocus
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C19A6B]"
              style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
            />
            {error && (
              <p className="text-sm p-3 rounded-lg bg-red-50" style={{ color: 'var(--color-error)' }}>{error}</p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={handleClose}>Cancelar</Button>
              <Button type="submit" loading={isPending}>Enviar</Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  )
}
