'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { ModalAtivar2fa } from './modal-ativar-2fa'
import { ModalDesativar2fa } from './modal-desativar-2fa'
import { ModalPin, type PinModo } from './modal-pin'

function StatusBadge({ ativo }: { ativo: boolean }) {
  return (
    <span
      className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
      style={ativo
        ? { backgroundColor: 'var(--color-brand)', color: '#fff' }
        : { backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-muted)' }}
    >
      {ativo ? 'Ativado' : 'Desativado'}
    </span>
  )
}

function Secao({ icon, titulo, descricao, ativo, children }: {
  icon: 'shield' | 'lock'; titulo: string; descricao: string; ativo: boolean | null; children: React.ReactNode
}) {
  return (
    <section className="h-full rounded-xl border p-5 flex flex-col gap-4" style={{ borderColor: 'var(--color-bg-surface)' }}>
      {/* Ícone + título com o status na linha de baixo; a descrição vem embaixo, na largura toda da caixa */}
      <div className="flex items-center gap-3">
        {/* Ativado: cores invertidas — fundo na cor de destaque e o símbolo na cor clara */}
        <span
          className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 transition-colors"
          style={ativo
            ? { backgroundColor: 'var(--color-brand)', color: 'var(--color-brand-light)' }
            : { backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}
        >
          <Icon name={icon} size={28} />
        </span>
        <div className="flex-1 min-w-0 flex flex-col items-start gap-1">
          <h3 className="font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>{titulo}</h3>
          {ativo !== null && <StatusBadge ativo={ativo} />}
        </div>
      </div>
      <p className="text-sm -mt-1" style={{ color: 'var(--color-text-muted)' }}>{descricao}</p>
      {children}
    </section>
  )
}

// ── Autenticação em 2 fatores (TOTP: Google Authenticator e similares) ──

function DoisFatores({ ativo, onAtualizado }: { ativo: boolean | null; onAtualizado: () => void }) {
  const [modalOpen, setModalOpen] = useState(false)
  const [modalOffOpen, setModalOffOpen] = useState(false)

  return (
    <Secao
      icon="shield"
      titulo="Autenticação em 2 fatores"
      descricao="Além da senha, o login pede um código de 6 números gerado no aplicativo de autenticação que você utiliza."
      ativo={ativo}
    >
      {ativo === null ? (
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Carregando…</p>
      ) : ativo ? (
        <>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Sua conta está protegida. O código do app será pedido a cada login.
          </p>
          <Button type="button" variant="secondary" className="mt-auto w-full" onClick={() => setModalOffOpen(true)}>Desativar</Button>
        </>
      ) : (
        <Button type="button" className="mt-auto w-full" onClick={() => setModalOpen(true)}>Ativar</Button>
      )}

      <ModalAtivar2fa open={modalOpen} onClose={() => setModalOpen(false)} onAtivado={onAtualizado} />
      <ModalDesativar2fa open={modalOffOpen} onClose={() => setModalOffOpen(false)} onDesativado={onAtualizado} />
    </Secao>
  )
}

// ── PIN de segurança: cadastrar, alterar e remover em modal (senha → código → PIN) ──

function PinSeguranca({ temPin, atualizadoEm, doisFatoresAtivo }: { temPin: boolean; atualizadoEm: string | null; doisFatoresAtivo: boolean }) {
  const router = useRouter()
  const [modo, setModo] = useState<PinModo | null>(null)

  return (
    <Secao
      icon="lock"
      titulo="PIN de segurança"
      descricao="Código de 6 números pedido para confirmar operações importantes dentro do sistema."
      ativo={temPin}
    >
      {!temPin ? (
        <Button type="button" className="mt-auto w-full" onClick={() => setModo('cadastrar')}>Cadastrar PIN</Button>
      ) : (
        <>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            PIN cadastrado{atualizadoEm ? ` em ${new Date(atualizadoEm).toLocaleDateString('pt-BR')}` : ''}.
          </p>
          <div className="mt-auto grid grid-cols-2 gap-2">
            <Button type="button" variant="secondary" className="w-full" onClick={() => setModo('alterar')}>Alterar PIN</Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => setModo('remover')}>Remover</Button>
          </div>
        </>
      )}

      {modo && (
        <ModalPin
          open
          modo={modo}
          doisFatoresAtivo={doisFatoresAtivo}
          onClose={() => setModo(null)}
          onConcluido={() => router.refresh()}
        />
      )}
    </Secao>
  )
}

export function SegurancaTab({ temPin, pinAtualizadoEm }: { temPin: boolean; pinAtualizadoEm: string | null }) {
  // Status do 2FA fica aqui: o PIN usa para decidir se confirma pelo app ou pelo e-mail
  const [supabase] = useState(() => createClient())
  const [doisFatores, setDoisFatores] = useState<boolean | null>(null) // null = carregando

  const load = useCallback(async () => {
    const { data } = await supabase.auth.mfa.listFactors()
    setDoisFatores(!!data?.totp[0]) // totp = só os fatores já verificados
  }, [supabase])

  useEffect(() => { load() }, [load])

  // Ativação/desativação feitas no servidor: atualiza a sessão do navegador e o status
  async function atualizado() {
    await supabase.auth.refreshSession()
    load()
  }

  return (
    // Duas caixas lado a lado (empilhadas em telas estreitas)
    <div className="grid grid-cols-1 md:grid-cols-[repeat(2,minmax(0,380px))] gap-4 items-stretch">
      <DoisFatores ativo={doisFatores} onAtualizado={atualizado} />
      <PinSeguranca temPin={temPin} atualizadoEm={pinAtualizadoEm} doisFatoresAtivo={!!doisFatores} />
    </div>
  )
}
