'use client'

import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Modal } from '@/components/ui/modal'
import { CodeInput } from '@/components/ui/code-input'
import { PasswordInput } from '@/components/ui/password-input'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { toast } from '@/lib/toast'
import { codigo2faSchema, confirmarSenhaSchema, type Codigo2faData, type ConfirmarSenhaData } from '@/lib/validations/perfil'
import {
  iniciarDesativacao2faAction, reenviarCodigo2faAction, concluirDesativacao2faAction, cancelarDesativacao2faAction,
} from '../actions'
import { Stepper, CampoComAcoes } from './modal-ativar-2fa'

const STEPS = ['Senha', 'E-mail', 'Desativado']

interface Props {
  open: boolean
  onClose: () => void
  onDesativado: () => void
}

// Desativação do 2FA: 1) confirma a senha  2) código enviado por e-mail → desativa
export function ModalDesativar2fa({ open, onClose, onDesativado }: Props) {
  const [step, setStep] = useState(0)
  const [email, setEmail] = useState('')
  // Preenchido quando o código NÃO saiu por e-mail (ex.: envio não configurado em desenvolvimento)
  const [avisoEnvio, setAvisoEnvio] = useState<string | null>(null)
  const [reenviando, setReenviando] = useState(false)

  const senhaForm = useForm<ConfirmarSenhaData>({ resolver: zodResolver(confirmarSenhaSchema) })
  const emailForm = useForm<Codigo2faData>({ resolver: zodResolver(codigo2faSchema) })

  function reset() {
    setStep(0)
    setAvisoEnvio(null)
    senhaForm.reset(); emailForm.reset()
  }

  // Fechar no meio descarta o código enviado
  function handleClose() {
    if (step === 1) cancelarDesativacao2faAction()
    reset()
    onClose()
  }

  async function confirmarSenha(d: ConfirmarSenhaData) {
    const r = await iniciarDesativacao2faAction(d)
    if ('error' in r) { senhaForm.setError('senha', { message: r.error }); return }
    setEmail(r.email ?? '')
    setAvisoEnvio(r.aviso ?? null)
    setStep(1)
  }

  async function reenviar() {
    setReenviando(true)
    await toast.promise(reenviarCodigo2faAction('desativar'), {
      loading: 'Reenviando código…',
      success: 'Enviamos um novo código para o seu e-mail.',
      error: 'Não foi possível reenviar o código.',
    })
    setReenviando(false)
  }

  async function desativar(d: Codigo2faData) {
    const r = await concluirDesativacao2faAction(d)
    if ('error' in r) { emailForm.setError('code', { message: r.error }); return }
    onDesativado() // atualiza o status da caixa; o modal segue para a mensagem final
    setStep(2)
  }

  return (
    <Modal open={open} onClose={handleClose} title="Desativar autenticação em 2 fatores" className="sm:max-w-2xl">
      <Stepper step={step} labels={STEPS} />

      {/* 1. Senha */}
      {step === 0 && (
        <form onSubmit={senhaForm.handleSubmit(confirmarSenha)} className="flex flex-col gap-4">
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Para sua segurança, confirme a senha da sua conta. Sem os 2 fatores, o login volta a pedir só a senha.
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
        <form onSubmit={emailForm.handleSubmit(desativar)} className="flex flex-col gap-4">
          {avisoEnvio ? (
            <p className="text-sm p-3 rounded-lg" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>{avisoEnvio}</p>
          ) : (
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Código enviado para <strong style={{ color: 'var(--color-text-primary)' }}>{email}</strong>. Ele vale por 10 minutos.
            </p>
          )}
          <CampoComAcoes codigo acoes={<>
            <Button type="button" variant="secondary" onClick={handleClose}>Cancelar</Button>
            <Button type="submit" loading={emailForm.formState.isSubmitting}>Desativar</Button>
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

      {/* 3. Desativado: recomenda tirar a conta do app autenticador */}
      {step === 2 && (
        <div className="flex flex-col items-center text-center gap-3">
          <span className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}>
            <Icon name="shield" size={26} />
          </span>
          <h3 className="text-lg font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
            Autenticação em 2 fatores desativada
          </h3>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            A partir de agora, o login pede só a sua senha.
          </p>
          <p className="text-sm p-3 rounded-lg text-left" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
            <strong>Recomendado:</strong> remova a Casa Empresarial do aplicativo de autenticação que você utiliza.
            O código antigo não vale mais e, se você ativar de novo, um novo código será criado — manter os dois no app pode causar confusão.
          </p>
          <Button type="button" className="w-full mt-2" onClick={handleClose}>Entendi</Button>
        </div>
      )}
    </Modal>
  )
}
