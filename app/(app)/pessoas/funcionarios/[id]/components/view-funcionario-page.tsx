'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ModalFuncionario } from '../../components/modal-funcionario'
import type { Employee } from '../../queries'
import type { CompanyBenefit } from '../../../beneficios/queries'

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function fmtCpf(cpf: string | null): string {
  if (!cpf) return '—'
  const d = cpf.replace(/\D/g, '')
  if (d.length !== 11) return cpf
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

function fmtCurrency(v: number | null): string {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const TIPO_CFG: Record<string, { label: string; bg: string; color: string }> = {
  clt:            { label: 'CLT',            bg: '#EBF5FB', color: '#2471A3' },
  pj:             { label: 'PJ',             bg: '#F4F6F7', color: '#566573' },
  estagio:        { label: 'Estágio',        bg: '#FEF9E7', color: '#9A7D0A' },
  menor_aprendiz: { label: 'Menor Aprendiz', bg: '#E9F7EF', color: '#1E8449' },
  autonomo:       { label: 'Autônomo',       bg: '#F5EEF8', color: '#7D3C98' },
}

const CONTRATO_CFG: Record<string, { label: string; bg: string; color: string }> = {
  assinado:     { label: 'assinado',     bg: '#E9F7EF', color: '#1E8449' },
  nao_tem:      { label: 'não tem',      bg: '#FDEDEC', color: '#C0392B' },
  nao_assinado: { label: 'não assinado', bg: '#FEF9E7', color: '#9A7D0A' },
}

const STATUS_CFG: Record<string, { label: string; bg: string; color: string }> = {
  admissao:    { label: 'Admissão',    bg: '#EBF5FB', color: '#2471A3' },
  experiencia: { label: 'Experiência', bg: '#FEF9E7', color: '#9A7D0A' },
  ativo:       { label: 'Ativo',       bg: '#E9F7EF', color: '#1E8449' },
  ferias:      { label: 'Férias',      bg: '#EAF4FB', color: '#1A5276' },
  afastado:    { label: 'Afastado',    bg: '#F5EEF8', color: '#7D3C98' },
  inativo:     { label: 'Inativo',     bg: '#F4F6F7', color: '#717D7E' },
  demitido:    { label: 'Demitido',    bg: '#FDEDEC', color: '#C0392B' },
}

const GRAU_LABEL: Record<string, string> = {
  fundamental_incompleto: 'Fundamental incompleto',
  fundamental_completo:   'Fundamental completo',
  medio_incompleto:       'Médio incompleto',
  medio_completo:         'Médio completo',
  superior_incompleto:    'Superior incompleto',
  superior_completo:      'Superior completo',
  pos_graduacao:          'Pós-graduação',
}

const card: React.CSSProperties = {
  backgroundColor: 'white',
  borderRadius: '0.75rem',
  border: '1px solid var(--color-bg-surface)',
  padding: '1.25rem 1.5rem',
}

const sec: React.CSSProperties = {
  color: 'var(--color-primary-darker)',
  fontSize: '0.7rem',
  fontWeight: 700,
  marginBottom: 12,
  paddingBottom: 8,
  borderBottom: '1px solid var(--color-bg-surface)',
  letterSpacing: '0.05em',
}

function Field({ label, value, wide }: { label: string; value: React.ReactNode; wide?: boolean }) {
  return (
    <div style={wide ? { gridColumn: '1 / -1' } : undefined}>
      <p style={{ fontSize: '0.62rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2, fontWeight: 600 }}>
        {label}
      </p>
      <p style={{ fontSize: '0.82rem', color: 'var(--color-text-primary)', fontWeight: 500, wordBreak: 'break-word' }}>
        {value || '—'}
      </p>
    </div>
  )
}

function Grid({ cols = 3, children }: { cols?: number; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '0.75rem 1.25rem' }}>
      {children}
    </div>
  )
}

interface Props {
  employee: Employee
  companyId: string
  companyBenefits: CompanyBenefit[]
  fotoUrl: string | null
}

export function ViewFuncionarioPage({ employee: emp, companyId, companyBenefits, fotoUrl }: Props) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)

  const tipoCfg     = emp.tipo_contrato   ? TIPO_CFG[emp.tipo_contrato]        : null
  const contratoCfg = emp.status_contrato ? CONTRATO_CFG[emp.status_contrato]  : null
  const statusCfg   = STATUS_CFG[emp.status] ?? STATUS_CFG.ativo

  const empBenefitIds  = new Set(emp.employee_benefits.map(b => b.benefit_id))
  const activeBenefits = companyBenefits.filter(b => empBenefitIds.has(b.id))

  const initials = emp.nome.split(' ').slice(0, 2).map(n => n[0] ?? '').join('').toUpperCase()

  return (
    <>
      <div className="space-y-4">

        {/* Breadcrumb + ações */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.push('/pessoas/funcionarios')}
            className="flex items-center gap-1.5 text-sm"
            style={{ color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            ← Equipe
          </button>
          <Button onClick={() => setEditOpen(true)}>Editar</Button>
        </div>

        {/* Header — foto + nome + badges */}
        <div style={card}>
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center shrink-0 text-xl font-bold"
              style={{ backgroundColor: fotoUrl ? 'transparent' : statusCfg.bg, color: statusCfg.color }}
            >
              {fotoUrl
                ? <img src={fotoUrl} alt={emp.nome} className="w-full h-full object-cover" />
                : initials
              }
            </div>
            <div>
              <h1 className="text-lg font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
                {emp.nome}
              </h1>
              {emp.cargo && (
                <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>{emp.cargo}</p>
              )}
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                <span style={{ fontSize: '0.65rem', padding: '0.15rem 0.55rem', borderRadius: 999, backgroundColor: statusCfg.bg, color: statusCfg.color, fontWeight: 600 }}>
                  {statusCfg.label}
                </span>
                {tipoCfg && (
                  <span style={{ fontSize: '0.65rem', padding: '0.15rem 0.55rem', borderRadius: 999, backgroundColor: tipoCfg.bg, color: tipoCfg.color, fontWeight: 600 }}>
                    {tipoCfg.label}
                  </span>
                )}
                {contratoCfg && (
                  <span style={{ fontSize: '0.65rem', padding: '0.15rem 0.55rem', borderRadius: 999, backgroundColor: contratoCfg.bg, color: contratoCfg.color, fontWeight: 600 }}>
                    contrato {contratoCfg.label}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Dados Pessoais */}
        <div style={card}>
          <p style={sec}>DADOS PESSOAIS</p>
          <Grid cols={3}>
            <Field label="CPF"              value={fmtCpf(emp.cpf)} />
            <Field label="RG"               value={emp.rg} />
            <Field label="Nascimento"       value={fmtDate(emp.nascimento)} />
            <Field label="Telefone"         value={emp.telefone} />
            <Field label="E-mail"           value={emp.email} />
            <Field label="Grau de instrução" value={emp.grau_instrucao ? (GRAU_LABEL[emp.grau_instrucao] ?? emp.grau_instrucao) : null} />
          </Grid>
        </div>

        {/* Dados Profissionais */}
        <div style={card}>
          <p style={sec}>DADOS PROFISSIONAIS</p>
          <Grid cols={3}>
            <Field label="Cargo"             value={emp.cargo} />
            <Field label="Departamento"      value={emp.departamento} />
            <Field label="Local de trabalho" value={emp.local_trabalho} />
            <Field label="Salário"           value={fmtCurrency(emp.salario)} />
            {emp.valor_servico != null && (
              <Field label="Valor do serviço" value={fmtCurrency(emp.valor_servico)} />
            )}
            <Field label="Matrícula"         value={emp.matricula} />
            {emp.cnpj && <Field label="CNPJ"    value={emp.cnpj} />}
            {emp.servico && <Field label="Serviço" value={emp.servico} />}
          </Grid>
        </div>

        {/* Datas Trabalhistas */}
        <div style={card}>
          <p style={sec}>DATAS TRABALHISTAS</p>
          <Grid cols={3}>
            <Field label="Admissão"           value={fmtDate(emp.data_admissao)} />
            <Field label="Fim experiência 1"  value={fmtDate(emp.fim_experiencia_1)} />
            <Field label="Fim experiência 2"  value={fmtDate(emp.fim_experiencia_2)} />
            <Field label="Vcto férias"        value={fmtDate(emp.vcto_ferias)} />
            <Field label="Conceder até"       value={fmtDate(emp.conceder_ferias_ate)} />
            <Field label="Exame periódico"    value={fmtDate(emp.exame_periodico)} />
            {emp.data_demissao && (
              <Field label="Data de demissão" value={fmtDate(emp.data_demissao)} />
            )}
          </Grid>
        </div>

        {/* Documentos e Identificação */}
        <div style={card}>
          <p style={sec}>DOCUMENTOS E IDENTIFICAÇÃO</p>
          <Grid cols={3}>
            <Field label="PIS / PASEP"          value={emp.pis_pasep} />
            <Field label="Série CTPS"           value={emp.serie_ctps} />
            <Field label="Cert. reservista"     value={emp.certificado_reservista} />
            <Field label="Dependentes (IR)"     value={String(emp.dependentes)} />
            {emp.dados_bancarios && (
              <Field label="Dados bancários" value={emp.dados_bancarios} wide />
            )}
          </Grid>
        </div>

        {/* Benefícios */}
        <div style={card}>
          <p style={sec}>BENEFÍCIOS VINCULADOS</p>
          {activeBenefits.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {activeBenefits.map(b => (
                <span
                  key={b.id}
                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.65rem', borderRadius: 999, backgroundColor: '#EBF5FB', color: '#2471A3', fontWeight: 500 }}
                >
                  {b.nome} · {b.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}{b.por_dia_trabalhado ? '/dia' : '/mês'}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Nenhum benefício vinculado</p>
          )}
        </div>

        {/* Acesso PDV */}
        {(emp.pin || emp.pin_ativo) && (
          <div style={card}>
            <p style={sec}>ACESSO PDV</p>
            <Grid cols={2}>
              <Field label="PIN cadastrado" value={emp.pin ? 'Sim' : 'Não'} />
              <Field label="PIN ativo"      value={emp.pin_ativo ? 'Sim' : 'Não'} />
            </Grid>
          </div>
        )}

      </div>

      <ModalFuncionario
        open={editOpen}
        onClose={() => setEditOpen(false)}
        companyId={companyId}
        employee={emp}
        companyBenefits={companyBenefits}
      />
    </>
  )
}
