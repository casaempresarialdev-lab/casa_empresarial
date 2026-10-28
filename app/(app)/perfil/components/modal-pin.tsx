'use client'

import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Modal } from '@/components/ui/modal'
import { CodeInput } from '@/components/ui/code-input'
import { PasswordInput } from '@/components/ui/password-input'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/toast'
import {
  codigo2faSchema, confirmarSenhaSchema, novoPinSchema, definirPinSchema,
  type Codigo2faData, type ConfirmarSenhaData, type NovoPinData, type DefinirPinData,
} from '@/lib/validations/perfil'
import {
  iniciarPinAction, confirmarIdentidadePinAction, reenviarCodigo2faAction,
  salvarPinAction, removerPinAction, cancelarPinAction,
} from '../actions'
import { Stepper, CampoComAcoes } from './modal-ativar-2fa'

export type PinModo = 'cadastrar' | 'alterar' | 'remover'

interface Props {
  open: boolean
  modo: PinModo
  /** Define se a 2ª etapa é o código do app (2FA ativo) ou o código por e-mail */
  doisFatoresAtivo: boolean
  onClose: () => void
  onConcluido: () => void
}

const TITULO: Record<PinModo, string> = {
  cadastrar: 'Cadastrar PIN de segurança',
  alterar: 'Alterar PIN de segurança',
  remover: 'Remover PIN de segurança',
}

