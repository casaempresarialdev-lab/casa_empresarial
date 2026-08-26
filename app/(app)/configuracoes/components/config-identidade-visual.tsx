'use client'

import { useRef, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { updateIdentidadeVisualAction } from '../actions'

const COR_PRESETS = [
  '#C19A6B','#1A1A2E','#16213E','#2E86AB','#A23B72',
  '#F18F01','#2ECC71','#E74C3C','#8E44AD','#2C3E50',
]

interface Props {
  companyId: string
  logoUrl: string | null
  corPrimaria: string | null
}

export function ConfigIdentidadeVisual({ companyId, logoUrl, corPrimaria }: Props) {
  const router = useRouter()
  const logoInputRef = useRef<HTMLInputElement>(null)

  const [logoPreview, setLogoPreview] = useState<string | null>(logoUrl)
  const [removeLogo, setRemoveLogo] = useState(false)
  const [corAtual, setCorAtual] = useState(corPrimaria ?? '#C19A6B')
  const [corInput, setCorInput] = useState(corPrimaria ?? '#C19A6B')
  const [loading, setLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { setCorInput(corAtual) }, [corAtual])

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoPreview(URL.createObjectURL(file))
    setRemoveLogo(false)
  }

  function handleRemoveLogo() {
    setLogoPreview(null)
    setRemoveLogo(true)
    if (logoInputRef.current) logoInputRef.current.value = ''
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setSuccessMsg(null)
    setError(null)

    const fd = new FormData()
    fd.set('cor_primaria', corAtual)
    if (removeLogo) fd.set('remove_logo', 'true')
    const logoFile = logoInputRef.current?.files?.[0]
    if (logoFile) fd.set('logo_file', logoFile)

    const result = await updateIdentidadeVisualAction(companyId, fd)
    setLoading(false)

    if ('error' in result && result.error) {
      setError(result.error)
    } else {
      setSuccessMsg('Identidade visual salva com sucesso!')
      router.refresh()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">

      {/* Logo */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
          Logo da empresa
        </label>
        <div className="flex items-center gap-4">
          {logoPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoPreview}
              alt="Preview logo"
              className="w-16 h-16 rounded-xl object-contain border"
              style={{ borderColor: 'var(--color-bg-surface)' }}
            />
          ) : (
            <div
              className="w-16 h-16 rounded-xl border flex items-center justify-center text-2xl"
              style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'var(--color-bg-surface)' }}
            >
              🏢
            </div>
          )}
          <div className="flex items-center gap-3">
            <label
              className="cursor-pointer text-sm px-4 py-2 rounded-lg border transition-colors hover:bg-gray-50"
              style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-secondary)' }}
            >
              {logoPreview ? 'Trocar imagem' : 'Selecionar imagem'}
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={handleLogoChange}
              />
            </label>
            {logoPreview && (
              <button
                type="button"
                onClick={handleRemoveLogo}
                className="text-sm hover:underline"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Remover
              </button>
            )}
          </div>
        </div>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>PNG, JPG ou SVG — máx. 5 MB</p>
      </div>

      {/* Cor */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
          Cor da empresa
        </label>

        {/* Presets */}
        <div className="flex items-center gap-2 flex-wrap">
          {COR_PRESETS.map(cor => (
            <button
              key={cor}
              type="button"
              onClick={() => setCorAtual(cor)}
              className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
              style={{
                backgroundColor: cor,
                borderColor: corAtual === cor ? 'var(--color-text-primary)' : 'transparent',
              }}
              title={cor}
            />
          ))}
        </div>

        {/* Swatch + input hex combinados */}
        <div className="flex items-center gap-3">
          <div
            className="flex items-center rounded-lg border overflow-hidden h-9"
            style={{ borderColor: 'var(--color-bg-surface)' }}
          >
            {/* Swatch clicável */}
            <label className="relative flex-shrink-0 cursor-pointer h-full" title="Clique para abrir o seletor de cor">
              <div className="w-9 h-full" style={{ backgroundColor: corAtual }} />
              <input
                type="color"
                className="absolute inset-0 opacity-0 cursor-pointer"
                value={corAtual}
                onChange={e => setCorAtual(e.target.value)}
              />
            </label>

            {/* Divisor */}
            <div className="w-px h-full flex-shrink-0" style={{ backgroundColor: 'var(--color-bg-surface)' }} />

            {/* # fixo */}
            <span className="pl-2 pr-0.5 text-sm font-mono select-none" style={{ color: 'var(--color-text-muted)' }}>#</span>

            {/* Input hex */}
            <input
              type="text"
              value={(corInput.startsWith('#') ? corInput.slice(1) : corInput).toUpperCase()}
              onChange={e => {
                const raw = e.target.value.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6).toUpperCase()
                const withHash = '#' + raw
                setCorInput(withHash)
                if (raw.length === 6 || raw.length === 3) setCorAtual(withHash)
              }}
              onFocus={e => e.target.select()}
              maxLength={6}
              placeholder="C19A6B"
              className="h-full bg-white focus:outline-none text-sm font-mono pr-3"
              style={{ color: 'var(--color-text-primary)', width: '12ch' }}
            />
          </div>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Clique no quadrado para o seletor, ou digite o código hex
          </p>
        </div>
      </div>

      {/* Preview da cor aplicada */}
      <div
        className="rounded-xl px-4 py-3 text-sm font-medium"
        style={{ backgroundColor: corAtual + '22', color: corAtual, border: `1px solid ${corAtual}44` }}
      >
        Prévia: esta é a cor que aparecerá nos destaques do sistema
      </div>

      {successMsg && (
        <p className="text-sm py-2 px-3 rounded-lg bg-green-50 border border-green-200 text-green-700">
          {successMsg}
        </p>
      )}
      {error && (
        <p className="text-sm py-2 px-3 rounded-lg bg-red-50 border border-red-200" style={{ color: 'var(--color-error)' }}>
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" loading={loading}>
          Salvar
        </Button>
      </div>
    </form>
  )
}
