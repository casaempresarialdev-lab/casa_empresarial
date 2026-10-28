'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Button } from '@/components/ui/button'
import { FileDropZone } from '@/components/ui/file-drop-zone'
import { toast } from '@/lib/toast'
import { PinGate } from '@/components/ui/pin-gate'
import { createCertificateAction, updateCertificateAction } from '../actions'
import type { Certificate } from '../queries'

const MAX_CERT_BYTES = 5 * 1024 * 1024

interface Props {
  open: boolean
  onClose: () => void
  companyId: string
  certificate?: Certificate | null
}

export function ModalCertificado({ open, onClose, companyId, certificate }: Props) {
  const router = useRouter()
  const isEditing = !!certificate

  const [identificacao, setIdentificacao] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [senha, setSenha] = useState('')
  // Campos destacados com borda vermelha (o aviso vai no toast)
  const [invalid, setInvalid] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  // Edição: PIN conferido na etapa inicial (enviado de novo ao salvar, o servidor confere outra vez)
  const [pin, setPin] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setIdentificacao(certificate?.identificacao ?? '')
      setFile(null)
      setSenha('')
      setInvalid(new Set())
      setPin(null)
    }
  }, [open, certificate])

  function clearInvalid(name: string) {
    setInvalid((prev) => {
      if (!prev.has(name)) return prev
      const next = new Set(prev)
      next.delete(name)
      return next
    })
  }

  function handleFile(f: File) {
    const ext = f.name.split('.').pop()?.toLowerCase()
    if (ext !== 'pfx' && ext !== 'p12') {
      toast.error('O certificado precisa ser um arquivo .pfx ou .p12.')
      return
    }
    setFile(f)
    clearInvalid('file')
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const vazios = [
      ...(!identificacao.trim() ? ['identificacao'] : []),
      ...(!isEditing && !file ? ['file'] : []),
    ]
    if (vazios.length) {
      setInvalid(new Set(vazios))
      toast.error('Preencha todos os campos obrigatórios.')
      return
    }
    setInvalid(new Set())

    const fd = new FormData()
    fd.set('identificacao', identificacao)
    if (file) fd.set('certificado_file', file)
    if (senha.trim()) fd.set('senha', senha)

    setLoading(true)
    // Resultado do servidor no toast (✓ / ✕); com erro, o modal continua aberto
    const result = await toast.promise(
      isEditing ? updateCertificateAction(certificate!.id, companyId, fd, pin ?? '') : createCertificateAction(companyId, fd),
      {
        loading: isEditing ? 'Salvando certificado…' : 'Enviando certificado…',
        success: isEditing ? `${identificacao} foi atualizado.` : `${identificacao} foi adicionado aos certificados.`,
        error: 'Não foi possível salvar o certificado.',
      },
    )
    setLoading(false)
    if (!('error' in result)) {
      onClose()
      router.refresh()
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? 'Editar certificado' : 'Novo certificado'}
      description={isEditing ? certificate?.nome_arquivo : 'Envie o arquivo .pfx / .p12 e a senha do certificado'}
      className="sm:max-w-2xl"
    >
      {/* Edição: primeiro o PIN, depois desliza para o formulário */}
      <PinGate
        ativo={isEditing}
        pin={pin}
        onLiberado={setPin}
        descricao={<>Informe o seu PIN de segurança para editar o certificado <strong style={{ color: 'var(--color-text-primary)' }}>{certificate?.identificacao}</strong>.</>}
      >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <Input
          label="Identificação *"
          placeholder="Ex: e-CNPJ A1 2026, Certificado do sócio João"
          value={identificacao}
          onChange={(e) => { setIdentificacao(e.target.value); clearInvalid('identificacao') }}
          invalid={invalid.has('identificacao')}
        />

        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            {isEditing ? 'Arquivo do certificado (envie para substituir)' : 'Arquivo do certificado *'}
          </p>
          <FileDropZone
            file={file}
            onFile={handleFile}
            maxBytes={MAX_CERT_BYTES}
            invalid={invalid.has('file')}
            accept=".pfx,.p12,application/x-pkcs12"
            hint="Arquivo .pfx ou .p12"
          />
        </div>

        <PasswordInput
          label={isEditing ? 'Nova senha (deixe em branco para manter)' : 'Senha do certificado'}
          placeholder="••••••••"
          autoComplete="new-password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading}>{isEditing ? 'Salvar' : 'Adicionar'}</Button>
        </div>
      </form>
      </PinGate>
    </Modal>
  )
}
