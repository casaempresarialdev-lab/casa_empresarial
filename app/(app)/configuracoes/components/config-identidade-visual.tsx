'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { DEFAULT_BRAND_COLOR, hexToHsl, hslToHex } from '@/lib/theme'
import { trimImage } from '@/lib/image-trim'
import { updateIdentidadeVisualAction } from '../actions'

const MAX_FILE_BYTES = 5 * 1024 * 1024

// Mesmo visual dos cards do dashboard, sem o efeito de subir (não é clicável)
const PANEL_CLASS =
  'animate-enter bg-white rounded-2xl border p-6 border-[var(--color-card-border)] shadow-[0_4px_16px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.06)]'

interface Props {
  companyId: string
  logoUrl: string | null
  logoReduzidaUrl: string | null
  /** false enquanto a coluna logo_reduzida_url não existe no banco */
  logoReduzidaDisponivel: boolean
  iconeUrl: string | null
  /** false enquanto a coluna icone_url não existe no banco */
  iconeDisponivel: boolean
  corPrimaria: string | null
  corFundo: string | null
  /** false enquanto a coluna cor_fundo não existe no banco */
  corFundoDisponivel: boolean
}

const DEFAULT_BG_COLOR = '#FFFFFF'

type LogoState = { preview: string | null; file: File | null; remove: boolean }

const COLOR_FORMATS = ['hex', 'rgb', 'hsl'] as const
type ColorFormat = (typeof COLOR_FORMATS)[number]

/** #RRGGBB → texto no formato: "A88E5D" | "168, 142, 93" | "39, 31%, 51%" */
function formatColor(hex: string, format: ColorFormat): string {
  if (format === 'hex') return hex.replace('#', '').toUpperCase()
  if (format === 'rgb') {
    return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ')
  }
  const [h, s, l] = hexToHsl(hex)
  return `${h}, ${s}%, ${l}%`
}

/** Texto no formato → #RRGGBB, ou null se ainda incompleto/ inválido */
function parseColor(value: string, format: ColorFormat): string | null {
  if (format === 'hex') return /^[0-9A-F]{6}$/.test(value) ? `#${value}` : null
  const nums = value.match(/\d+(\.\d+)?/g)?.map(Number)
  if (!nums || nums.length !== 3) return null
  if (format === 'rgb') {
    if (nums.some((n) => n > 255)) return null
    return `#${nums.map((n) => Math.round(n).toString(16).padStart(2, '0')).join('').toUpperCase()}`
  }
  const [h, s, l] = nums
  if (h > 360 || s > 100 || l > 100) return null
  return hslToHex(h, s, l).toUpperCase()
}

// Ícone: precisa ser PNG e ter pixels transparentes (o servidor confere de novo)
async function validateTransparentPng(file: File): Promise<string | null> {
  if (file.type !== 'image/png') return 'O ícone precisa ser um arquivo PNG.'
  try {
    const bitmap = await createImageBitmap(file)
    const size = 128
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(bitmap, 0, 0, size, size)
    const { data } = ctx.getImageData(0, 0, size, size)
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 250) return null
    }
    return 'O ícone precisa ter fundo transparente. Esta imagem não tem nenhuma área transparente.'
  } catch {
    return 'Não foi possível ler a imagem.'
  }
}

