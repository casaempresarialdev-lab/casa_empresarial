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
  { key: 'foto',                   label: 'Foto',                       accept: 'image/*' },
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

  // 1 — Dados Pessoais
  const [cpf, setCpf]                 = useState('')
  const [rg, setRg]                   = useState('')
  const [nascimento, setNascimento]   = useState('')
  const [telefone, setTelefone]       = useState('')
  const [email, setEmail]             = useState('')
  const [grauInstrucao, setGrau]      = useState('')
  const [dependentes, setDependentes] = useState('0')

  // 2 — Dados Complementares
  const [pisPasep, setPisPasep]                     = useState('')
  const [serieCtps, setSerieCtps]                   = useState('')
  const [certReservista, setCertReservista]         = useState('')
  const [dadosBancarios, setDadosBancarios]         = useState('')

  // 3 — Documentos
  const [docFiles, setDocFiles] = useState<Record<string, File | null>>({})

  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState(false)

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
          <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl mx-auto mb-5"
            style={{ backgroundColor: '#E9F7EF' }}>
            ✅
          </div>
          <h2 className="text-2xl font-bold mb-3" style={{ fontFamily: 'Manrope', color: '#1F2937' }}>
            Dados enviados!
          </h2>
          <p className="text-sm" style={{ color: '#6B7280' }}>
            Obrigado, {firstName}! Suas informações foram recebidas com sucesso pela equipe de {companyName}.
          </p>
        </div>
      </div>
    )
  }

  const lbl: React.CSSProperties = { color: '#4B5563', fontSize: '0.75rem', fontWeight: 500, marginBottom: 4, display: 'block' }
  const sec: React.CSSProperties = { color: '#1F2937', fontSize: '0.7rem', fontWeight: 700, marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #E5E7EB', letterSpacing: '0.06em' }
  const card: React.CSSProperties = { backgroundColor: 'white', borderRadius: '0.75rem', border: '1px solid #E5E7EB', padding: '1.25rem', marginBottom: '1rem' }

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-lg mx-auto">

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3"
            style={{ backgroundColor: '#EBF5FB' }}>
            <span className="text-2xl">📋</span>
          </div>
          <h1 className="text-xl font-bold" style={{ fontFamily: 'Manrope', color: '#1F2937' }}>
            Seus Dados de Admissão
          </h1>
          <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
            {companyName} · {employeeName}
          </p>
          <p className="text-xs mt-2 px-4" style={{ color: '#9CA3AF' }}>
            Preencha seus dados pessoais e faça upload dos documentos solicitados.
          </p>
        </div>

        <form onSubmit={handleSubmit}>

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
              <div>
                <label style={lbl}>Data de Nascimento</label>
                <Input type="date" value={nascimento} onChange={e => setNascimento(e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Telefone / WhatsApp</label>
                <Input value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(21) 99999-0000" />
              </div>
              <div>
                <label style={lbl}>E-mail</label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label style={lbl}>Grau de Instrução</label>
                  <select value={grauInstrucao} onChange={e => setGrau(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border text-sm"
                    style={{ borderColor: '#E5E7EB', color: '#1F2937' }}>
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
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border text-sm resize-none"
                  style={{ borderColor: '#E5E7EB', color: '#1F2937' }}
                />
              </div>
            </div>
          </div>

          {/* 3 — Documentos */}
          <div style={card}>
            <p style={sec}>3. DOCUMENTOS</p>
            <p className="text-xs mb-3" style={{ color: '#9CA3AF' }}>
              Tire fotos dos documentos. Aceita JPG, PNG e PDF até 20 MB cada.
            </p>
            <div className="space-y-2">
              {DOC_SLOTS.map(slot => {
                const file = docFiles[slot.key] ?? null
                const isImage = file?.type.startsWith('image/')
                const preview = isImage ? URL.createObjectURL(file!) : null
                return (
                  <div key={slot.key} className="flex items-center gap-3 p-3 rounded-xl border"
                    style={{ borderColor: file ? '#2471A3' : '#E5E7EB', backgroundColor: file ? '#EBF5FB' : 'white' }}>
                    {file ? (
                      <>
                        {preview
                          ? <img src={preview} alt="" className="w-10 h-10 object-cover rounded flex-shrink-0" />
                          : <div className="w-10 h-10 rounded flex items-center justify-center text-xl flex-shrink-0"
                              style={{ backgroundColor: '#E5E7EB' }}>📄</div>
                        }
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium" style={{ color: '#1F2937' }}>{slot.label}</p>
                          <p className="text-xs truncate" style={{ color: '#6B7280' }}>{file.name}</p>
                        </div>
                        <button type="button" onClick={() => setDocFiles(p => ({ ...p, [slot.key]: null }))}
                          className="text-xs px-2 py-1 rounded flex-shrink-0"
                          style={{ color: '#C0392B', backgroundColor: '#FDEDEC' }}>
                          Remover
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="w-10 h-10 rounded flex items-center justify-center text-xl flex-shrink-0"
                          style={{ backgroundColor: '#F3F4F6' }}>📎</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium" style={{ color: '#1F2937' }}>{slot.label}</p>
                          <p className="text-xs" style={{ color: '#9CA3AF' }}>Nenhum arquivo</p>
                        </div>
                        <label className="cursor-pointer text-xs px-3 py-1.5 rounded flex-shrink-0 font-medium"
                          style={{ color: '#2471A3', backgroundColor: '#EBF5FB' }}>
                          Selecionar
                          <input type="file" accept={slot.accept} className="hidden"
                            onChange={e => { const f = e.target.files?.[0]; if (f) setDocFiles(p => ({ ...p, [slot.key]: f })); e.target.value = '' }} />
                        </label>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl mb-4 text-sm" style={{ backgroundColor: '#FDEDEC', color: '#C0392B' }}>
              {error}
            </div>
          )}

          <Button type="submit" loading={loading} className="w-full">
            Enviar dados
          </Button>

          <p className="text-xs text-center mt-4 pb-8" style={{ color: '#9CA3AF' }}>
            Seus dados são protegidos e usados exclusivamente para fins trabalhistas.
          </p>

        </form>
      </div>
    </div>
  )
}
