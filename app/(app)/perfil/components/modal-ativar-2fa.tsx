'use client'

import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Modal } from '@/components/ui/modal'
import { CodeInput } from '@/components/ui/code-input'
import { CampoComAcoes } from '@/components/ui/campo-com-acoes'
import { PasswordInput } from '@/components/ui/password-input'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/toast'
import { codigo2faSchema, confirmarSenhaSchema, type Codigo2faData, type ConfirmarSenhaData } from '@/lib/validations/perfil'
import {
  iniciarAtivacao2faAction, reenviarCodigo2faAction, confirmarEmail2faAction,
  concluirAtivacao2faAction, cancelarAtivacao2faAction,
} from '../actions'

const STEPS = ['Senha', 'E-mail', 'App autenticador']

type Fator = { factorId: string; qr: string; secret: string }

interface Props {
  open: boolean
  onClose: () => void
  onAtivado: () => void
}

// Os modais do perfil importam o layout campo + botões daqui
export { CampoComAcoes }

// Indicador de etapas: número (ou ✓ quando concluída) + nome, ligados por uma linha
export function Stepper({ step, labels = STEPS }: { step: number; labels?: string[] }) {
  return (
    <ol className="flex items-center gap-2 mb-6">
      {labels.map((label, i) => {
        const done = i < step
        const current = i === step
        return (
          // min-w-0 + truncate: em telas estreitas os nomes encurtam em vez de criar rolagem horizontal
          <li key={label} className="flex items-center gap-2 flex-1 last:flex-none min-w-0">
            <span
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={done || current
                ? { backgroundColor: 'var(--color-brand)', color: '#fff' }
                : { backgroundColor: 'var(--color-bg-surface)', color: 'var(--color-text-muted)' }}
            >
              {done ? '✓' : i + 1}
            </span>
            <span className="text-sm whitespace-nowrap truncate" style={{ color: current ? 'var(--color-text-primary)' : 'var(--color-text-muted)', fontWeight: current ? 600 : 400 }}>
              {label}
            </span>
            {i < labels.length - 1 && (
              <span className="flex-1 h-px min-w-4" style={{ backgroundColor: done ? 'var(--color-brand)' : 'var(--color-card-border)' }} />
            )}
          </li>
        )
      })}
    </ol>
  )
}