export function ConfigIdentidadeVisual({
  companyId, logoUrl, logoReduzidaUrl, logoReduzidaDisponivel, iconeUrl, iconeDisponivel,
  corPrimaria, corFundo: corFundoInicial, corFundoDisponivel,
}: Props) {
  const router = useRouter()

  const [logo, setLogo] = useState<LogoState>({ preview: logoUrl, file: null, remove: false })
  const [logoReduzida, setLogoReduzida] = useState<LogoState>({ preview: logoReduzidaUrl, file: null, remove: false })
  const [icone, setIcone] = useState<LogoState>({ preview: iconeUrl, file: null, remove: false })
  const [corAtual, setCorAtual] = useState(corPrimaria ?? DEFAULT_BRAND_COLOR)
  const [corFundo, setCorFundo] = useState(corFundoInicial ?? DEFAULT_BG_COLOR)
  const [loading, setLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setSuccessMsg(null)
    setError(null)

    const fd = new FormData()
    fd.set('cor_primaria', corAtual)
    if (corFundoDisponivel) fd.set('cor_fundo', corFundo)
    if (logo.remove) fd.set('remove_logo', 'true')
    if (logo.file) fd.set('logo_file', logo.file)
    if (logoReduzida.remove) fd.set('remove_logo_reduzida', 'true')
    if (logoReduzida.file) fd.set('logo_reduzida_file', logoReduzida.file)
    if (icone.remove) fd.set('remove_icone', 'true')
    if (icone.file) fd.set('icone_file', icone.file)

    const result = await updateIdentidadeVisualAction(companyId, fd)
    setLoading(false)

    if ('error' in result && result.error) {
      setError(result.error)
    } else {
      setSuccessMsg('Identidade visual salva! O sistema já está usando as novas configurações.')
      setLogo((l) => ({ ...l, file: null, remove: false }))
      setLogoReduzida((l) => ({ ...l, file: null, remove: false }))
      setIcone((l) => ({ ...l, file: null, remove: false }))
      router.refresh()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className={`${PANEL_CLASS} flex flex-col gap-6`} style={{ animationDelay: '100ms' }}>
      <div>
        <h2 className="text-sm font-medium" style={{ color: 'var(--color-sidebar-text)' }}>
          Identidade visual
        </h2>
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
          As cores valem para os destaques e o fundo das telas, o ícone para o carregamento e a aba do navegador, e as logos para o topo do menu lateral.
        </p>
      </div>

      {/* Cores, ícone e logos. Telas largas: uma linha (10% / 10% / 20% / 30% / 30%).
          Médias: cores + ícone em cima, logos embaixo. Celular: empilhado. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-[1fr_1fr_2fr_3fr_3fr] gap-6">
        <ColorField
          label="Cor principal"
          hint="Destaques do sistema."
          value={corAtual}
          defaultColor={DEFAULT_BRAND_COLOR}
          onChange={setCorAtual}
        />
        <ColorField
          label="Cor de fundo"
          hint="Fundo das telas."
          value={corFundo}
          defaultColor={DEFAULT_BG_COLOR}
          onChange={setCorFundo}
          disabledReason={corFundoDisponivel ? undefined : 'Indisponível até a atualização do banco de dados ser aplicada.'}
        />

        <div className="min-w-0 sm:col-span-2 xl:col-span-1">
          <LogoUpload
            label="Ícone"
            hint="Carregamento e aba do navegador."
            state={icone}
            onChange={setIcone}
            onError={setError}
            previewClass="w-14 h-14"
            accept="image/png"
            formats="Só PNG com fundo transparente · até 5 MB"
            validate={validateTransparentPng}
            checkerboard
            disabledReason={iconeDisponivel ? undefined : 'Indisponível até a atualização do banco de dados ser aplicada.'}
          />
        </div>
        <div className="min-w-0 md:col-span-2 xl:col-span-1">
          <LogoUpload
            label="Logo completa"
            hint="Menu lateral aberto. Formato horizontal."
            state={logo}
            onChange={setLogo}
            onError={setError}
            previewClass="max-h-20 max-w-[85%]"
          />
        </div>
        <div className="min-w-0 md:col-span-2 xl:col-span-1">
          <LogoUpload
            label="Logo reduzida"
            hint="Menu lateral recolhido. Símbolo, formato quadrado."
            state={logoReduzida}
            onChange={setLogoReduzida}
            onError={setError}
            previewClass="w-14 h-14"
            disabledReason={logoReduzidaDisponivel ? undefined : 'Indisponível até a atualização do banco de dados ser aplicada.'}
          />
        </div>
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
        <Button type="submit" loading={loading} style={{ backgroundColor: corAtual, color: '#fff' }}>
          Salvar
        </Button>
      </div>
      </div>

      {/* Prévia ao vivo, em caixa própria */}
      <div className={PANEL_CLASS} style={{ animationDelay: '200ms' }}>
        <ColorPreview color={corAtual} background={corFundo} icon={icone.preview} />
      </div>
    </form>
  )
}

interface ColorFieldProps {
  label: string
  hint: string
  value: string
  defaultColor: string
  onChange: (hex: string) => void
  disabledReason?: string
}

// Quadrado grande clicável + código em HEX, RGB ou HSL (a cor é sempre salva em HEX)
function ColorField({ label, hint, value, defaultColor, onChange, disabledReason }: ColorFieldProps) {
  const [formato, setFormato] = useState<ColorFormat>('hex')
  // Texto do campo no formato escolhido (pode estar incompleto enquanto a pessoa digita)
  const [texto, setTexto] = useState(formatColor(value, 'hex'))
  const disabled = !!disabledReason

  return (
    <div className="flex flex-col gap-2 min-w-0">
      <div>
        <p className="text-sm font-medium" style={{ color: 'var(--color-sidebar-text)' }}>{label}</p>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{hint}</p>
      </div>

      <label
        className={`relative h-32 rounded-xl border transition-shadow ${disabled ? 'opacity-50' : 'cursor-pointer hover:shadow-md'}`}
        style={{ backgroundColor: value, borderColor: 'var(--color-card-border-hover)' }}
        title={disabled ? undefined : 'Clique para abrir o seletor de cor'}
      >
        <input
          type="color"
          disabled={disabled}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-default"
          value={value.toLowerCase()}
          onChange={(e) => { onChange(e.target.value); setTexto(formatColor(e.target.value, formato)) }}
        />
      </label>

      {disabled ? (
        <p className="text-xs" style={{ color: 'var(--color-warning)' }}>{disabledReason}</p>
      ) : (
        <>
          <div className="flex rounded-lg border overflow-hidden text-[10px] font-semibold" style={{ borderColor: 'var(--color-card-border)' }}>
            {COLOR_FORMATS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => { setFormato(f); setTexto(formatColor(value, f)) }}
                className="flex-1 py-1 cursor-pointer transition-colors"
                style={formato === f
                  ? { backgroundColor: 'var(--color-sidebar-text)', color: '#fff' }
                  : { backgroundColor: '#fff', color: 'var(--color-sidebar-text)' }}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="flex items-center rounded-lg border overflow-hidden h-10 bg-white" style={{ borderColor: 'var(--color-card-border)' }}>
            {formato === 'hex' && (
              <span className="pl-2 pr-0.5 text-xs font-mono select-none" style={{ color: 'var(--color-text-muted)' }}>#</span>
            )}
            <input
              type="text"
              value={texto}
              onChange={(e) => {
                const raw = formato === 'hex'
                  ? e.target.value.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6).toUpperCase()
                  : e.target.value
                setTexto(raw)
                // Só aplica quando o valor está completo e válido
                const hex = parseColor(raw, formato)
                if (hex) onChange(hex)
              }}
              onBlur={() => setTexto(formatColor(value, formato))}
              onFocus={(e) => e.target.select()}
              placeholder={formatColor(defaultColor, formato)}
              className={`flex-1 min-w-0 h-full bg-white focus:outline-none text-xs font-mono pr-2 ${formato === 'hex' ? '' : 'pl-2'}`}
              style={{ color: 'var(--color-text-primary)' }}
              aria-label={`${label} em ${formato.toUpperCase()}`}
            />
          </div>
        </>
      )}
    </div>
  )
}

