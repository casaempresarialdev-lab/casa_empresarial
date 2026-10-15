'use client'

import { useRef, useState, useTransition } from 'react'
import { PasswordInput } from '@/components/ui/password-input'
import { Button } from '@/components/ui/button'
import { updateCertificadoAction } from '../actions'

interface Props {
  companyId: string
  hasCertificado: boolean
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border p-6 flex flex-col gap-4" style={{ borderColor: 'var(--color-bg-surface)' }}>
      {children}
    </div>
  )
}

export function CertificadoForm({ companyId, hasCertificado }: Props) {
  const [isPending, startTransition] = useTransition()
  const [senha, setSenha] = useState('')
  const [serverError, setServerError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const certInputRef = useRef<HTMLInputElement>(null)
  const [certName, setCertName] = useState<string | null>(hasCertificado ? 'Certificado já cadastrado' : null)

  function handleCertChange(e: React.ChangeEvent<HTMLInputElement>) {
    setCertName(e.target.files?.[0]?.name ?? null)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)
    setSuccessMsg(null)

    const formData = new FormData()
    if (senha) formData.set('certificado_digital_senha', senha)
    const certFile = certInputRef.current?.files?.[0]
    if (certFile) formData.set('certificado_file', certFile)

    startTransition(async () => {
      const result = await updateCertificadoAction(companyId, formData)
      if (result?.error) setServerError(result.error)
      else {
        setSuccessMsg('Certificado digital atualizado com sucesso!')
        setSenha('')
      }
    })
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
          Certificado Digital
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
          Arquivo e senha do certificado digital da empresa, usado para emissão de documentos fiscais.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Card>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Arquivo do certificado (.pfx / .p12)
            </label>
            <label
              className="flex items-center gap-3 cursor-pointer h-10 rounded-lg border px-3 text-sm hover:bg-gray-50 transition-colors"
              style={{ borderColor: 'var(--color-bg-surface)', color: certName ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}
            >
              <span>📎</span>
              <span className="truncate">{certName ?? 'Selecionar arquivo...'}</span>
              <input ref={certInputRef} type="file" accept=".pfx,.p12,application/x-pkcs12"
                className="hidden" onChange={handleCertChange} />
            </label>
          </div>

          <PasswordInput
            label={hasCertificado ? 'Nova senha do certificado (deixe em branco para manter)' : 'Senha do certificado digital'}
            placeholder="••••••••"
            autoComplete="off"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </Card>

        {successMsg && (
          <p className="text-sm text-center py-2 px-3 rounded-lg bg-green-50 border border-green-200 text-green-700">
            {successMsg}
          </p>
        )}
        {serverError && (
          <p className="text-sm text-center py-2 px-3 rounded-lg bg-red-50 border border-red-200" style={{ color: 'var(--color-error)' }}>
            {serverError}
          </p>
        )}

        <div className="flex justify-end pb-8">
          <Button type="submit" loading={isPending} size="lg">Salvar alterações</Button>
        </div>
      </form>
    </div>
  )
}
