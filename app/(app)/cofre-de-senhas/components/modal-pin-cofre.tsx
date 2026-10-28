'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { CodeInput } from '@/components/ui/code-input'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/toast'

// Aviso de "sem PIN" e o link de cadastro ficam em components/ui/modal-pin
export { LINK_CADASTRAR_PIN } from '@/components/ui/modal-pin'

interface VerSenhaProps {
  /** Credencial cuja senha será revelada (null = fechado) */
  credencial: { id: string; sistema: string; login: string; url: string | null; observacao: string | null } | null
  onClose: () => void
  /** Confere o PIN no servidor e devolve a senha (ou o erro para mostrar no campo) */
  onConfirmar: (id: string, pin: string) => Promise<{ password?: string; error?: string; semPin?: boolean }>
  /** Usuário sem PIN cadastrado: troca para o aviso de cadastro */
  onSemPin: () => void
}

// Ver senha: PIN centralizado → login, senha, link e observação no próprio modal (login/senha com botão de copiar)
export function ModalVerSenha({ credencial, onClose, onConfirmar, onSemPin }: VerSenhaProps) {
  const [pin, setPin] = useState('')
  const [erro, setErro] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)
  const [senha, setSenha] = useState<string | null>(null)

  // Ao fechar, a senha some da tela (não fica guardada)
  function fechar() {
    setPin(''); setErro(undefined); setSenha(null)
    onClose()
  }

  async function confirmar(e: React.FormEvent) {
    e.preventDefault()
    if (!credencial) return
    if (!/^\d{6}$/.test(pin)) { setErro('Digite os 6 números do PIN.'); return }
    setLoading(true)
    const r = await onConfirmar(credencial.id, pin)
    setLoading(false)
    if (r.semPin) { fechar(); onSemPin(); return }
    if (r.error || !r.password) { setErro(r.error ?? 'Não foi possível revelar a senha.'); setPin(''); return }
    setPin('')
    setSenha(r.password)
  }

  return (
    <Modal open={!!credencial} onClose={fechar} title="Ver senha" description={credencial?.sistema} className="sm:max-w-md">
      {senha === null ? (
        <form onSubmit={confirmar} className="flex flex-col items-center gap-5">
          <p className="text-sm text-center" style={{ color: 'var(--color-text-muted)' }}>
            Informe o seu PIN de segurança para ver a senha.
          </p>
          <CodeInput mask autoFocus value={pin} onChange={(v) => { setPin(v); setErro(undefined) }} error={erro} />
          <Button type="submit" loading={loading} className="w-full">Ver senha</Button>
        </form>
      ) : (
        <div className="flex flex-col gap-3">
          <CampoCopiar label="Login" valor={credencial?.login ?? ''} />
          <CampoCopiar label="Senha" valor={senha} destaque />
          {credencial?.url && (
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Link de acesso</span>
              <a
                href={credencial.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 min-h-12 px-4 py-2 rounded-xl border text-sm break-all hover:underline"
                style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-brand)' }}
              >
                {credencial.url}
              </a>
            </div>
          )}
          {credencial?.observacao && (
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Observação</span>
              <p className="px-4 py-3 rounded-xl border text-sm whitespace-pre-wrap break-words" style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-secondary)' }}>
                {credencial.observacao}
              </p>
            </div>
          )}
          <Button type="button" variant="secondary" className="w-full mt-2" onClick={fechar}>Fechar</Button>
        </div>
      )}
    </Modal>
  )
}

// Valor somente leitura com botão de copiar
function CampoCopiar({ label, valor, destaque }: { label: string; valor: string; destaque?: boolean }) {
  async function copiar() {
    try {
      await navigator.clipboard.writeText(valor)
      toast(`${label} copiado${label === 'Senha' ? 'a' : ''}.`)
    } catch {
      toast.error('Não foi possível copiar. Selecione e copie manualmente.')
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
      <div
        className="flex items-center gap-2 h-12 pl-4 pr-1.5 rounded-xl border"
        style={{ borderColor: destaque ? 'var(--color-brand)' : 'var(--color-bg-surface)', backgroundColor: destaque ? 'var(--color-brand-light)' : '#fff' }}
      >
        <span className="flex-1 min-w-0 font-mono text-base truncate select-all" style={{ color: 'var(--color-text-primary)' }}>{valor}</span>
        <button
          type="button"
          onClick={copiar}
          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-semibold text-white shrink-0 cursor-pointer"
          style={{ backgroundColor: 'var(--color-brand)' }}
          aria-label={`Copiar ${label.toLowerCase()}`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          Copiar
        </button>
      </div>
    </div>
  )
}
