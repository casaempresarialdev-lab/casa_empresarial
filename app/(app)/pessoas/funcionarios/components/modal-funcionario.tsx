'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createEmployeeAction, updateEmployeeAction } from '../actions'
import type { Employee } from '../queries'

function formatCpf(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

interface Props {
  open: boolean
  onClose: () => void
  companyId: string
  employee: Employee | null
}

const GRAU_OPTIONS = [
  'Fundamental Incompleto',
  'Fundamental Completo',
  'Médio Incompleto',
  'Médio Completo',
  'Técnico',
  'Superior Incompleto',
  'Superior Completo',
  'Pós-graduação',
  'Mestrado',
  'Doutorado',
]

export function ModalFuncionario({ open, onClose, companyId, employee }: Props) {
  const router = useRouter()
  const isEdit = !!employee

  const [nome, setNome] = useState('')
  const [cpf, setCpf] = useState('')
  const [rg, setRg] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [cargo, setCargo] = useState('')
  const [departamento, setDepartamento] = useState('')
  const [salario, setSalario] = useState('')
  const [status, setStatus] = useState('admissao')
  const [dataAdmissao, setDataAdmissao] = useState('')
  const [dataExperienciaFim, setDataExperienciaFim] = useState('')
  const [dataDemissao, setDataDemissao] = useState('')
  const [tipoContrato, setTipoContrato] = useState('')
  const [grauInstrucao, setGrauInstrucao] = useState('')
  const [valeTransporte, setValeTransporte] = useState(false)
  const [valeRefeicao, setValeRefeicao] = useState(false)
  const [planoSaude, setPlanoSaude] = useState(false)
  const [pin, setPin] = useState('')
  const [pinAtivo, setPinAtivo] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    if (employee) {
      setNome(employee.nome)
      setCpf(employee.cpf ? formatCpf(employee.cpf) : '')
      setRg(employee.rg ?? '')
      setTelefone(employee.telefone ?? '')
      setEmail(employee.email ?? '')
      setCargo(employee.cargo ?? '')
      setDepartamento(employee.departamento ?? '')
      setSalario(employee.salario !== null ? String(employee.salario) : '')
      setStatus(employee.status)
      setDataAdmissao(employee.data_admissao ?? '')
      setDataExperienciaFim(employee.data_experiencia_fim ?? '')
      setDataDemissao(employee.data_demissao ?? '')
      setTipoContrato(employee.tipo_contrato ?? '')
      setGrauInstrucao(employee.grau_instrucao ?? '')
      setValeTransporte(employee.vale_transporte)
      setValeRefeicao(employee.vale_refeicao)
      setPlanoSaude(employee.plano_saude)
      setPin((employee as unknown as { pin?: string }).pin ?? '')
      setPinAtivo((employee as unknown as { pin_ativo?: boolean }).pin_ativo ?? false)
    } else {
      setNome(''); setCpf(''); setRg(''); setTelefone(''); setEmail('')
      setCargo(''); setDepartamento(''); setSalario(''); setStatus('admissao')
      setDataAdmissao(''); setDataExperienciaFim(''); setDataDemissao('')
      setTipoContrato(''); setGrauInstrucao('')
      setValeTransporte(false); setValeRefeicao(false); setPlanoSaude(false)
      setPin(''); setPinAtivo(false)
    }
  }, [open, employee])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const fd = new FormData()
    fd.set('nome', nome)
    fd.set('cpf', cpf)
    fd.set('rg', rg)
    fd.set('telefone', telefone)
    fd.set('email', email)
    fd.set('cargo', cargo)
    fd.set('departamento', departamento)
    fd.set('salario', salario)
    fd.set('status', status)
    fd.set('data_admissao', dataAdmissao)
    fd.set('data_experiencia_fim', dataExperienciaFim)
    fd.set('data_demissao', dataDemissao)
    fd.set('tipo_contrato', tipoContrato)
    fd.set('grau_instrucao', grauInstrucao)
    fd.set('vale_transporte', String(valeTransporte))
    fd.set('vale_refeicao', String(valeRefeicao))
    fd.set('plano_saude', String(planoSaude))
    fd.set('pin', pin)
    fd.set('pin_ativo', String(pinAtivo))

    const result = isEdit
      ? await updateEmployeeAction(employee!.id, fd)
      : await createEmployeeAction(companyId, fd)

    setLoading(false)
    if ('error' in result) { setError(result.error ?? 'Erro ao salvar.'); return }
    router.refresh()
    onClose()
  }

  const labelStyle = { color: 'var(--color-text-secondary)', fontSize: '0.75rem', fontWeight: 500, marginBottom: 4, display: 'block' }
  const sectionTitle = { color: 'var(--color-primary-darker)', fontSize: '0.8rem', fontWeight: 600, marginBottom: 12, paddingBottom: 6, borderBottom: '1px solid var(--color-bg-surface)' }

  function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
    return (
      <label className="flex items-center gap-3 cursor-pointer select-none">
        <div
          onClick={() => onChange(!value)}
          className="relative w-10 h-5 rounded-full transition-colors flex-shrink-0"
          style={{ backgroundColor: value ? 'var(--color-primary-dark)' : '#D1D5DB' }}
        >
          <span
            className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all"
            style={{ left: value ? '1.25rem' : '0.125rem' }}
          />
        </div>
        <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
      </label>
    )
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Editar Funcionário' : 'Novo Funcionário'}>
      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Dados Pessoais */}
        <div>
          <p style={sectionTitle}>Dados Pessoais</p>
          <div className="space-y-3">
            <div>
              <label style={labelStyle}>Nome completo *</label>
              <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome completo" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={labelStyle}>CPF</label>
                <Input
                  value={cpf}
                  onChange={e => setCpf(formatCpf(e.target.value))}
                  placeholder="000.000.000-00"
                />
              </div>
              <div>
                <label style={labelStyle}>RG</label>
                <Input value={rg} onChange={e => setRg(e.target.value)} placeholder="RG" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={labelStyle}>Telefone</label>
                <Input value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(00) 00000-0000" />
              </div>
              <div>
                <label style={labelStyle}>E-mail</label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemplo.com" />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Grau de Instrução</label>
              <select
                value={grauInstrucao}
                onChange={e => setGrauInstrucao(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
              >
                <option value="">Selecionar...</option>
                {GRAU_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Dados Profissionais */}
        <div>
          <p style={sectionTitle}>Dados Profissionais</p>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={labelStyle}>Cargo</label>
                <Input value={cargo} onChange={e => setCargo(e.target.value)} placeholder="Ex: Vendedor" />
              </div>
              <div>
                <label style={labelStyle}>Departamento</label>
                <Input value={departamento} onChange={e => setDepartamento(e.target.value)} placeholder="Ex: Comercial" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={labelStyle}>Tipo de Contrato</label>
                <select
                  value={tipoContrato}
                  onChange={e => setTipoContrato(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                >
                  <option value="">Selecionar...</option>
                  <option value="clt">CLT</option>
                  <option value="pj">PJ</option>
                  <option value="estagio">Estágio</option>
                  <option value="menor_aprendiz">Menor Aprendiz</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Status</label>
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                >
                  <option value="admissao">Admissão</option>
                  <option value="experiencia">Experiência</option>
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                  <option value="demitido">Demitido</option>
                </select>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Salário (R$)</label>
              <Input
                value={salario}
                onChange={e => setSalario(e.target.value)}
                placeholder="0,00"
                inputMode="decimal"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={labelStyle}>Data de Admissão</label>
                <Input type="date" value={dataAdmissao} onChange={e => setDataAdmissao(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Fim Período de Experiência</label>
                <Input type="date" value={dataExperienciaFim} onChange={e => setDataExperienciaFim(e.target.value)} />
              </div>
            </div>
            {(status === 'demitido' || status === 'inativo') && (
              <div>
                <label style={labelStyle}>Data de Demissão</label>
                <Input type="date" value={dataDemissao} onChange={e => setDataDemissao(e.target.value)} />
              </div>
            )}
          </div>
        </div>

        {/* Benefícios */}
        <div>
          <p style={sectionTitle}>Benefícios</p>
          <div className="space-y-3">
            <Toggle value={valeTransporte} onChange={setValeTransporte} label="Vale Transporte" />
            <Toggle value={valeRefeicao} onChange={setValeRefeicao} label="Vale Refeição" />
            <Toggle value={planoSaude} onChange={setPlanoSaude} label="Plano de Saúde" />
          </div>
        </div>

        {/* Acesso ao Portal de Ponto */}
        <div>
          <p style={sectionTitle}>Acesso ao Portal de Ponto</p>
          <div className="space-y-3">
            <Toggle value={pinAtivo} onChange={setPinAtivo} label="Permitir registro de ponto pelo colaborador" />
            {pinAtivo && (
              <div>
                <label style={labelStyle}>PIN de acesso (4 dígitos)</label>
                <div className="flex gap-2 items-center">
                  <Input
                    value={pin}
                    onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="0000"
                    inputMode="numeric"
                    maxLength={4}
                    className="w-28 text-center text-lg tracking-widest font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setPin(String(Math.floor(1000 + Math.random() * 9000)))}
                    className="text-xs px-3 py-2 rounded-lg border transition-colors hover:bg-gray-50"
                    style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-secondary)' }}
                  >
                    Gerar PIN
                  </button>
                </div>
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                  O colaborador usa este PIN em{' '}
                  <span className="font-mono" style={{ color: 'var(--color-primary-darker)' }}>
                    /registrar-ponto
                  </span>{' '}
                  junto ao CNPJ da empresa.
                </p>
              </div>
            )}
          </div>
        </div>

        {error && (
          <p className="text-sm p-3 rounded-lg bg-red-50" style={{ color: 'var(--color-error)' }}>{error}</p>
        )}

        <div className="flex gap-3 justify-end pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading}>{isEdit ? 'Salvar alterações' : 'Cadastrar'}</Button>
        </div>
      </form>
    </Modal>
  )
}