interface LogoUploadProps {
  label: string
  hint: string
  state: LogoState
  onChange: (s: LogoState) => void
  onError: (msg: string | null) => void
  previewClass: string
  accept?: string
  formats?: string
  /** Validação extra do arquivo; devolve a mensagem de erro ou null */
  validate?: (file: File) => Promise<string | null>
  /** Fundo xadrez na prévia, para mostrar a transparência */
  checkerboard?: boolean
  disabledReason?: string
}

const CHECKERBOARD_STYLE = {
  backgroundColor: '#fff',
  backgroundImage:
    'linear-gradient(45deg, #E5E5E5 25%, transparent 25%), linear-gradient(-45deg, #E5E5E5 25%, transparent 25%),' +
    'linear-gradient(45deg, transparent 75%, #E5E5E5 75%), linear-gradient(-45deg, transparent 75%, #E5E5E5 75%)',
  backgroundSize: '16px 16px',
  backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0',
}

function LogoUpload({
  label, hint, state, onChange, onError, previewClass,
  accept = 'image/png,image/jpeg,image/webp,image/svg+xml',
  formats = 'PNG, JPG, WEBP ou SVG · até 5 MB',
  validate, checkerboard, disabledReason,
}: LogoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const disabled = !!disabledReason

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target
    const file = input.files?.[0]
    if (!file) return
    const problem = file.size > MAX_FILE_BYTES ? `A imagem "${file.name}" passa de 5 MB.` : await validate?.(file)
    if (problem) {
      onError(problem)
      input.value = ''
      return
    }
    onError(null)
    // Corta as margens vazias para o desenho ocupar o espaço no menu e no pré-loader
    let processed = file
    try {
      processed = await trimImage(file)
    } catch {
      // Se não der para processar, envia o arquivo como veio
    }
    onChange({ preview: URL.createObjectURL(processed), file: processed, remove: false })
  }

  function handleRemove() {
    onChange({ preview: null, file: null, remove: true })
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="flex flex-col gap-2">
      <div>
        <p className="text-sm font-medium" style={{ color: 'var(--color-sidebar-text)' }}>{label}</p>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{hint}</p>
      </div>

      {/* Prévia em fundo branco, como no menu lateral (ou xadrez, para mostrar transparência) */}
      <div
        className="h-32 rounded-xl border border-dashed flex items-center justify-center bg-white"
        style={{ borderColor: 'var(--color-card-border-hover)', opacity: disabled ? 0.5 : 1, ...(checkerboard ? CHECKERBOARD_STYLE : {}) }}
      >
        {state.preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={state.preview} alt={`Prévia — ${label}`} className={`object-contain ${previewClass}`} />
        ) : (
          <span className="flex flex-col items-center gap-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            <Icon name="camera" size={22} />
            Nenhuma imagem
          </span>
        )}
      </div>

      {disabled ? (
        <p className="text-xs" style={{ color: 'var(--color-warning)' }}>{disabledReason}</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-3">
            <label
              className="cursor-pointer text-sm px-4 py-2 rounded-lg border transition-colors hover:bg-gray-50"
              style={{ borderColor: 'var(--color-card-border)', color: 'var(--color-sidebar-text)' }}
            >
              {state.preview ? 'Trocar imagem' : 'Selecionar imagem'}
              <input
                ref={inputRef}
                type="file"
                accept={accept}
                className="hidden"
                onChange={handleFile}
              />
            </label>
            {state.preview && (
              <button type="button" onClick={handleRemove} className="text-sm hover:underline cursor-pointer" style={{ color: 'var(--color-text-muted)' }}>
                Remover
              </button>
            )}
          </div>
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{formats}</span>
        </div>
      )}
    </div>
  )
}

