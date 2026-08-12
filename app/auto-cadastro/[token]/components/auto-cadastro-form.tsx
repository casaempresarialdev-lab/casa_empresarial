'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { submitOnboardingAction } from '../actions'

const GRAU_OPTIONS = [
  'Fundamental Incompleto', 'Fundamental Completo', 'Médio Incompleto', 'Médio Completo',
  'Técnico', 'Superior Incompleto', 'Superior Completo', 'Pós-graduação', 'Mestrado', 'Doutorado',
]

const DOC_SLOTS = [
  { key: 'rg_cnh_frente',          label: 'RG Frente / CNH',            accept: 'image/*,application/pdf' },
  { key: 'rg_verso',               label: 'RG Verso (opcional)',         accept: 'image/*,application/pdf' },
  { key: 'exame_admissional',       label: 'Exame Admissional',          accept: 'image/*,application/pdf' },
  { key: 'cpf',                    label: 'CPF',                        accept: 'image/*,application/pdf' },
  { key: 'comprovante_residencia', label: 'Comprovante de Residência',   accept: 'image/*,application/pdf' },
  { key: 'titulo_eleitor',         label: 'Título de Eleitor',          accept: 'image/*,application/pdf' },
  { key: 'ctps',                   label: 'Carteira de Trabalho',       accept: 'image/*,application/pdf' },
  { key: 'pis',                    label: 'PIS',                        accept: 'image/*,application/pdf' },
  { key: 'certidao',               label: 'Certidão Nasc./Casamento',   accept: 'image/*,application/pdf' },
] as const

