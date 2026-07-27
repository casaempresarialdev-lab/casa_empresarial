'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { changePasswordAction } from '../actions'
import type { MemberWithProfile } from '../queries'

const ROLE_LABELS: Record<string, string> = {
  owner: 'Proprietário',
  admin: 'Administrador',
  member: 'Membro',
  accountant: 'Contador',
}

function cpfMask(cpf: string | null) {
  if (!cpf) return '—'
  const d = cpf.replace(/\D/g, '')
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

interface Props {
  open: boolean
  onClose: () => void
  member: MemberWithProfile | null
  email: string
}

export function ModalPainelUsuario({ open, onClose, member, email }: Props) {
  const [changingPwd, setChangingPwd] = useState(false)
  const [novaSenha, setNovaSenha]     = useState('')
  const [confirmar, setConfirmar]     = useState('')
  const [showNova, setShowNova]       = useState(false)
  const [showConf, setShowConf]       = useState(false)
  const [loading, setLoading]         = useState(false)
  const [pwdError, setPwdError]       = useState('')
  const [pwdOk, setPwdOk]             = useState(false)

  const profile = member?.profiles

  function handleClose() {
    setChangingPwd(false)
    setNovaSenha('')
    setConfirmar('')
    setPwdError('')
    setPwdOk(false)
    onClose()
  }

  function openPwdForm() {
    setChangingPwd(true)
    setPwdOk(false)
    setPwdError('')
    setNovaSenha('')
    setConfirmar('')
  }

  function cancelPwd() {
    setChangingPwd(false)
    setNovaSenha('')
    setConfirmar('')
    setPwdError('')
  }

  async function handleSavePwd(e: React.FormEvent) {
    e.preventDefault()
    if (novaSenha !== confirmar) { setPwdError('As senhas não coincidem.'); return }
    setLoading(true)
    setPwdError('')
    const result = await changePasswordAction(novaSenha)
    setLoading(false)
    if (result.error) { setPwdError(result.error); return }
    setPwdOk(true)
    setChangingPwd(false)
    setNovaSenha('')
    setConfirmar('')
  }

  return (
    <Modal open={open} onClose={handleClose} title="Meu perfil">
      <div className="flex flex-col gap-5">

        {/* ── Avatar + info básica ── */}
        <div className="flex items-center gap-4">
          {profile?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt={profile.name ?? ''}
              className="w-16 h-16 rounded-full object-cover shrink-0"
            />
          ) : (
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold shrink-0"
              style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-darker)' }}
            >
              {profile?.name?.charAt(0).toUpperCase() ?? '?'}
            </div>
          )}
          <div>
            <p className="font-semibold text-base" style={{ color: 'var(--color-text-primary)' }}>
              {profile?.name ?? '—'}
            </p>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {ROLE_LABELS[member?.role ?? ''] ?? member?.role}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              {cpfMask(profile?.cpf ?? null)}
            </p>
          </div>
        </div>

        <hr style={{ borderColor: 'var(--color-bg-surface)' }} />

        {/* ── Acesso ao sistema ── */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-muted)' }}>
            Acesso ao sistema
          </p>

          {/* E-mail */}
          <div
            className="flex items-center rounded-lg px-4 py-3 mb-2"
            style={{ backgroundColor: 'var(--color-bg-surface)' }}
          >
            <div className="flex-1">
              <p className="text-xs mb-0.5" style={{ color: 'var(--color-text-muted)' }}>E-mail</p>
              <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{email || '—'}</p>
            </div>
          </div>

          {/* Senha */}
          <div className="rounded-lg px-4 py-3" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs mb-0.5" style={{ color: 'var(--color-text-muted)' }}>Senha</p>
                <p className="text-sm font-medium tracking-widest" style={{ color: 'var(--color-text-primary)' }}>
                  ••••••••
                </p>
              </div>
              {!changingPwd && (
                <button
                  type="button"
                  onClick={openPwdForm}
                  className="text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
                  style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-primary-darker)' }}
                >
                  Alterar
                </button>
              )}
            </div>

            {changingPwd && (
              <form onSubmit={handleSavePwd} className="mt-4 flex flex-col gap-3">
                <div className="relative">
                  <Input
                    label="Nova senha"
                    type={showNova ? 'text' : 'password'}
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-8 text-xs"
                    style={{ color: 'var(--color-text-muted)' }}
                    onClick={() => setShowNova((v) => !v)}
                  >
                    {showNova ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
                <div className="relative">
                  <Input
                    label="Confirmar senha"
                    type={showConf ? 'text' : 'password'}
                    value={confirmar}
                    onChange={(e) => setConfirmar(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-8 text-xs"
                    style={{ color: 'var(--color-text-muted)' }}
                    onClick={() => setShowConf((v) => !v)}
                  >
                    {showConf ? 'Ocultar' : 'Mostrar'}
                  </button>
                </div>
                {pwdError && (
                  <p className="text-xs" style={{ color: 'var(--color-error)' }}>{pwdError}</p>
                )}
                <div className="flex gap-2">
                  <Button type="submit" size="sm" loading={loading}>Salvar senha</Button>
                  <Button type="button" variant="secondary" size="sm" onClick={cancelPwd}>Cancelar</Button>
                </div>
              </form>
            )}
          </div>

          {pwdOk && (
            <p className="text-xs mt-2 px-3 py-2 rounded-lg bg-green-50 text-green-700">
              Senha alterada com sucesso!
            </p>
          )}
        </div>

        <div className="flex justify-end pt-1">
          <Button type="button" variant="secondary" onClick={handleClose}>Fechar</Button>
        </div>
      </div>
    </Modal>
  )
}