const DEFAULT_ICON = '/logo-casa-empresarial-reduzida.svg'

function PreviewLabel({ title, description }: { title: string; description: string }) {
  return (
    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
      <span className="font-semibold" style={{ color: 'var(--color-sidebar-text)' }}>{title}</span> · {description}
    </p>
  )
}

// Amostra de onde a cor e o ícone aparecem: aba do navegador (favicon), pré-loader e destaques do sistema
function ColorPreview({ color, background, icon }: { color: string; background: string; icon: string | null }) {
  const iconSrc = icon || DEFAULT_ICON
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium" style={{ color: 'var(--color-sidebar-text)' }}>Prévia</p>

      <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-4">
        {/* Navegador: aba com o favicon + barra de endereço */}
        <div className="flex flex-col gap-1.5 min-w-0">
        <PreviewLabel title="Favicon" description="Ícone na aba do navegador" />
        <div className="flex-1 rounded-xl border overflow-hidden bg-white" style={{ borderColor: 'var(--color-card-border)' }}>
          <div className="flex items-end gap-2 px-3 pt-2" style={{ backgroundColor: '#E8EAED' }}>
            <span className="flex gap-1.5 pb-3 pr-1" aria-hidden="true">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#28C840]" />
            </span>
            <span className="flex items-center gap-2 h-8 px-3 rounded-t-lg bg-white min-w-0 max-w-64">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={iconSrc} alt="Favicon" className="w-4 h-4 object-contain shrink-0" />
              <span className="text-xs truncate" style={{ color: 'var(--color-text-primary)' }}>Visão geral · Casa Empresarial</span>
              <span className="text-xs ml-2" style={{ color: 'var(--color-text-muted)' }} aria-hidden="true">✕</span>
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: 'var(--color-card-border)' }}>
            <span className="text-sm" style={{ color: 'var(--color-text-muted)' }} aria-hidden="true">← → ⟳</span>
            <span className="flex-1 flex items-center gap-2 h-8 px-3 rounded-full text-xs" style={{ backgroundColor: '#F1F3F4', color: 'var(--color-text-secondary)' }}>
              🔒 casaempresarial.app/dashboard
            </span>
          </div>
          <div className="h-16" />
        </div>
        </div>

        {/* Pré-loader: o mesmo círculo da troca de páginas */}
        <div className="flex flex-col gap-1.5 min-w-0">
          <PreviewLabel title="Pré-loader" description="Carregamento entre as páginas" />
          <div
            className="flex-1 rounded-xl border flex items-center justify-center py-5 bg-white"
            style={{ borderColor: 'var(--color-card-border)' }}
          >
            <div
              className="w-20 h-20 rounded-full bg-white border shadow-md flex items-center justify-center"
              style={{ borderColor: 'var(--color-card-border)' }}
            >
              <div className="page-loader-logo w-10 h-10" style={{ backgroundImage: `url("${iconSrc}")` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Miniatura da tela: fundo escolhido com menu lateral e cards brancos por cima */}
      <PreviewLabel title="Cor de fundo" description="Fundo das telas, atrás do menu lateral e dos cards" />
      <div
        className="-mt-0.5 rounded-xl border p-3 flex gap-3 h-40"
        style={{ borderColor: 'var(--color-card-border)', backgroundColor: background }}
      >
        <div
          className="w-1/5 min-w-20 rounded-lg bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-2 flex flex-col gap-1.5"
          style={{ borderLeft: `3px solid ${color}` }}
        >
          <span className="h-2.5 w-3/4 rounded-full" style={{ backgroundColor: color }} />
          <span className="h-5 mt-1 rounded-md" style={{ backgroundColor: color }} />
          <span className="h-2 w-2/3 rounded-full bg-gray-200" />
          <span className="h-2 w-1/2 rounded-full bg-gray-200" />
          <span className="h-2 w-3/5 rounded-full bg-gray-200" />
        </div>
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          <span className="text-sm font-extrabold truncate" style={{ fontFamily: 'Manrope', color }}>Olá! Bem-vindo(a) à sua casa.</span>
          <div className="flex-1 grid grid-cols-2 gap-3">
            {[0, 1].map((i) => (
              <div key={i} className="rounded-lg bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-2 flex flex-col gap-1.5">
                <span className="h-2 w-1/3 rounded-full bg-gray-200" />
                <span className="h-3.5 w-1/2 rounded" style={{ backgroundColor: 'var(--color-text-primary)', opacity: 0.8 }} />
                <span className="h-2 w-2/3 rounded-full bg-gray-200" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <PreviewLabel title="Cor principal" description="Títulos, item ativo do menu, links, botões e borda do menu lateral" />
      <div
        className="-mt-0.5 rounded-xl border p-5 flex flex-wrap items-center gap-6 bg-white"
        style={{ borderColor: 'var(--color-card-border)', borderLeft: `3px solid ${color}` }}
      >
        <span className="text-xl font-extrabold" style={{ fontFamily: 'Manrope', color }}>
          Olá! Bem-vindo(a).
        </span>
        <span
          className="flex items-center gap-2 px-3 h-10 rounded-xl text-sm font-bold text-white"
          style={{ fontFamily: 'Manrope', backgroundColor: color }}
        >
          <Icon name="grid" size={16} />
          Visão geral
        </span>
        <span className="text-xs font-semibold" style={{ color }}>Ver todos →</span>
        <span className="h-9 px-4 rounded-lg text-sm font-medium text-white flex items-center" style={{ backgroundColor: color }}>
          Botão
        </span>
      </div>
    </div>
  )
}
