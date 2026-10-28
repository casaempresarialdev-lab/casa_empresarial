'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { CodeInput } from '@/components/ui/code-input'
import { CampoComAcoes } from '@/components/ui/campo-com-acoes'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { toast } from '@/lib/toast'
import {
  buscarDestinatarioAction, compartilharCredentialAction, removerCompartilhamentoAction, type Destinatario,
} from '../actions'
import type { Credential } from '../queries'

interface Props {
  credential: Credential | null
  onClose: () => void
}

// Troca de etapa: o PIN entra pela direita e empurra a lista de destinatários para a esquerda
const SLIDE = 'transform 450ms cubic-bezier(0.65, 0, 0.35, 1), opacity 300ms ease'

function Avatar({ nome, url }: { nome: string; url: string | null }) {
  return (
    <span className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center shrink-0 text-xs font-bold" style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}>
      {url
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={url} alt={nome} className="w-full h-full object-cover" />
        : nome.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()}
    </span>
  )
}

// Compartilhar: 1) adiciona e-mails (cada um conferido e mostrado com nome e foto)  2) confirma com o PIN
export function ModalCompartilhar({ credential, onClose }: Props) {
  const router = useRouter()
  const [etapa, setEtapa] = useState<'destinatarios' | 'pin'>('destinatarios')
  const [email, setEmail] = useState('')
  const [erroEmail, setErroEmail] = useState<string | undefined>()
  const [buscando, setBuscando] = useState(false)
  const [destinatarios, setDestinatarios] = useState<Destinatario[]>([])
  const [pin, setPin] = useState('')
  const [erroPin, setErroPin] = useState<string | undefined>()
  const [compartilhando, setCompartilhando] = useState(false)
  const [removendo, setRemovendo] = useState<string | null>(null)
  const noPin = etapa === 'pin'

  function fechar() {
    setEtapa('destinatarios'); setEmail(''); setErroEmail(undefined); setDestinatarios([]); setPin(''); setErroPin(undefined)
    onClose()
  }

  async function adicionar(e: React.FormEvent) {
    e.preventDefault()
    if (!credential) return
    const alvo = email.trim().toLowerCase()
    if (!alvo) return
    if (destinatarios.some((d) => d.email === alvo)) { setErroEmail('Este e-mail já está na lista.'); return }
    setBuscando(true)
    const r = await buscarDestinatarioAction(credential.id, alvo)
    setBuscando(false)
    if (r.error || !r.destinatario) { setErroEmail(r.error ?? 'Não foi possível conferir o e-mail.'); return }
    setDestinatarios((prev) => [...prev, r.destinatario!])
    setEmail('')
  }

  async function confirmar(e: React.FormEvent) {
    e.preventDefault()
    if (!credential) return
    if (!/^\d{6}$/.test(pin)) { setErroPin('Digite os 6 números do PIN.'); return }
    setCompartilhando(true)
    const r = await compartilharCredentialAction(credential.id, destinatarios.map((d) => d.email), pin)
    setCompartilhando(false)
    if ('error' in r && r.error) {
      setErroPin(r.error); setPin('')
      if (r.compartilhadas) router.refresh() // parte deu certo
      return
    }
    const n = destinatarios.length
    toast(n === 1 ? `${credential.sistema} compartilhada com ${destinatarios[0].nome}.` : `${credential.sistema} compartilhada com ${n} pessoas.`)
    router.refresh()
    fechar()
  }

  async function removerExistente(shareId: string, quem: string) {
    setRemovendo(shareId)
    await toast.promise(removerCompartilhamentoAction(shareId), {
      loading: `Removendo acesso de ${quem}…`,
      success: `${quem} não tem mais acesso a esta credencial.`,
      error: 'Não foi possível remover o compartilhamento.',
    })
    setRemovendo(null)
    router.refresh()
  }

  const existentes = credential?.compartilhamentos ?? []

  return (
    <Modal open={!!credential} onClose={fechar} title="Compartilhar credencial" description={credential?.sistema} className="sm:max-w-xl">
      {/* As duas etapas ocupam a mesma célula: a altura do modal acompanha a maior.
          overflow-hidden esconde a etapa fora de cena; a folga (p-1 / -m-1) evita cortar o anel de foco dos campos. */}
      <div className="grid overflow-hidden -m-1 p-1">
        {/* 1. Destinatários */}
        <div
          inert={noPin}
          aria-hidden={noPin}
          className="[grid-area:1/1] flex flex-col gap-4 motion-reduce:transition-none"
          style={{ transition: SLIDE, transform: noPin ? 'translateX(-110%)' : 'none', opacity: noPin ? 0 : 1 }}
        >
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Quem receber poderá apenas <strong>ver</strong> a credencial (com o próprio PIN). Não poderá editar, remover nem compartilhar.
          </p>

          <form onSubmit={adicionar}>
            <CampoComAcoes acoes={<Button type="submit" variant="secondary" loading={buscando}>Adicionar</Button>}>
              <Input
                label="E-mail do usuário"
                type="email"
                placeholder="usuario@email.com"
                autoFocus
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErroEmail(undefined) }}
                error={erroEmail}
              />
            </CampoComAcoes>
          </form>

          {/* Quem vai receber (conferidos) */}
          {destinatarios.length > 0 && (
            <ul className="flex flex-col gap-1 rounded-xl border p-2" style={{ borderColor: 'var(--color-bg-surface)' }}>
              {destinatarios.map((d) => (
                <li key={d.email} className="flex items-center gap-3 px-1 py-1">
                  <Avatar nome={d.nome} url={d.avatar_url} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{d.nome}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>{d.email}</p>
                  </div>
                  <IconButton icon="trash" label={`Tirar ${d.nome} da lista`} tone="danger" onClick={() => setDestinatarios((prev) => prev.filter((x) => x.email !== d.email))} />
                </li>
              ))}
            </ul>
          )}

          <Button type="button" className="w-full" disabled={!destinatarios.length} onClick={() => setEtapa('pin')}>
            Compartilhar{destinatarios.length > 1 ? ` com ${destinatarios.length} pessoas` : ''}
          </Button>

          {/* Já compartilhada com */}
          {existentes.length > 0 && (
            <div className="pt-3 border-t" style={{ borderColor: 'var(--color-bg-surface)' }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>
                Já compartilhada com
              </p>
              <ul className="flex flex-col gap-1">
                {existentes.map((s) => {
                  const quem = s.nome || s.email
                  return (
                    <li key={s.id} className="flex items-center gap-3 py-1">
                      <Avatar nome={quem} url={null} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{quem}</p>
                        {s.nome && <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>{s.email}</p>}
                      </div>
                      <IconButton icon="trash" label={`Remover acesso de ${quem}`} tone="danger" onClick={() => removerExistente(s.id, quem)} disabled={removendo === s.id} />
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>

        {/* 2. PIN (entra pela direita) */}
        <form
          onSubmit={confirmar}
          inert={!noPin}
          aria-hidden={!noPin}
          className="[grid-area:1/1] flex flex-col items-center justify-center gap-5 motion-reduce:transition-none"
          style={{ transition: SLIDE, transform: noPin ? 'none' : 'translateX(110%)', opacity: noPin ? 1 : 0 }}
        >
          <p className="text-sm text-center" style={{ color: 'var(--color-text-muted)' }}>
            Confirme com o seu PIN de segurança para compartilhar.
          </p>
          {noPin && <CodeInput mask autoFocus value={pin} onChange={(v) => { setPin(v); setErroPin(undefined) }} error={erroPin} />}
          <Button type="submit" loading={compartilhando} className="w-full">Confirmar</Button>
          <button type="button" onClick={() => { setEtapa('destinatarios'); setPin(''); setErroPin(undefined) }} className="text-xs font-medium hover:underline cursor-pointer" style={{ color: 'var(--color-brand)' }}>
            ← Voltar para a lista
          </button>
        </form>
      </div>
    </Modal>
  )
}
