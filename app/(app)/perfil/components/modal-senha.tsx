'use client'

import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Modal } from '@/components/ui/modal'
import { PasswordInput } from '@/components/ui/password-input'
import { PasswordChecklist } from '@/components/ui/password-checklist'
import { CodeInput } from '@/components/ui/code-input'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/toast'
import {
  novaSenhaForteSchema, perfilSenhaSchema, codigo2faSchema,
  type NovaSenhaForteData, type PerfilSenhaData, type Codigo2faData,
} from '@/lib/validations/perfil'
import { iniciarTrocaSenhaAction, concluirTrocaSenhaAction, cancelarTrocaSenhaAction, reenviarCodigo2faAction } from '../actions'
import { Stepper, CampoComAcoes } from './modal-ativar-2fa'

const STEPS = ['Nova senha', 'Confirmar', 'Código']

interface Props {
  open: boolean
  onClose: () => void
}

// Troca de senha: 1) nova senha (regras checadas ao digitar)  2) confirmar  3) código do app (2FA) ou do e-mail
export function ModalSenha({ open, onClose }: Props) {
  const [step, setStep] = useState(0)
  const [senha, setSenha] = useState('')
  const [metodo, setMetodo] = useState<'2fa' | 'email'>('email')
  const [email, setEmail] = useState('')
  const [avisoEnvio, setAvisoEnvio] = useState<string | null>(null)
  const [reenviando, setReenviando] = useState(false)

  const novaForm = useForm<NovaSenhaForteData>({ resolver: zodResolver(novaSenhaForteSchema), defaultValues: { password: '' } })
  const confirmarForm = useForm<PerfilSenhaData>({ resolver: zodResolver(perfilSenhaSchema) })
  const codigoForm = useForm<Codigo2faData>({ resolver: zodResolver(codigo2faSchema), defaultValues: { code: '' } })

  const digitada = novaForm.watch('password') ?? ''
  const confirmacao = confirmarForm.watch('confirmPassword') ?? ''

  function reset() {
    setStep(0)
    setSenha('')
    setAvisoEnvio(null)
    novaForm.reset({ password: '' }); confirmarForm.reset(); codigoForm.reset({ code: '' })
  }

  function handleClose() {
    if (step === 2) cancelarTrocaSenhaAction()
    reset()
    onClose()
  }

  const acoes = (submit: React.ReactNode) => (
    <>
      <Button type="button" variant="secondary" onClick={handleClose}>Cancelar</Button>
      {submit}
    </>
  )

  function escolherSenha(d: NovaSenhaForteData) {
    setSenha(d.password)
    confirmarForm.reset({ password: d.password, confirmPassword: '' })
    setStep(1)
  }

  async function confirmar(d: PerfilSenhaData) {
    const r = await iniciarTrocaSenhaAction({ password: senha, confirmPassword: d.confirmPassword })
    if ('error' in r) { confirmarForm.setError('confirmPassword', { message: r.error }); return }
    setMetodo(r.metodo ?? 'email')
    setEmail(r.email ?? '')
    setAvisoEnvio(r.aviso ?? null)
    setStep(2)
  }

  async function reenviar() {
    setReenviando(true)
    await toast.promise(reenviarCodigo2faAction('senha'), {
      loading: 'Reenviando código…',
      success: 'Enviamos um novo código para o seu e-mail.',
      error: 'Não foi possível reenviar o código.',
    })
    setReenviando(false)
  }

  async function concluir(d: Codigo2faData) {
    const r = await concluirTrocaSenhaAction({ password: senha, confirmPassword: senha }, d)
    if ('error' in r) { codigoForm.setError('code', { message: r.error }); return }
    toast('Senha alterada com sucesso!')
    reset()
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title="Alterar senha" className="sm:max-w-2xl">
      <Stepper step={step} labels={STEPS} />

      {/* 1. Nova senha, com as regras sendo checadas enquanto digita */}
      {step === 0 && (
        <form onSubmit={novaForm.handleSubmit(escolherSenha)} className="flex flex-col gap-4">
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Crie uma senha segura, que você não use em outros sites.</p>
          <CampoComAcoes acoes={acoes(<Button type="submit">Continuar</Button>)}>
            <PasswordInput semAutocompletar
              label="Nova senha"
              autoComplete="new-password"
              autoFocus
              error={novaForm.formState.errors.password?.message}
              {...novaForm.register('password')}
            />
          </CampoComAcoes>
          <PasswordChecklist senha={digitada} />
        </form>
      )}

      {/* 2. Confirmar */}
      {step === 1 && (
        <form onSubmit={confirmarForm.handleSubmit(confirmar)} className="flex flex-col gap-4">
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Digite a nova senha mais uma vez.</p>
          <CampoComAcoes acoes={acoes(<Button type="submit" loading={confirmarForm.formState.isSubmitting}>Continuar</Button>)}>
            <PasswordInput semAutocompletar
              label="Confirmar nova senha"
              autoComplete="new-password"
              autoFocus
              error={confirmarForm.formState.errors.confirmPassword?.message}
              {...confirmarForm.register('confirmPassword')}
            />
          </CampoComAcoes>
          {/* Indicação ao vivo de que as senhas batem */}
          {confirmacao && (
            <p className="text-xs flex items-center gap-1.5" style={{ color: confirmacao === senha ? 'var(--color-brand)' : 'var(--color-text-muted)' }}>
              {confirmacao === senha ? '✓ As senhas conferem' : 'As senhas ainda não conferem'}
            </p>
          )}
          <button type="button" onClick={() => setStep(0)} className="self-start text-xs font-medium hover:underline cursor-pointer" style={{ color: 'var(--color-brand)' }}>
            ← Voltar e escolher outra senha
          </button>
        </form>
      )}

      {/* 3. Código: do app autenticador (2FA ativo) ou do e-mail */}
      {step === 2 && (
        <form onSubmit={codigoForm.handleSubmit(concluir)} className="flex flex-col gap-4">
          {metodo === '2fa' ? (
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Abra o aplicativo de autenticação que você utiliza e digite o código de 6 números da Casa Empresarial.
            </p>
          ) : avisoEnvio ? (
            <p className="text-sm p-3 rounded-lg" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>{avisoEnvio}</p>
          ) : (
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Código enviado para <strong style={{ color: 'var(--color-text-primary)' }}>{email}</strong>. Ele vale por 10 minutos.
            </p>
          )}
          <CampoComAcoes codigo acoes={acoes(<Button type="submit" loading={codigoForm.formState.isSubmitting}>Alterar senha</Button>)}>
            <Controller
              control={codigoForm.control}
              name="code"
              render={({ field }) => (
                <CodeInput
                  label={metodo === '2fa' ? 'Código do app' : 'Código do e-mail'}
                  autoFocus
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  error={codigoForm.formState.errors.code?.message}
                />
              )}
            />
          </CampoComAcoes>
          {metodo === 'email' && (
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Não chegou? Veja o spam ou{' '}
              <button type="button" onClick={reenviar} disabled={reenviando} className="font-medium hover:underline cursor-pointer disabled:opacity-60" style={{ color: 'var(--color-brand)' }}>
                reenvie o código
              </button>.
            </p>
          )}
        </form>
      )}
    </Modal>
  )
}
