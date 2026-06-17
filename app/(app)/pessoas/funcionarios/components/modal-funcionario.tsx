'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createEmployeeAction, updateEmployeeAction } from '../actions'
import type { Employee } from '../queries'
import type { CompanyBenefit } from '../../beneficios/queries'

function formatCpf(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function fmtDate(iso: string | null) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

interface Props {
  open: boolean
  onClose: () => void
  companyId: string
  employee: Employee | null
  companyBenefits: CompanyBenefit[]
}

const GRAU_OPTIONS = [
  'Fundamental Incompleto', 'Fundamental Completo', 'Médio Incompleto', 'Médio Completo',
  'Técnico', 'Superior Incompleto', 'Superior Completo', 'Pós-graduação', 'Mestrado', 'Doutorado',
]

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <div
        onClick={() => onChange(!value)}
        className="relative w-10 h-5 rounded-full transition-colors flex-shrink-0"
        style={{ backgroundColor: value ? 'var(--color-primary-dark)' : '#D1D5DB' }}
      >
        <span className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all"
          style={{ left: value ? '1.25rem' : '0.125rem' }} />
      </div>
      <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
    </label>
  )
}

export function ModalFuncionario({ open, onClose, companyId, employee, companyBenefits }: Props) {
  const router = useRouter()
  const isEdit = !!employee

  // 1 — Identificação
  const [nome, setNome]             = useState('')
  const [cpf, setCpf]               = useState('')
  const [rg, setRg]                 = useState('')
  const [nascimento, setNascimento] = useState('')
  const [telefone, setTelefone]     = useState('')
  const [email, setEmail]           = useState('')

  // 2 — Dados Profissionais
  const [cargo, setCargo]               = useState('')
  const [localTrabalho, setLocalTrabalho] = useState('')
  const [tipoContrato, setTipoContrato] = useState('')
  const [status, setStatus]             = useState('admissao')
  const [grauInstrucao, setGrauInstrucao] = useState('')
  const [departamento, setDepartamento] = useState('')

  // 3 — Remuneração
  const [salario, setSalario]       = useState('')
  const [planoSaude, setPlanoSaude] = useState(false)

  // 4 — Datas Trabalhistas
  const [dataAdmissao, setDataAdmissao] = useState('')
  const [fimExp1, setFimExp1]           = useState('')
  const [fimExp2, setFimExp2]           = useState('')
  const [vctoFerias, setVctoFerias]     = useState('')
  const [exame, setExame]               = useState('')
  const [statusContrato, setStatusContrato] = useState('')
  const [dataDemissao, setDataDemissao] = useState('')

  // 5 — Documentos
  const [pisPasep, setPisPasep]                       = useState('')
  const [matricula, setMatricula]                     = useState('')
  const [serieCtps, setSerieCtps]                     = useState('')
  const [certReservista, setCertReservista]           = useState('')
  const [dependentes, setDependentes]                 = useState('0')
  const [dadosBancarios, setDadosBancarios]           = useState('')

  // 6 — Benefícios e PIN
  const [selectedBenefitIds, setSelectedBenefitIds] = useState<string[]>([])
  const [pin, setPin]           = useState('')
  const [pinAtivo, setPinAtivo] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  function onAdmissaoChange(val: string) {
    setDataAdmissao(val)
    if (!val) { setFimExp1(''); setFimExp2(''); setVctoFerias(''); return }
    if (!fimExp1) setFimExp1(addDays(val, 44))
    if (!fimExp1 && !fimExp2) setFimExp2(addDays(addDays(val, 44), 44))
    if (!vctoFerias) setVctoFerias(addDays(val, 364))
  }

  function onFimExp1Change(val: string) {
    setFimExp1(val)
    if (val && !fimExp2) setFimExp2(addDays(val, 44))
  }

  useEffect(() => {
    if (!open) return
    setError('')
    if (employee) {
      setNome(employee.nome)
      setCpf(employee.cpf ? formatCpf(employee.cpf) : '')
      setRg(employee.rg ?? '')
      setNascimento(employee.nascimento ?? '')
      setTelefone(employee.telefone ?? '')
      setEmail(employee.email ?? '')
      setCargo(employee.cargo ?? '')
      setLocalTrabalho(employee.local_trabalho ?? '')
      setTipoContrato(employee.tipo_contrato ?? '')
      setStatus(employee.status)
      setGrauInstrucao(employee.grau_instrucao ?? '')
      setDepartamento(employee.departamento ?? '')
      setSalario(employee.salario !== null ? String(employee.salario) : '')
      setPlanoSaude(employee.plano_saude)
      setDataAdmissao(employee.data_admissao ?? '')
      setFimExp1(employee.fim_experiencia_1 ?? '')
      setFimExp2(employee.fim_experiencia_2 ?? '')
      setVctoFerias(employee.vcto_ferias ?? '')
      setExame(employee.exame_periodico ?? '')
      setStatusContrato(employee.status_contrato ?? '')
      setDataDemissao(employee.data_demissao ?? '')
      setPisPasep(employee.pis_pasep ?? '')
      setMatricula(employee.matricula ?? '')
      setSerieCtps(employee.serie_ctps ?? '')
      setCertReservista(employee.certificado_reservista ?? '')
      setDependentes(String(employee.dependentes ?? 0))
      setDadosBancarios(employee.dados_bancarios ?? '')
      setPin(employee.pin ?? '')
      setPinAtivo(employee.pin_ativo ?? false)
      setSelectedBenefitIds(employee.employee_benefits?.map(b => b.benefit_id) ?? [])
    } else {
      setNome(''); setCpf(''); setRg(''); setNascimento(''); setTelefone(''); setEmail('')
      setCargo(''); setLocalTrabalho(''); setTipoContrato(''); setStatus('admissao')
      setGrauInstrucao(''); setDepartamento('')
      setSalario(''); setPlanoSaude(false)
      setDataAdmissao(''); setFimExp1(''); setFimExp2(''); setVctoFerias(''); setExame('')
      setStatusContrato(''); setDataDemissao('')
      setPisPasep(''); setMatricula(''); setSerieCtps(''); setCertReservista('')
      setDependentes('0'); setDadosBancarios('')
      setPin(''); setPinAtivo(false); setSelectedBenefitIds([])
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
    fd.set('nascimento', nascimento)
    fd.set('telefone', telefone)
    fd.set('email', email)
    fd.set('cargo', cargo)
    fd.set('local_trabalho', localTrabalho)
    fd.set('departamento', departamento)
    fd.set('tipo_contrato', tipoContrato)
    fd.set('status', status)
    fd.set('grau_instrucao', grauInstrucao)
    fd.set('salario', salario)
    fd.set('plano_saude', String(planoSaude))
    fd.set('data_admissao', dataAdmissao)
    fd.set('fim_experiencia_1', fimExp1)
    fd.set('fim_experiencia_2', fimExp2)
    fd.set('vcto_ferias', vctoFerias)
    fd.set('exame_periodico', exame)
    fd.set('status_contrato', statusContrato)
    fd.set('data_demissao', dataDemissao)
    fd.set('pis_pasep', pisPasep)
    fd.set('matricula', matricula)
    fd.set('serie_ctps', serieCtps)
    fd.set('certificado_reservista', certReservista)
    fd.set('dependentes', dependentes)
    fd.set('dados_bancarios', dadosBancarios)
    fd.set('pin', pin)
    fd.set('pin_ativo', String(pinAtivo))
    fd.set('benefit_ids', JSON.stringify(selectedBenefitIds))

    const result = isEdit
      ? await updateEmployeeAction(employee!.id, fd)
      : await createEmployeeAction(companyId, fd)

    setLoading(false)
    if ('error' in result) { setError(result.error ?? 'Erro ao salvar.'); return }
    router.refresh()
    onClose()
  }

  const lbl: React.CSSProperties = { color: 'var(--color-text-secondary)', fontSize: '0.75rem', fontWeight: 500, marginBottom: 4, display: 'block' }
  const sec: React.CSSProperties = { color: 'var(--color-primary-darker)', fontSize: '0.75rem', fontWeight: 700, marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid var(--color-bg-surface)', letterSpacing: '0.05em' }

  const concederAte = vctoFerias ? fmtDate(
    (() => { const d = new Date(vctoFerias); d.setDate(d.getDate() + 330); return d.toISOString().split('T')[0] })()
  ) : null

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Editar Funcionário' : 'Novo Funcionário'}>
      <form onSubmit={handleSubmit} className="space-y-5">

        {/* 1 — Identificação */}
        <div>
          <p style={sec}>1. IDENTIFICAÇÃO</p>
          <div className="space-y-3">
            <div>
              <label style={lbl}>Nome completo *</label>
              <Input value={nome} onChange={e => setNome(e.target.value.toUpperCase())} placeholder="NOME COMPLETO" required />
            </div>
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
                <label style={lbl}>Telefone</label>
                <Input value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(21) 99999-0000" />
              </div>
            </div>
            <div>
              <label style={lbl}>E-mail</label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemplo.com" />
            </div>
          </div>
        </div>

        {/* 2 — Dados Profissionais */}
        <div>
          <p style={sec}>2. DADOS PROFISSIONAIS</p>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={lbl}>Cargo</label>
                <Input value={cargo} onChange={e => setCargo(e.target.value)} placeholder="Ex: Recepcionista" />
              </div>
              <div>
                <label style={lbl}>Local de Trabalho</label>
                <Input value={localTrabalho} onChange={e => setLocalTrabalho(e.target.value)} placeholder="Ex: Canal ABM" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={lbl}>Tipo de Contrato</label>
                <select value={tipoContrato} onChange={e => setTipoContrato(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}>
                  <option value="">Selecionar...</option>
                  <option value="clt">CLT</option>
                  <option value="pj">PJ</option>
                  <option value="estagio">Estágio</option>
                  <option value="menor_aprendiz">Menor Aprendiz</option>
                </select>
              </div>
              <div>
                <label style={lbl}>Status</label>
                <select value={status} onChange={e => setStatus(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}>
                  <option value="admissao">Admissão</option>
                  <option value="experiencia">Experiência</option>
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                  <option value="demitido">Demitido</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={lbl}>Departamento</label>
                <Input value={departamento} onChange={e => setDepartamento(e.target.value)} placeholder="Ex: Operacional" />
              </div>
              <div>
                <label style={lbl}>Grau de Instrução</label>
                <select value={grauInstrucao} onChange={e => setGrauInstrucao(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}>
                  <option value="">Selecionar...</option>
                  {GRAU_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* 3 — Remuneração */}
        <div>
          <p style={sec}>3. REMUNERAÇÃO</p>
          <div className="grid grid-cols-2 gap-3 items-end">
            <div>
              <label style={lbl}>Salário Bruto (R$)</label>
              <Input value={salario} onChange={e => setSalario(e.target.value)} placeholder="0,00" inputMode="decimal" />
            </div>
            <div className="pb-1">
              <Toggle value={planoSaude} onChange={setPlanoSaude} label="Plano de saúde" />
            </div>
          </div>
          <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
            Vale-alimentação e vale-transporte são configurados em Benefícios e vinculados no item 6.
          </p>
        </div>

        {/* 4 — Datas Trabalhistas */}
        <div>
          <p style={sec}>4. DATAS TRABALHISTAS</p>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={lbl}>Data de Admissão</label>
                <Input type="date" value={dataAdmissao} onChange={e => onAdmissaoChange(e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Status do Contrato</label>
                <select value={statusContrato} onChange={e => setStatusContrato(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}>
                  <option value="">Selecionar...</option>
                  <option value="assinado">Assinado</option>
                  <option value="nao_tem">Não tem</option>
                  <option value="nao_assinado">Não assinado</option>
                </select>
              </div>
            </div>
            <div className="p-3 rounded-lg space-y-3" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
              <p className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                PERÍODO DE EXPERIÊNCIA <span style={{ fontWeight: 400, opacity: 0.7 }}>(calculado automaticamente — ajuste se necessário)</span>
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label style={lbl}>Fim do 1º período</label>
                  <Input type="date" value={fimExp1} onChange={e => onFimExp1Change(e.target.value)} />
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Ex: 45 dias, 30 dias, 60 dias após admissão</p>
                </div>
                <div>
                  <label style={lbl}>Fim do 2º período</label>
                  <Input type="date" value={fimExp2} onChange={e => setFimExp2(e.target.value)} />
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Total até 90 dias por lei</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={lbl}>Vencimento de Férias</label>
                <Input type="date" value={vctoFerias} onChange={e => setVctoFerias(e.target.value)} />
                {concederAte && (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Conceder até: {concederAte}</p>
                )}
              </div>
              <div>
                <label style={lbl}>Próximo Exame Periódico</label>
                <Input type="date" value={exame} onChange={e => setExame(e.target.value)} />
              </div>
            </div>
            {(status === 'demitido' || status === 'inativo') && (
              <div>
                <label style={lbl}>Data de Demissão</label>
                <Input type="date" value={dataDemissao} onChange={e => setDataDemissao(e.target.value)} />
              </div>
            )}
          </div>
        </div>

        {/* 5 — Documentos e Dados Bancários */}
        <div>
          <p style={sec}>5. DOCUMENTOS E DADOS BANCÁRIOS</p>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={lbl}>PIS / PASEP</label>
                <Input value={pisPasep} onChange={e => setPisPasep(e.target.value)} placeholder="000.00000.00-0" />
              </div>
              <div>
                <label style={lbl}>Matrícula</label>
                <Input value={matricula} onChange={e => setMatricula(e.target.value)} placeholder="Nº funcional" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label style={lbl}>Série da CTPS</label>
                <Input value={serieCtps} onChange={e => setSerieCtps(e.target.value)} placeholder="Ex: 001" />
              </div>
              <div>
                <label style={lbl}>Cert. de Reservista</label>
                <Input value={certReservista} onChange={e => setCertReservista(e.target.value)} placeholder="Nº / categoria" />
              </div>
              <div>
                <label style={lbl}>Dependentes</label>
                <Input
                  type="number"
                  min={0}
                  value={dependentes}
                  onChange={e => setDependentes(e.target.value)}
                  placeholder="0"
                />
              </div>
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

        {/* 6 — Benefícios do catálogo */}
        <div>
          <p style={sec}>6. BENEFÍCIOS</p>
          {companyBenefits.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Nenhum benefício cadastrado. Acesse Pessoas → Benefícios para criar o catálogo.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {companyBenefits.map(b => {
                const checked = selectedBenefitIds.includes(b.id)
                return (
                  <label key={b.id} className="flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors"
                    style={{ borderColor: checked ? 'var(--color-primary-dark)' : 'var(--color-bg-surface)', backgroundColor: checked ? 'var(--color-primary)' : 'white' }}>
                    <input type="checkbox" checked={checked}
                      onChange={e => setSelectedBenefitIds(prev =>
                        e.target.checked ? [...prev, b.id] : prev.filter(id => id !== b.id)
                      )} className="mt-0.5" />
                    <div>
                      <p className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>{b.nome}</p>
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {b.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        {b.por_dia_trabalhado ? '/dia' : '/mês'}
                      </p>
                    </div>
                  </label>
                )
              })}
            </div>
          )}
        </div>

        {/* 7 — Acesso ao Portal de Ponto */}
        <div>
          <p style={sec}>7. ACESSO AO PORTAL DE PONTO</p>
          <div className="space-y-3">
            <Toggle value={pinAtivo} onChange={setPinAtivo} label="Permitir registro de ponto pelo colaborador" />
            {pinAtivo && (
              <div>
                <label style={lbl}>PIN de acesso (4 dígitos)</label>
                <div className="flex gap-2 items-center">
                  <Input value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="0000" inputMode="numeric" maxLength={4}
                    className="w-28 text-center text-lg tracking-widest font-mono" />
                  <button type="button" onClick={() => setPin(String(Math.floor(1000 + Math.random() * 9000)))}
                    className="text-xs px-3 py-2 rounded-lg border transition-colors hover:bg-gray-50"
                    style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-secondary)' }}>
                    Gerar PIN
                  </button>
                </div>
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