// PIN: 1) senha  2) código (app autenticador ou e-mail)  3) novo PIN  4) confirmar PIN — ou, na remoção, 3) confirmar
export function ModalPin({ open, modo, doisFatoresAtivo, onClose, onConcluido }: Props) {
  const [step, setStep] = useState(0)
  const [metodo, setMetodo] = useState<'2fa' | 'email'>(doisFatoresAtivo ? '2fa' : 'email')
  const [email, setEmail] = useState('')
  const [avisoEnvio, setAvisoEnvio] = useState<string | null>(null)
  const [reenviando, setReenviando] = useState(false)
  const [removendo, setRemovendo] = useState(false)
  const [novoPin, setNovoPin] = useState('')

  const senhaForm = useForm<ConfirmarSenhaData>({ resolver: zodResolver(confirmarSenhaSchema) })
  const codigoForm = useForm<Codigo2faData>({ resolver: zodResolver(codigo2faSchema) })
  const pinForm = useForm<NovoPinData>({ resolver: zodResolver(novoPinSchema) })
  const confirmarForm = useForm<DefinirPinData>({ resolver: zodResolver(definirPinSchema) })

  const metodoAtual = step === 0 ? (doisFatoresAtivo ? '2fa' : 'email') : metodo
  const etapaCodigo = metodoAtual === '2fa' ? 'Código' : 'E-mail'
  const labels = modo === 'remover'
    ? ['Senha', etapaCodigo, 'Remover']
    : ['Senha', etapaCodigo, 'PIN', 'Confirmar PIN']

  function reset() {
    setStep(0)
    setAvisoEnvio(null)
    setNovoPin('')
    senhaForm.reset(); codigoForm.reset(); pinForm.reset(); confirmarForm.reset()
  }

  function handleClose() {
    if (step > 0) cancelarPinAction()
    reset()
    onClose()
  }

  function concluir(msg: string) {
    toast(msg)
    reset()
    onConcluido()
    onClose()
  }

  async function confirmarSenha(d: ConfirmarSenhaData) {
    const r = await iniciarPinAction(d)
    if ('error' in r) { senhaForm.setError('senha', { message: r.error }); return }
    setMetodo(r.metodo ?? 'email')
    setEmail(r.email ?? '')
    setAvisoEnvio(r.aviso ?? null)
    setStep(1)
  }

  async function reenviar() {
    setReenviando(true)
    await toast.promise(reenviarCodigo2faAction('pin'), {
      loading: 'Reenviando código…',
      success: 'Enviamos um novo código para o seu e-mail.',
      error: 'Não foi possível reenviar o código.',
    })
    setReenviando(false)
  }

  async function confirmarCodigo(d: Codigo2faData) {
    const r = await confirmarIdentidadePinAction(d)
    if ('error' in r) { codigoForm.setError('code', { message: r.error }); return }
    setStep(2)
  }

  function escolherPin(d: NovoPinData) {
    setNovoPin(d.pin)
    confirmarForm.reset({ pin: d.pin, confirmPin: '' })
    setStep(3)
  }

  async function salvar(d: DefinirPinData) {
    const r = await salvarPinAction({ pin: novoPin, confirmPin: d.confirmPin })
    if ('error' in r) { confirmarForm.setError('confirmPin', { message: r.error }); return }
    concluir(modo === 'cadastrar' ? 'PIN de segurança cadastrado!' : 'PIN de segurança alterado!')
  }

  async function remover() {
    setRemovendo(true)
    const r = await removerPinAction()
    setRemovendo(false)
    if ('error' in r) { toast.error(r.error ?? 'Não foi possível remover o PIN.'); return }
    concluir('PIN de segurança removido.')
  }

  const rodape = (submit: React.ReactNode) => (
    <div className="flex justify-end gap-2 pt-2">
      <Button type="button" variant="secondary" onClick={handleClose}>Cancelar</Button>
      {submit}
    </div>
  )

  // Cancelar + ação, para ficar na mesma linha do campo
  const acoes = (submit: React.ReactNode) => (
    <>
      <Button type="button" variant="secondary" onClick={handleClose}>Cancelar</Button>
      {submit}
    </>
  )

  return (
    <Modal open={open} onClose={handleClose} title={TITULO[modo]} className="sm:max-w-2xl">
      <Stepper step={step} labels={labels} />

      {/* 1. Senha */}
      {step === 0 && (
        <form onSubmit={senhaForm.handleSubmit(confirmarSenha)} className="flex flex-col gap-4">
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Para sua segurança, confirme a senha da sua conta.</p>
          <CampoComAcoes acoes={acoes(<Button type="submit" loading={senhaForm.formState.isSubmitting}>Continuar</Button>)}>
            <PasswordInput semAutocompletar label="Senha" autoComplete="current-password" autoFocus error={senhaForm.formState.errors.senha?.message} {...senhaForm.register('senha')} />
          </CampoComAcoes>
        </form>
      )}

      {/* 2. Código: do app autenticador (2FA ativo) ou do e-mail */}
      {step === 1 && (
        <form onSubmit={codigoForm.handleSubmit(confirmarCodigo)} className="flex flex-col gap-4">
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
          <CampoComAcoes codigo acoes={acoes(<Button type="submit" loading={codigoForm.formState.isSubmitting}>Confirmar</Button>)}>
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

      {/* 3. Remoção: confirmar */}
      {step === 2 && modo === 'remover' && (
        <div className="flex flex-col gap-4">
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Sem PIN, as operações que pedem confirmação ficarão indisponíveis até você cadastrar outro. Deseja remover o PIN de segurança?
          </p>
          {rodape(<Button type="button" onClick={remover} loading={removendo}>Remover PIN</Button>)}
        </div>
      )}

      {/* 3. Novo PIN */}
      {step === 2 && modo !== 'remover' && (
        <form onSubmit={pinForm.handleSubmit(escolherPin)} className="flex flex-col gap-4">
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Escolha 6 números. Evite sequências (123456) e números repetidos (111111).
          </p>
          <CampoComAcoes codigo acoes={acoes(<Button type="submit">Continuar</Button>)}>
            <Controller
              control={pinForm.control}
              name="pin"
              render={({ field }) => (
                <CodeInput label="Novo PIN" mask autoFocus value={field.value ?? ''} onChange={field.onChange} error={pinForm.formState.errors.pin?.message} />
              )}
            />
          </CampoComAcoes>
        </form>
      )}

      {/* 4. Confirmar PIN */}
      {step === 3 && (
        <form onSubmit={confirmarForm.handleSubmit(salvar)} className="flex flex-col gap-4">
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Digite o PIN novamente para confirmar.</p>
          <CampoComAcoes
            codigo
            acoes={acoes(<Button type="submit" loading={confirmarForm.formState.isSubmitting}>{modo === 'cadastrar' ? 'Cadastrar PIN' : 'Salvar PIN'}</Button>)}
          >
            <Controller
              control={confirmarForm.control}
              name="confirmPin"
              render={({ field }) => (
                <CodeInput label="Confirmar PIN" mask autoFocus value={field.value ?? ''} onChange={field.onChange} error={confirmarForm.formState.errors.confirmPin?.message} />
              )}
            />
          </CampoComAcoes>
          <button type="button" onClick={() => setStep(2)} className="self-start text-xs font-medium hover:underline cursor-pointer" style={{ color: 'var(--color-brand)' }}>
            ← Voltar e escolher outro PIN
          </button>
        </form>
      )}
    </Modal>
  )
}