// Ativação do 2FA: 1) confirma a senha  2) código enviado por e-mail  3) QR code + código do app
export function ModalAtivar2fa({ open, onClose, onAtivado }: Props) {
  const [step, setStep] = useState(0)
  const [email, setEmail] = useState('')
  // Preenchido quando o código NÃO saiu por e-mail (ex.: envio não configurado em desenvolvimento)
  const [avisoEnvio, setAvisoEnvio] = useState<string | null>(null)
  const [fator, setFator] = useState<Fator | null>(null)
  const [reenviando, setReenviando] = useState(false)

  const senhaForm = useForm<ConfirmarSenhaData>({ resolver: zodResolver(confirmarSenhaSchema) })
  const emailForm = useForm<Codigo2faData>({ resolver: zodResolver(codigo2faSchema) })
  const appForm = useForm<Codigo2faData>({ resolver: zodResolver(codigo2faSchema) })

  // Fechar no meio descarta o que ficou pela metade (fator não confirmado e código do e-mail)
  async function handleClose() {
    if (step > 0) cancelarAtivacao2faAction()
    setStep(0)
    setFator(null)
    senhaForm.reset(); emailForm.reset(); appForm.reset()
    onClose()
  }

  async function confirmarSenha(d: ConfirmarSenhaData) {
    const r = await iniciarAtivacao2faAction(d)
    if ('error' in r) { senhaForm.setError('senha', { message: r.error }); return }
    setEmail(r.email ?? '')
    setAvisoEnvio(r.aviso ?? null)
    setStep(1)
  }

  async function reenviar() {
    setReenviando(true)
    await toast.promise(reenviarCodigo2faAction(), {
      loading: 'Reenviando código…',
      success: 'Enviamos um novo código para o seu e-mail.',
      error: 'Não foi possível reenviar o código.',
    })
    setReenviando(false)
  }

  async function confirmarEmail(d: Codigo2faData) {
    const r = await confirmarEmail2faAction(d)
    if ('error' in r) { emailForm.setError('code', { message: r.error }); return }
    setFator({ factorId: r.factorId!, qr: r.qr!, secret: r.secret! })
    setStep(2)
  }

  async function concluir(d: Codigo2faData) {
    if (!fator) return
    const r = await concluirAtivacao2faAction(fator.factorId, d)
    if ('error' in r) { appForm.setError('code', { message: r.error }); return }
    toast('Autenticação em 2 fatores ativada!')
    setStep(0)
    setFator(null)
    senhaForm.reset(); emailForm.reset(); appForm.reset()
    onAtivado()
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Ativar autenticação em 2 fatores" className="sm:max-w-2xl">
      <Stepper step={step} />

      {/* 1. Senha */}
      {step === 0 && (
        <form onSubmit={senhaForm.handleSubmit(confirmarSenha)} className="flex flex-col gap-4">
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Para sua segurança, confirme a senha da sua conta.
          </p>
          <CampoComAcoes acoes={<>
            <Button type="button" variant="secondary" onClick={handleClose}>Cancelar</Button>
            <Button type="submit" loading={senhaForm.formState.isSubmitting}>Continuar</Button>
          </>}>
            <PasswordInput semAutocompletar
              label="Senha"
              autoComplete="current-password"
              autoFocus
              error={senhaForm.formState.errors.senha?.message}
              {...senhaForm.register('senha')}
            />
          </CampoComAcoes>
        </form>
      )}

      {/* 2. Código por e-mail */}
      {step === 1 && (
        <form onSubmit={emailForm.handleSubmit(confirmarEmail)} className="flex flex-col gap-4">
          {avisoEnvio ? (
            <p className="text-sm p-3 rounded-lg" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>{avisoEnvio}</p>
          ) : (
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Código enviado para <strong style={{ color: 'var(--color-text-primary)' }}>{email}</strong>. Ele vale por 10 minutos.
            </p>
          )}
          <CampoComAcoes codigo acoes={<>
            <Button type="button" variant="secondary" onClick={handleClose}>Cancelar</Button>
            <Button type="submit" loading={emailForm.formState.isSubmitting}>Confirmar</Button>
          </>}>
            <Controller
              control={emailForm.control}
              name="code"
              render={({ field }) => (
                <CodeInput label="Código do e-mail" autoFocus value={field.value ?? ''} onChange={field.onChange} error={emailForm.formState.errors.code?.message} />
              )}
            />
          </CampoComAcoes>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Não chegou? Veja o spam ou{' '}
            <button type="button" onClick={reenviar} disabled={reenviando} className="font-medium hover:underline cursor-pointer disabled:opacity-60" style={{ color: 'var(--color-brand)' }}>
              reenvie o código
            </button>.
          </p>
        </form>
      )}

      {/* 3. App autenticador */}
      {step === 2 && fator && (
        <form onSubmit={appForm.handleSubmit(concluir)} className="flex flex-col gap-4">
          <ol className="text-sm flex flex-col gap-1 list-decimal pl-5" style={{ color: 'var(--color-text-secondary)' }}>
            <li>Abra no celular o aplicativo de autenticação que você utiliza e toque em <strong>+</strong>.</li>
            <li>Escaneie o QR code (ou digite a chave manualmente).</li>
            <li>Digite o código de 6 números que aparece no app.</li>
          </ol>
          <div className="flex flex-col sm:flex-row items-center gap-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fator.qr} alt="QR code para o app autenticador" className="w-40 h-40 rounded-lg border bg-white p-2 shrink-0" style={{ borderColor: 'var(--color-bg-surface)' }} />
            <div className="flex-1 min-w-0 w-full">
              <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-muted)' }}>Chave para digitar manualmente</p>
              <code className="block text-xs break-all rounded-lg px-3 py-2 bg-gray-50" style={{ color: 'var(--color-text-primary)' }}>{fator.secret}</code>
            </div>
          </div>
          <CampoComAcoes codigo acoes={<>
            <Button type="button" variant="secondary" onClick={handleClose}>Cancelar</Button>
            <Button type="submit" loading={appForm.formState.isSubmitting}>Ativar</Button>
          </>}>
            <Controller
              control={appForm.control}
              name="code"
              render={({ field }) => (
                <CodeInput label="Código do app" value={field.value ?? ''} onChange={field.onChange} error={appForm.formState.errors.code?.message} />
              )}
            />
          </CampoComAcoes>
        </form>
      )}
    </Modal>
  )
}
