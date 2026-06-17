'use client'

import { Button } from '@/components/ui/button'
import type { Employee } from '../queries'
import type { CompanyBenefit } from '../../beneficios/queries'

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
  if (!v) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const TIPO_CFG: Record<string, { label: string; bg: string; color: string }> = {
  clt:            { label: 'CLT',            bg: '#EBF5FB', color: '#2471A3' },
  pj:             { label: 'PJ',             bg: '#F4F6F7', color: '#566573' },
  estagio:        { label: 'Estágio',        bg: '#FEF9E7', color: '#9A7D0A' },
  menor_aprendiz: { label: 'Menor Aprendiz', bg: '#E9F7EF', color: '#1E8449' },
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

function Field({ label, value, wide }: { label: string; value: React.ReactNode; wide?: boolean }) {
  return (
    <div style={wide ? { gridColumn: '1 / -1' } : undefined}>
      <p style={{ fontSize: '0.62rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2, fontWeight: 600 }}>
        {label}
      </p>
      <p style={{ fontSize: '0.8rem', color: 'var(--color-text-primary)', fontWeight: 500, wordBreak: 'break-word' }}>
        {value || '—'}
      </p>
    </div>
  )
}

function Section({ title, cols = 3, children }: { title: string; cols?: number; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <p style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: '0.5rem', paddingBottom: '0.3rem', borderBottom: '1px solid #E5E7EB' }}>
        {title}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '0.75rem 1.25rem' }}>
        {children}
      </div>
    </div>
  )
}

interface Props {
  employee: Employee | null
  open: boolean
  onClose: () => void
  onEdit: () => void
  companyBenefits: CompanyBenefit[]
}

export function ModalViewFuncionario({ employee: emp, open, onClose, onEdit, companyBenefits }: Props) {
  if (!open || !emp) return null

  const tipoCfg    = emp.tipo_contrato  ? TIPO_CFG[emp.tipo_contrato]       : null
  const contratoCfg = emp.status_contrato ? CONTRATO_CFG[emp.status_contrato] : null
  const statusCfg  = STATUS_CFG[emp.status] ?? STATUS_CFG.ativo

  const empBenefitIds  = new Set(emp.employee_benefits.map(b => b.benefit_id))
  const activeBenefits = companyBenefits.filter(b => empBenefitIds.has(b.id))

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '2rem 1rem' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: -1 }} />

      <div style={{ background: 'white', borderRadius: '1rem', width: '100%', maxWidth: 700, boxShadow: '0 20px 60px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #E5E7EB', backgroundColor: 'var(--color-bg-surface)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'Manrope', color: 'var(--color-text-primary)', margin: 0 }}>
              {emp.nome}
            </h2>
            {emp.cargo && (
              <p style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)', marginTop: '0.1rem' }}>{emp.cargo}</p>
            )}
            <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.62rem', padding: '0.15rem 0.55rem', borderRadius: '999px', backgroundColor: statusCfg.bg, color: statusCfg.color, fontWeight: 600 }}>
                {statusCfg.label}
              </span>
              {tipoCfg && (
                <span style={{ fontSize: '0.62rem', padding: '0.15rem 0.55rem', borderRadius: '999px', backgroundColor: tipoCfg.bg, color: tipoCfg.color, fontWeight: 600 }}>
                  {tipoCfg.label}
                </span>
              )}
              {contratoCfg && (
                <span style={{ fontSize: '0.62rem', padding: '0.15rem 0.55rem', borderRadius: '999px', backgroundColor: contratoCfg.bg, color: contratoCfg.color, fontWeight: 600 }}>
                  contrato {contratoCfg.label}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: 'var(--color-text-muted)', flexShrink: 0, marginTop: '0.1rem' }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: '1.25rem 1.5rem', maxHeight: '68vh', overflowY: 'auto' }}>

          <Section title="Dados Pessoais" cols={3}>
            <Field label="CPF"            value={fmtCpf(emp.cpf)} />
            <Field label="RG"             value={emp.rg} />
            <Field label="Nascimento"     value={fmtDate(emp.nascimento)} />
            <Field label="Telefone"       value={emp.telefone} />
            <Field label="E-mail"         value={emp.email} />
            <Field label="Grau de instrução" value={emp.grau_instrucao ? (GRAU_LABEL[emp.grau_instrucao] ?? emp.grau_instrucao) : null} />
          </Section>

          <Section title="Dados Profissionais" cols={3}>
            <Field label="Cargo"            value={emp.cargo} />
            <Field label="Departamento"     value={emp.departamento} />
            <Field label="Local de trabalho" value={emp.local_trabalho} />
            <Field label="Salário"          value={fmtCurrency(emp.salario)} />
            <Field label="Plano de saúde"   value={emp.plano_saude ? 'Sim' : 'Não'} />
            <Field label="Matrícula"        value={emp.matricula} />
          </Section>

          <Section title="Datas Trabalhistas" cols={3}>
            <Field label="Admissão"          value={fmtDate(emp.data_admissao)} />
            <Field label="Fim experiência 1" value={fmtDate(emp.fim_experiencia_1)} />
            <Field label="Fim experiência 2" value={fmtDate(emp.fim_experiencia_2)} />
            <Field label="Vcto férias"       value={fmtDate(emp.vcto_ferias)} />
            <Field label="Conceder até"      value={fmtDate(emp.conceder_ferias_ate)} />
            <Field label="Exame periódico"   value={fmtDate(emp.exame_periodico)} />
            {emp.data_demissao && (
              <Field label="Data de demissão" value={fmtDate(emp.data_demissao)} />
            )}
          </Section>

          <Section title="Documentos e Identificação" cols={3}>
            <Field label="PIS/PASEP"          value={emp.pis_pasep} />
            <Field label="Série CTPS"         value={emp.serie_ctps} />
            <Field label="Cert. reservista"   value={emp.certificado_reservista} />
            <Field label="Dependentes"        value={String(emp.dependentes)} />
            {emp.dados_bancarios && (
              <Field label="Dados bancários" value={emp.dados_bancarios} wide />
            )}
          </Section>

          {/* Benefícios */}
          <div style={{ marginBottom: '1.25rem' }}>
            <p style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: '0.5rem', paddingBottom: '0.3rem', borderBottom: '1px solid #E5E7EB' }}>
              Benefícios vinculados
            </p>
            {activeBenefits.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {activeBenefits.map(b => (
                  <span key={b.id} style={{ fontSize: '0.72rem', padding: '0.25rem 0.65rem', borderRadius: '999px', backgroundColor: '#EBF5FB', color: '#2471A3', fontWeight: 500 }}>
                    {b.nome} · {b.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}{b.por_dia_trabalhado ? '/dia' : '/mês'}
                  </span>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Nenhum benefício vinculado</p>
            )}
          </div>

          {/* Acesso PDV */}
          {(emp.pin || emp.pin_ativo) && (
            <Section title="Acesso PDV" cols={2}>
              <Field label="PIN cadastrado" value={emp.pin ? 'Sim' : 'Não'} />
              <Field label="PIN ativo"      value={emp.pin_ativo ? 'Sim' : 'Não'} />
            </Section>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '0.875rem 1.5rem', borderTop: '1px solid #E5E7EB', backgroundColor: 'var(--color-bg-surface)', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
          <Button onClick={onEdit}>Editar</Button>
        </div>
      </div>
    </div>
  )
}
