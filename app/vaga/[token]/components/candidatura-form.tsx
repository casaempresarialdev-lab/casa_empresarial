'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { FileDropZone } from '@/components/ui/file-drop-zone'
import { createClient } from '@/lib/supabase/client'
import { ANEXO_ACCEPT, ANEXO_MAX_BYTES, candidaturaSchema, extensaoAnexo, type CandidaturaInput } from '@/lib/validations/vaga'
import { maskCpf, maskTelefone } from '@/app/(app)/pessoas/funcionarios/components/ficha/ficha-config'
import { concluirCandidaturaAction, iniciarCandidaturaAction } from '../actions'

export function CandidaturaForm({ token, empresa }: { token: string; empresa: string }) {
  const [anexo, setAnexo] = useState<File | null>(null)
  const [anexoInvalido, setAnexoInvalido] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [enviada, setEnviada] = useState(false)

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<CandidaturaInput>({
    resolver: zodResolver(candidaturaSchema),
    defaultValues: { nome: '', cpf: '', email: '', telefone: '', aceite: false, site: '' },
  })

  async function onSubmit(dados: CandidaturaInput) {
    setErro(null)
    if (!anexo || !extensaoAnexo(anexo.name)) {
      setAnexoInvalido(true)
      setErro(anexo ? 'Envie o anexo em PDF, Word ou imagem (JPG, PNG ou WEBP).' : 'Anexe o seu currículo.')
      return
    }

    const inicio = await iniciarCandidaturaAction(token, dados, { nome: anexo.name, tamanho: anexo.size })
    if ('error' in inicio) { setErro(inicio.error ?? 'Não foi possível enviar.'); return }
    if ('jaEnviada' in inicio) { setEnviada(true); return }

    // O anexo vai direto ao armazenamento, com a autorização recebida do servidor
    const { error: errUpload } = await createClient().storage
      .from('documentos')
      .uploadToSignedUrl(inicio.path, inicio.uploadToken, anexo, { contentType: inicio.contentType })
    if (errUpload) { setErro('Não foi possível enviar o anexo. Verifique a conexão e tente novamente.'); return }

    const fim = await concluirCandidaturaAction(token, dados, inicio.path, anexo.name)
    if ('error' in fim) { setErro(fim.error ?? 'Não foi possível enviar.'); return }
    setEnviada(true)
  }

  if (enviada) {
    return (
      <div className="py-6 flex flex-col items-center text-center gap-3">
        <span className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: '#DCFCE7', color: '#15803D' }}>
          <Icon name="check" size={28} />
        </span>
        <h3 className="text-lg font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>Candidatura recebida</h3>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Obrigado pelo interesse! Se o seu perfil avançar no processo, a {empresa} entrará em contato pelo e-mail ou telefone informados.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <Input label="Nome completo *" autoComplete="name" error={errors.nome?.message} {...register('nome')} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="CPF *"
          inputMode="numeric"
          placeholder="000.000.000-00"
          error={errors.cpf?.message}
          {...register('cpf', { onChange: (e) => setValue('cpf', maskCpf(e.target.value)) })}
        />
        <Input
          label="Telefone *"
          inputMode="tel"
          autoComplete="tel"
          placeholder="(00) 00000-0000"
          error={errors.telefone?.message}
          {...register('telefone', { onChange: (e) => setValue('telefone', maskTelefone(e.target.value)) })}
        />
      </div>
      <Input label="E-mail *" type="email" autoComplete="email" placeholder="email@exemplo.com" error={errors.email?.message} {...register('email')} />

      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Currículo *</span>
        <FileDropZone
          file={anexo}
          onFile={(f) => { setAnexo(f); setAnexoInvalido(false); setErro(null) }}
          maxBytes={ANEXO_MAX_BYTES}
          invalid={anexoInvalido}
          hint="PDF, Word ou imagem"
          accept={ANEXO_ACCEPT}
        />
      </div>

      {/* Campo escondido contra robôs: pessoas não veem nem preenchem */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', height: 0, overflow: 'hidden' }}>
        <label>Site<input type="text" tabIndex={-1} autoComplete="off" {...register('site')} /></label>
      </div>

      <div className="flex flex-col gap-1">
        <label className="flex items-start gap-2.5 text-sm cursor-pointer" style={{ color: 'var(--color-text-secondary)' }}>
          <input type="checkbox" className="mt-0.5 w-4 h-4 shrink-0" style={{ accentColor: 'var(--color-brand)' }} {...register('aceite')} />
          <span>
            Autorizo a {empresa} a usar meus dados e o arquivo enviado neste processo seletivo. Se eu não for contratado,
            eles serão guardados por até 12 meses e depois apagados.
          </span>
        </label>
        {errors.aceite && <p className="text-xs" style={{ color: 'var(--color-error)' }}>{errors.aceite.message}</p>}
      </div>

      {erro && <p className="text-sm p-3 rounded-lg bg-red-50" style={{ color: 'var(--color-error)' }} role="alert">{erro}</p>}

      <Button type="submit" size="lg" loading={isSubmitting}>Enviar candidatura</Button>
    </form>
  )
}