function formatCpf(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

interface Props {
  token: string
  employeeName: string
  companyName: string
}

export function AutoCadastroForm({ token, employeeName, companyName }: Props) {
  const firstName = employeeName.split(' ')[0]

  const [cpf, setCpf]                   = useState('')
  const [rg, setRg]                     = useState('')
  const [nascimento, setNascimento]     = useState('')
  const [telefone, setTelefone]         = useState('')
  const [email, setEmail]               = useState('')
  const [grauInstrucao, setGrau]        = useState('')
  const [dependentes, setDependentes]   = useState('0')
  const [pisPasep, setPisPasep]         = useState('')
  const [serieCtps, setSerieCtps]       = useState('')
  const [certReservista, setCertReservista] = useState('')
  const [dadosBancarios, setDadosBancarios] = useState('')
  const [fotoFile, setFotoFile]         = useState<File | null>(null)
  const [fotoPreview, setFotoPreview]   = useState<string | null>(null)
  const [docFiles, setDocFiles]         = useState<Record<string, File | null>>({})
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState('')
  const [success, setSuccess]           = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const fd = new FormData()
    fd.set('cpf', cpf)
    fd.set('rg', rg)
    fd.set('nascimento', nascimento)
    fd.set('telefone', telefone)
    fd.set('email', email)
    fd.set('grau_instrucao', grauInstrucao)
    fd.set('dependentes', dependentes)
    fd.set('pis_pasep', pisPasep)
    fd.set('serie_ctps', serieCtps)
    fd.set('certificado_reservista', certReservista)
    fd.set('dados_bancarios', dadosBancarios)
    if (fotoFile) fd.set('doc_foto', fotoFile)
    for (const slot of DOC_SLOTS) {
      const file = docFiles[slot.key]
      if (file) fd.set(`doc_${slot.key}`, file)
    }

    const result = await submitOnboardingAction(token, fd)
    setLoading(false)
    if ('error' in result && result.error) { setError(result.error); return }
    setSuccess(true)
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-4xl mx-auto mb-5"
            style={{ backgroundColor: '#D5F5E3' }}
          >
            ✅
          </div>
          <h2 className="text-xl font-bold mb-2" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
            Dados enviados!
          </h2>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Obrigado, {firstName}! Suas informações foram recebidas com sucesso pela equipe de {companyName}.
          </p>
        </div>
      </div>
    )
  }

  const lbl: React.CSSProperties = {
    color: 'var(--color-text-secondary)',
    fontSize: '0.75rem',
    fontWeight: 500,
    marginBottom: 4,
    display: 'block',
  }
  const sec: React.CSSProperties = {
    color: 'var(--color-primary-darker)',
    fontSize: '0.75rem',
    fontWeight: 700,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottom: '1px solid var(--color-bg-surface)',
    letterSpacing: '0.05em',
  }
  const card: React.CSSProperties = {
    backgroundColor: 'white',
    borderRadius: '0.75rem',
    border: '1px solid var(--color-bg-surface)',
    padding: '1.5rem',
  }

  return (
    <div className="min-h-screen px-4 py-8" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
            Seus Dados de Admissão
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            {companyName} · {employeeName}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Preencha seus dados pessoais e faça upload dos documentos solicitados.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">

            {/* Foto de perfil */}
            <div style={card}>
              <p style={sec}>FOTO DE PERFIL</p>
              <div className="flex items-center gap-5">
                <div className="relative shrink-0">
                  <div
                    className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center"
                    style={{
                      backgroundColor: fotoPreview ? 'transparent' : 'var(--color-bg-surface)',
                      border: '2px solid var(--color-bg-surface)',
                    }}
                  >
                    {fotoPreview
                      ? <img src={fotoPreview} alt="Foto" className="w-full h-full object-cover" />
                      : <span className="text-3xl">👤</span>
                    }
                  </div>
                  <label
                    className="absolute bottom-0 right-0 w-6 h-6 rounded-full flex items-center justify-center cursor-pointer text-white text-xs"
                    style={{ backgroundColor: 'var(--color-primary-dark)' }}
                  >
                    ✏️
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0]
                        if (f) { setFotoFile(f); setFotoPreview(URL.createObjectURL(f)) }
                        e.target.value = ''
                      }}
                    />
                  </label>
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    {fotoPreview ? 'Foto selecionada' : 'Sem foto'}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                    Clique no lápis para selecionar uma imagem
                  </p>
                  {fotoPreview && (
                    <button
                      type="button"
                      onClick={() => { setFotoFile(null); setFotoPreview(null) }}
                      className="text-xs mt-1.5"
                      style={{ color: 'var(--color-error)' }}
                    >
                      Remover foto
                    </button>
                  )}
                </div>
              </div>
            </div>

          {/* 1 — Dados Pessoais */}
            <div style={card}>
              <p style={sec}>1. DADOS PESSOAIS</p>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label style={lbl}>CPF</label>
                    <Input value={cpf} onChange={e => setCpf(formatCpf(e.target.value))} placeholder="000.000.000-00" />
                  </div>
                  <div>
                    <label style={lbl}>RG</label>
                    <Input value={rg} onChange={e => setRg(e.target.value)} placeholder="RG" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label style={lbl}>Data de Nascimento</label>
                    <Input type="date" value={nascimento} onChange={e => setNascimento(e.target.value)} />
                  </div>
                  <div>
                    <label style={lbl}>Telefone / WhatsApp</label>
                    <Input value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(21) 99999-0000" />
                  </div>
                </div>
                <div>
                  <label style={lbl}>E-mail</label>
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label style={lbl}>Grau de Instrução</label>
                    <select
                      value={grauInstrucao}
                      onChange={e => setGrau(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border text-sm"
                      style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                    >
                      <option value="">Selecionar...</option>
                      {GRAU_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Dependentes (IR)</label>
                    <Input type="number" min={0} value={dependentes} onChange={e => setDependentes(e.target.value)} placeholder="0" />
                  </div>
                </div>
              </div>
            </div>

            {/* 2 — Dados Complementares */}
            <div style={card}>
              <p style={sec}>2. DADOS COMPLEMENTARES</p>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label style={lbl}>PIS / PASEP</label>
                    <Input value={pisPasep} onChange={e => setPisPasep(e.target.value)} placeholder="000.00000.00-0" />
                  </div>
                  <div>
                    <label style={lbl}>Série da CTPS</label>
                    <Input value={serieCtps} onChange={e => setSerieCtps(e.target.value)} placeholder="Ex: 001" />
                  </div>
                </div>
                <div>
                  <label style={lbl}>Certificado de Reservista</label>
                  <Input value={certReservista} onChange={e => setCertReservista(e.target.value)} placeholder="Nº / categoria" />
                </div>
                <div>
                  <label style={lbl}>Dados Bancários</label>
                  <textarea
                    value={dadosBancarios}
                    onChange={e => setDadosBancarios(e.target.value)}
                    placeholder="Banco, agência, conta corrente e/ou chave PIX"
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border text-sm resize-none"
                    style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                  />
                </div>
              </div>
            </div>

            {/* 3 — Documentos */}
            <div style={card}>
              <p style={sec}>3. DOCUMENTOS</p>
              <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
                Todos os campos são opcionais. Aceita imagens (JPG, PNG) e PDF até 20 MB.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {DOC_SLOTS.map(slot => {
                  const file = docFiles[slot.key] ?? null
                  const isImage = file?.type.startsWith('image/')
                  const preview = isImage ? URL.createObjectURL(file!) : null
                  return (
                    <div
                      key={slot.key}
                      className="border rounded-xl p-3 text-center flex flex-col items-center gap-2"
                      style={{
                        borderColor: file ? 'var(--color-primary-dark)' : 'var(--color-bg-surface)',
                        backgroundColor: file ? 'var(--color-primary)' : 'white',
                        minHeight: 120,
                      }}
                    >
                      <p className="text-xs font-medium leading-tight" style={{ color: 'var(--color-text-secondary)' }}>
                        {slot.label}
                      </p>
                      {file ? (
                        <>
                          {preview
                            ? <img src={preview} alt={slot.label} className="w-14 h-14 object-cover rounded-lg border" />
                            : (
                              <div
                                className="w-14 h-14 rounded-lg flex items-center justify-center text-2xl"
                                style={{ backgroundColor: 'var(--color-bg-surface)' }}
                              >
                                📄
                              </div>
                            )
                          }
                          <p className="text-xs truncate w-full" style={{ color: 'var(--color-text-muted)' }} title={file.name}>
                            {file.name}
                          </p>
                          <button
                            type="button"
                            onClick={() => setDocFiles(p => ({ ...p, [slot.key]: null }))}
                            className="text-xs px-2 py-0.5 rounded border hover:bg-red-50"
                            style={{ color: 'var(--color-error)', borderColor: 'var(--color-error)' }}
                          >
                            Remover
                          </button>
                        </>
                      ) : (
                        <label className="cursor-pointer flex flex-col items-center gap-1 flex-1 justify-center">
                          <span className="text-2xl">📎</span>
                          <span className="text-xs" style={{ color: 'var(--color-primary-darker)' }}>Selecionar</span>
                          <input
                            type="file"
                            accept={slot.accept}
                            className="hidden"
                            onChange={e => {
                              const f = e.target.files?.[0]
                              if (f) setDocFiles(p => ({ ...p, [slot.key]: f }))
                              e.target.value = ''
                            }}
                          />
                        </label>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

          </div>

          {error && (
            <p className="text-sm p-3 rounded-lg bg-red-50 mt-4" style={{ color: 'var(--color-error)' }}>
              {error}
            </p>
          )}

          <div className="flex justify-end mt-6 pb-8">
            <Button type="submit" loading={loading}>
              Enviar dados
            </Button>
          </div>

          <p className="text-xs text-center -mt-4 pb-4" style={{ color: 'var(--color-text-muted)' }}>
            Seus dados são protegidos e usados exclusivamente para fins trabalhistas.
          </p>

        </form>
      </div>
    </div>
  )
}
