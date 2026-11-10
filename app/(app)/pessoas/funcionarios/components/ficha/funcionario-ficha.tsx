'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { FotoPicker } from '@/components/ui/foto-picker'
import { Stepper, Tabs } from '@/components/ui/form-steps'
import { FileViewer, triggerDownload, type ViewerFile } from '@/components/ui/file-viewer'
import { toast } from '@/lib/toast'
import { ROTULO_ADICIONAL } from '@/lib/folha/config'
import { ADICIONAIS_CARGO } from '@/lib/validations/folha'
import {
  createEmployeeAction, updateEmployeeAction, generateOnboardingTokenAction, grantSystemAccessAction,
  getEmployeeDocUrlAction,
} from '../../actions'
import type { Employee } from '../../queries'
import type { CompanyBenefit } from '../../../beneficios/queries'
import { CampoCargo } from '../../../../empresa/estrutura/components/campo-cargo'
import type { CargoOpcao } from '../../../../empresa/estrutura/tipos'
import {
  ARQUIVOS, CONTRATO_OPTIONS, GRAU_OPTIONS, STATUS_OPTIONS, STATUS_OPTIONS_PJ, TIPO_OPTIONS,
  addDays, fmtDate, fmtMoney, isPjOuAutonomo, labelDe, maskCnpj, maskCpf, maskMoeda, maskTelefone, secoesVisiveis,
  tipoPorCaminho, valoresIniciais, valoresParaFormData,
  type ArquivoKey, type SecaoId, type Valores,
} from './ficha-config'

export type ModoFicha = 'cadastro' | 'ver' | 'editar'

/** Resultado do cadastro (tela de sucesso da admissão) */
export type CadastroConcluido = { employeeId: string; nome: string; telefone: string; link: string | null; acesso: string | null }

// ── Peças do layout (fora do componente para não perder o foco ao digitar) ──

// Somente leitura: mesmo campo, fechado
const SomenteLeitura = createContext(false)

/** Campo da ficha: na visualização mostra o valor no mesmo lugar onde, na edição, fica o campo aberto */
function Campo({ label, valor, largo, duplo, children }: {
  label: string
  valor?: React.ReactNode
  /** Ocupa a linha inteira */
  largo?: boolean
  /** Ocupa duas colunas */
  duplo?: boolean
  children: React.ReactNode
}) {
  const leitura = useContext(SomenteLeitura)
  return (
    <div className={largo ? 'sm:col-span-2 lg:col-span-3' : duplo ? 'sm:col-span-2' : undefined}>
      {leitura ? (
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>{label.replace(' *', '')}</span>
          <div
            className="min-h-10 w-full rounded-lg border px-3 py-2 text-sm flex items-center whitespace-pre-wrap break-words"
            style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: '#FAFAFA', color: valor ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}
          >
            {valor || '—'}
          </div>
        </div>
      ) : children}
    </div>
  )
}

function Grade({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{children}</div>
}

function Bloco({ titulo, descricao, children }: { titulo: string; descricao?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>{titulo}</h3>
        {descricao && <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{descricao}</p>}
      </div>
      {children}
    </section>
  )
}

function Toggle({ value, onChange, label, disabled }: { value: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    // Sem <label> em volta: o clique no botão contaria duas vezes e o estado não mudaria
    <div className={`flex items-center gap-3 select-none ${disabled ? 'opacity-70' : ''}`}>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!value)}
        className={`relative inline-block w-10 h-6 p-0 rounded-full transition-colors shrink-0 ${disabled ? '' : 'cursor-pointer'}`}
        style={{ backgroundColor: value ? 'var(--color-brand)' : '#D1D5DB' }}
      >
        <span className={`absolute left-0 top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-1'}`} />
      </button>
      <span
        onClick={disabled ? undefined : () => onChange(!value)}
        className={`text-sm font-medium ${disabled ? '' : 'cursor-pointer'}`}
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {label}
      </span>
    </div>
  )
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 items-start px-4 py-3 rounded-xl text-sm" style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-sidebar-text)' }}>
      <span className="shrink-0 mt-0.5" style={{ color: 'var(--color-brand)' }}><Icon name="info" size={16} /></span>
      <div>{children}</div>
    </div>
  )
}

// ── Componente ───────────────────────────────────────────────────────────────

interface Props {
  modo: ModoFicha
  employee: Employee | null
  companyId: string
  companyBenefits: CompanyBenefit[]
  /** Cargos da Estrutura (cadastro e edição) */
  cargos?: CargoOpcao[]
  /** Cadastro: campos que já vêm preenchidos (ex.: da vaga escolhida) */
  iniciais?: Partial<Valores>
  /** Cadastro: campos definidos pela vaga, que não podem ser alterados */
  travados?: (keyof Valores)[]
  /** Cadastro: vaga a que a admissão pertence */
  vagaId?: string
  /** Link da foto salva (ficha/edição) */
  fotoUrl?: string | null
  abaInicial?: SecaoId
  /** Avisa a página da aba aberta (ex.: "Editar" abre na mesma aba) */
  onAbaChange?: (aba: SecaoId) => void
  /** Pode conceder acesso ao sistema (não colaborador) */
  podeGerenciar?: boolean
  /** Botões na mesma linha das abas, à direita */
  acoes?: React.ReactNode
  onCancel?: () => void
  onSaved?: () => void
  onCreated?: (r: CadastroConcluido) => void
}

// Ficha do funcionário: etapas no cadastro (admissão), abas na visualização e na edição.
// Visualização e edição têm a mesma apresentação; na edição os campos ficam abertos.
export function FuncionarioFicha({
  modo, employee, companyId, companyBenefits, cargos = [], iniciais, travados = [], vagaId, fotoUrl = null, abaInicial, onAbaChange, podeGerenciar = true,
  acoes, onCancel, onSaved, onCreated,
}: Props) {
  const router = useRouter()
  const cadastro = modo === 'cadastro'
  const leitura = modo === 'ver'
  const travado = (k: keyof Valores) => cadastro && travados.includes(k)

  const [v, setV] = useState<Valores>(() => ({ ...valoresIniciais(employee), ...iniciais }))
  const set = <K extends keyof Valores>(k: K) => (val: Valores[K]) => {
    setV((prev) => ({ ...prev, [k]: val }))
    setInvalid((prev) => { if (!prev.has(k)) return prev; const n = new Set(prev); n.delete(k); return n })
  }
  const txt = (k: keyof Valores) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    set(k)(e.target.value as never)

  const [invalid, setInvalid] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)

  // Arquivos: novos (a enviar) e removidos (na edição)
  const [arquivosNovos, setArquivosNovos] = useState<Partial<Record<ArquivoKey | 'foto', File>>>({})
  const [removidos, setRemovidos] = useState<Partial<Record<ArquivoKey | 'foto', boolean>>>({})
  const [fotoPreview, setFotoPreview] = useState<string | null>(fotoUrl)
  const [viewTarget, setViewTarget] = useState<ViewerFile | null>(null)
  const [baixando, setBaixando] = useState<string | null>(null)

  // Convite de acesso pela ficha, para quem ainda não tem (na admissão, sai ao finalizar)
  const [concedendo, setConcedendo] = useState(false)

  // Seções conforme a forma de contratação
  const secoes = secoesVisiveis(v.tipo_contrato)
  const [aba, setAba] = useState<SecaoId>(() => (abaInicial && secoes.some((s) => s.id === abaInicial) ? abaInicial : 'identificacao'))
  const idx = Math.max(0, secoes.findIndex((s) => s.id === aba))
  const atual = secoes[idx].id
  const ultima = idx === secoes.length - 1

  // Trocar para PJ/autônomo pode esconder a aba aberta: volta para uma que existe
  useEffect(() => {
    if (!secoes.some((s) => s.id === aba)) setAba(secoes[Math.min(idx, secoes.length - 1)].id)
  }, [secoes, aba, idx])

  const onAbaChangeRef = useRef(onAbaChange)
  onAbaChangeRef.current = onAbaChange
  useEffect(() => { onAbaChangeRef.current?.(atual) }, [atual])

  // Libera as prévias locais de arquivos
  useEffect(() => () => { if (fotoPreview?.startsWith('blob:')) URL.revokeObjectURL(fotoPreview) }, [fotoPreview])

  const pj = isPjOuAutonomo(v.tipo_contrato)
  const ehPj = v.tipo_contrato === 'pj'

  // ── Validação ──
  type Problema = { aba: SecaoId; campos: string[]; mensagem: string }

  function validar(secao: SecaoId): Problema | null {
    if (secao === 'identificacao') {
      const obrig: (keyof Valores)[] = cadastro ? ['tipo_contrato', 'nome', 'telefone', 'email'] : ['tipo_contrato', 'nome']
      const vazios = obrig.filter((k) => !String(v[k]).trim())
      if (vazios.length) return { aba: secao, campos: vazios, mensagem: 'Preencha os campos obrigatórios.' }
      if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) return { aba: secao, campos: ['email'], mensagem: 'Informe um e-mail válido.' }
      const cpf = v.cpf.replace(/\D/g, '')
      if (cpf && cpf.length !== 11) return { aba: secao, campos: ['cpf'], mensagem: 'O CPF precisa ter 11 dígitos.' }
    }
    if (secao === 'cargo' && ehPj) {
      const cnpj = v.cnpj.replace(/\D/g, '')
      if (cnpj && cnpj.length !== 14) return { aba: secao, campos: ['cnpj'], mensagem: 'O CNPJ precisa ter 14 dígitos.' }
    }
    return null
  }

  function validarTudo() {
    for (const s of secoes) { const p = validar(s.id); if (p) return p }
    return null
  }

  function reportar(p: Problema) {
    setInvalid(new Set(p.campos))
    setAba(p.aba)
    toast.error(p.mensagem)
  }

  function avancar() {
    const p = validar(atual)
    if (p) { reportar(p); return }
    setInvalid(new Set())
    setAba(secoes[Math.min(secoes.length - 1, idx + 1)].id)
  }

  // ── Datas: período de experiência e férias calculados a partir da admissão ──
  function onAdmissao(val: string) {
    setV((p) => {
      const n = { ...p, data_admissao: val }
      if (val && !p.fim_experiencia_1) n.fim_experiencia_1 = addDays(val, 44)
      if (val && !p.fim_experiencia_2) n.fim_experiencia_2 = addDays(n.fim_experiencia_1 || addDays(val, 44), 45)
      if (val && !p.vcto_ferias) n.vcto_ferias = addDays(val, 364)
      return n
    })
  }
  const concederAte = v.vcto_ferias ? fmtDate(addDays(v.vcto_ferias, 330)) : ''

  // ── Envio ──
  async function salvar() {
    const p = validarTudo()
    if (p) { reportar(p); return }
    setInvalid(new Set())
    setLoading(true)

    const fd = valoresParaFormData(v)
    for (const [k, file] of Object.entries(arquivosNovos)) if (file) fd.set(`doc_${k}`, file)
    for (const [k, rem] of Object.entries(removidos)) if (rem) fd.set(`remove_${k}`, 'true')

    if (cadastro) {
      if (vagaId) fd.set('vaga_id', vagaId)
      const r = await toast.promise(createEmployeeAction(companyId, fd), {
        loading: 'Cadastrando funcionário…',
        success: `${v.nome.toUpperCase()} foi cadastrado.`,
        error: 'Não foi possível cadastrar o funcionário.',
      })
      if ('error' in r) { setLoading(false); return }
      // Link de auto-cadastro. O e-mail para criar o usuário já saiu no servidor.
      const token = await generateOnboardingTokenAction(r.employeeId)
      setLoading(false)
      router.refresh()
      onCreated?.({ employeeId: r.employeeId, nome: v.nome.toUpperCase(), telefone: v.telefone, link: token.url ?? null, acesso: r.acesso })
      return
    }

    const r = await toast.promise(updateEmployeeAction(employee!.id, fd), {
      loading: 'Salvando alterações…',
      success: `Ficha de ${v.nome.toUpperCase()} atualizada.`,
      error: 'Não foi possível salvar as alterações.',
    })
    setLoading(false)
    if ('error' in r) return
    router.refresh()
    onSaved?.()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // Cadastro: Enter nas etapas intermediárias avança em vez de salvar
    if (cadastro && !ultima) { avancar(); return }
    salvar()
  }

  async function concederAcesso() {
    if (!employee) return
    setConcedendo(true)
    const envio = grantSystemAccessAction(employee.id, companyId).then((r) =>
      'warning' in r && r.warning ? { error: r.warning as string } : r,
    )
    await toast.promise(envio, {
      loading: 'Enviando convite de acesso…',
      success: (r) => ('notice' in r && (r.notice as string)) || `Convite enviado para ${employee.email}.`,
      error: 'Não foi possível conceder o acesso.',
    })
    setConcedendo(false)
    router.refresh()
  }

  // ── Arquivos ──
  const caminho = (k: ArquivoKey | 'foto') =>
    employee ? (k === 'foto' ? employee.foto_path : employee[ARQUIVOS.find((a) => a.key === k)!.col]) : null

  async function baixar(f: ViewerFile) {
    if (!employee) return
    setBaixando(f.id)
    const path = caminho(f.id as ArquivoKey) ?? ''
    const ext = path.split('.').pop() ?? 'pdf'
    const r = await getEmployeeDocUrlAction(employee.id, f.id as ArquivoKey, `${f.titulo} - ${employee.nome}.${ext}`)
    setBaixando(null)
    if (r.error || !r.url) { toast.error(r.error ?? 'Não foi possível baixar o arquivo.'); return }
    triggerDownload(r.url, f.nome)
  }

  function escolherArquivo(k: ArquivoKey, file: File | undefined) {
    if (!file) return
    if (file.size > 20 * 1024 * 1024) { toast.error(`"${file.name}" passa de 20 MB.`); return }
    setArquivosNovos((p) => ({ ...p, [k]: file }))
    setRemovidos((p) => ({ ...p, [k]: false }))
  }

  // ── Render das seções ──
  const cls = (k: string) => invalid.has(k)

  function secaoIdentificacao() {
    return (
      <div className="flex flex-col gap-5">
        {cadastro && (
          <Aviso>
            Para começar, basta a <strong>forma de contratação</strong>, o <strong>nome</strong>, o <strong>telefone</strong> e o{' '}
            <strong>e-mail</strong>. Ao concluir, você recebe um link para o próprio funcionário preencher os demais dados.
          </Aviso>
        )}
        <Grade>
          <Campo label="Nome completo *" valor={v.nome} duplo>
            <Input label="Nome completo *" value={v.nome} onChange={(e) => set('nome')(e.target.value.toUpperCase())}
              placeholder="NOME COMPLETO" invalid={cls('nome')} />
          </Campo>
          <Campo label="Forma de contratação *" valor={labelDe(TIPO_OPTIONS, v.tipo_contrato)}>
            <Select label="Forma de contratação *" options={TIPO_OPTIONS} placeholder="Selecionar..." value={v.tipo_contrato}
              onChange={txt('tipo_contrato')} invalid={cls('tipo_contrato')} disabled={travado('tipo_contrato')} />
          </Campo>
          <Campo label="CPF" valor={v.cpf}>
            <Input label="CPF" value={v.cpf} onChange={(e) => set('cpf')(maskCpf(e.target.value))} placeholder="000.000.000-00" inputMode="numeric" invalid={cls('cpf')} />
          </Campo>
          <Campo label="RG" valor={v.rg}>
            <Input label="RG" value={v.rg} onChange={txt('rg')} placeholder="RG" />
          </Campo>
          <Campo label="Data de nascimento" valor={fmtDate(v.nascimento)}>
            <Input label="Data de nascimento" type="date" value={v.nascimento} onChange={txt('nascimento')} />
          </Campo>
          <Campo label={cadastro ? 'Telefone *' : 'Telefone'} valor={v.telefone}>
            <Input label={cadastro ? 'Telefone *' : 'Telefone'} value={v.telefone} onChange={(e) => set('telefone')(maskTelefone(e.target.value))}
              placeholder="(00) 00000-0000" inputMode="tel" invalid={cls('telefone')} />
          </Campo>
          <Campo label={cadastro ? 'E-mail *' : 'E-mail'} valor={v.email}>
            <Input label={cadastro ? 'E-mail *' : 'E-mail'} type="email" value={v.email} onChange={txt('email')} placeholder="email@exemplo.com" invalid={cls('email')} />
          </Campo>
        </Grade>
      </div>
    )
  }

  function secaoCargo() {
    if (pj) {
      return (
        <Grade>
          {ehPj && (
            <Campo label="CNPJ" valor={v.cnpj}>
              <Input label="CNPJ" value={v.cnpj} onChange={(e) => set('cnpj')(maskCnpj(e.target.value))} placeholder="00.000.000/0001-00" inputMode="numeric" invalid={cls('cnpj')} />
            </Campo>
          )}
          <Campo label="Serviço prestado" valor={v.servico} duplo>
            <Input label="Serviço prestado" value={v.servico} onChange={txt('servico')} placeholder="Ex.: Consultoria de TI, limpeza…" />
          </Campo>
          <Campo label="Valor do contrato (R$)" valor={fmtMoney(v.valor_servico)}>
            <Input label="Valor do contrato (R$)" value={v.valor_servico} onChange={(e) => set('valor_servico')(maskMoeda(e.target.value))} placeholder="0,00" inputMode="numeric" disabled={travado('valor_servico')} />
          </Campo>
          <Campo label="Data de início" valor={fmtDate(v.data_admissao)}>
            <Input label="Data de início" type="date" value={v.data_admissao} onChange={txt('data_admissao')} />
          </Campo>
          <Campo label="Status" valor={labelDe(STATUS_OPTIONS, v.status)}>
            <Select label="Status" options={STATUS_OPTIONS_PJ} value={STATUS_OPTIONS_PJ.some((o) => o.value === v.status) ? v.status : ''}
              placeholder="Selecionar..." onChange={txt('status')} />
          </Campo>
        </Grade>
      )
    }
    return (
      <div className="flex flex-col gap-6">
        <Bloco titulo="Cargo">
          <Grade>
            <Campo label="Cargo" valor={v.cargo}>
              {travado('cargo')
                ? <Input label="Cargo" value={v.cargo} disabled readOnly />
                : <CampoCargo cargos={cargos} value={v.position_id} onChange={(c) => setV((prev) => ({ ...prev, position_id: c?.id ?? '', cargo: c?.nome ?? '', departamento: c?.departamento ?? '' }))} />}
            </Campo>
            <Campo label="Departamento" valor={v.departamento}>
              <Input label="Departamento" value={v.departamento} disabled readOnly hint="Vem do cargo." />
            </Campo>
            <Campo label="Local de trabalho" valor={v.local_trabalho}>
              <Input label="Local de trabalho" value={v.local_trabalho} onChange={txt('local_trabalho')} placeholder="Ex.: Matriz" disabled={travado('local_trabalho')} />
            </Campo>
            <Campo label="Status" valor={labelDe(STATUS_OPTIONS, v.status)}>
              <Select label="Status" options={STATUS_OPTIONS} value={v.status} onChange={txt('status')} />
            </Campo>
            <Campo label="Grau de instrução" valor={labelDe(GRAU_OPTIONS, v.grau_instrucao)}>
              <Select label="Grau de instrução" options={GRAU_OPTIONS} placeholder="Selecionar..." value={v.grau_instrucao} onChange={txt('grau_instrucao')} />
            </Campo>
          </Grade>
        </Bloco>
        <Bloco titulo="Remuneração" descricao="Vale-alimentação e vale-transporte são vinculados na aba Benefícios e acessos.">
          <Grade>
            <Campo label="Salário bruto (R$)" valor={fmtMoney(v.salario)}>
              <Input label="Salário bruto (R$)" value={v.salario} onChange={(e) => set('salario')(maskMoeda(e.target.value))} placeholder="0,00" inputMode="numeric" disabled={travado('salario')} />
            </Campo>
            {!pj && (() => {
              const doCargo = cargos.find((c) => c.id === v.position_id)?.adicional ?? 'nenhum'
              const opcoes = [
                { value: '', label: `Igual ao cargo (${ROTULO_ADICIONAL[doCargo]})` },
                ...ADICIONAIS_CARGO.map((a) => ({ value: a, label: ROTULO_ADICIONAL[a] })),
              ]
              return (
                <Campo label="Adicional de risco" valor={labelDe(opcoes, v.adicional_risco)}>
                  <div className="flex flex-col gap-1">
                    <Select label="Adicional de risco" options={opcoes} value={v.adicional_risco} onChange={txt('adicional_risco')} />
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Mude só se o laudo apontar algo diferente do cargo.</span>
                  </div>
                </Campo>
              )
            })()}
            <Campo label="Plano de saúde" valor={v.plano_saude ? 'Sim' : 'Não'}>
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Plano de saúde</span>
                <div className="h-10 flex items-center"><Toggle value={v.plano_saude} onChange={set('plano_saude')} label={v.plano_saude ? 'Sim' : 'Não'} /></div>
              </div>
            </Campo>
          </Grade>
        </Bloco>
      </div>
    )
  }

  function secaoDatas() {
    const desligado = v.status === 'demitido' || v.status === 'inativo'
    return (
      <div className="flex flex-col gap-6">
        <Bloco titulo="Admissão e contrato">
          <Grade>
            <Campo label="Data de admissão" valor={fmtDate(v.data_admissao)}>
              <Input label="Data de admissão" type="date" value={v.data_admissao} onChange={(e) => onAdmissao(e.target.value)} />
            </Campo>
            <Campo label="Status do contrato" valor={labelDe(CONTRATO_OPTIONS, v.status_contrato)}>
              <Select label="Status do contrato" options={CONTRATO_OPTIONS} placeholder="Selecionar..." value={v.status_contrato} onChange={txt('status_contrato')} />
            </Campo>
            {(desligado || v.data_demissao) && (
              <Campo label="Data de demissão" valor={fmtDate(v.data_demissao)}>
                <Input label="Data de demissão" type="date" value={v.data_demissao} onChange={txt('data_demissao')} />
              </Campo>
            )}
          </Grade>
        </Bloco>
        <Bloco titulo="Período de experiência" descricao={leitura ? 'Até 90 dias no total, em até dois períodos.' : 'Calculado a partir da admissão (45 + 45 dias). Ajuste se necessário.'}>
          <Grade>
            <Campo label="Fim do 1º período" valor={fmtDate(v.fim_experiencia_1)}>
              <Input label="Fim do 1º período" type="date" value={v.fim_experiencia_1} onChange={txt('fim_experiencia_1')} />
            </Campo>
            <Campo label="Fim do 2º período" valor={fmtDate(v.fim_experiencia_2)}>
              <Input label="Fim do 2º período" type="date" value={v.fim_experiencia_2} onChange={txt('fim_experiencia_2')} />
            </Campo>
          </Grade>
        </Bloco>
        <Bloco titulo="Férias e exames">
          <Grade>
            <Campo label="Vencimento de férias" valor={fmtDate(v.vcto_ferias)}>
              <Input label="Vencimento de férias" type="date" value={v.vcto_ferias} onChange={txt('vcto_ferias')} hint={concederAte ? `Conceder até ${concederAte}` : undefined} />
            </Campo>
            <Campo label="Conceder férias até" valor={concederAte}>
              <Input label="Conceder férias até" value={concederAte} disabled placeholder="Calculado pelo vencimento" />
            </Campo>
            <Campo label="Próximo exame periódico" valor={fmtDate(v.exame_periodico)}>
              <Input label="Próximo exame periódico" type="date" value={v.exame_periodico} onChange={txt('exame_periodico')} />
            </Campo>
          </Grade>
        </Bloco>
      </div>
    )
  }

  function secaoDocumentacao() {
    return (
      <div className="flex flex-col gap-6">
        {!pj && (
          <Bloco titulo="Documentos trabalhistas">
            <Grade>
              <Campo label="PIS / PASEP" valor={v.pis_pasep}>
                <Input label="PIS / PASEP" value={v.pis_pasep} onChange={txt('pis_pasep')} placeholder="000.00000.00-0" />
              </Campo>
              <Campo label="Matrícula" valor={v.matricula}>
                <Input label="Matrícula" value={v.matricula} onChange={txt('matricula')} placeholder="Nº funcional" />
              </Campo>
              <Campo label="Série da CTPS" valor={v.serie_ctps}>
                <Input label="Série da CTPS" value={v.serie_ctps} onChange={txt('serie_ctps')} placeholder="Ex.: 001" />
              </Campo>
              <Campo label="Certificado de reservista" valor={v.certificado_reservista}>
                <Input label="Certificado de reservista" value={v.certificado_reservista} onChange={txt('certificado_reservista')} placeholder="Nº / categoria" />
              </Campo>
              <Campo label="Dependentes" valor={v.dependentes}>
                <Input label="Dependentes" type="number" min={0} value={v.dependentes} onChange={txt('dependentes')} />
              </Campo>
            </Grade>
          </Bloco>
        )}
        <Bloco titulo="Dados bancários" descricao={pj ? 'Para o pagamento do contrato.' : 'Para o pagamento do salário.'}>
          <Grade>
            <Campo label="Banco, agência, conta e/ou chave PIX" valor={v.dados_bancarios} largo>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Banco, agência, conta e/ou chave PIX</label>
                <textarea
                  value={v.dados_bancarios}
                  onChange={txt('dados_bancarios')}
                  rows={3}
                  placeholder="Ex.: Banco do Brasil · Ag. 0000 · CC 00000-0 · PIX: email@exemplo.com"
                  className="w-full rounded-lg border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
                  style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', backgroundColor: '#fff' }}
                />
              </div>
            </Campo>
          </Grade>
        </Bloco>
      </div>
    )
  }

  function secaoBeneficios() {
    const vinculados = companyBenefits.filter((b) => v.benefit_ids.includes(b.id))
    const temAcesso = !!employee?.profile_id
    return (
      <div className="flex flex-col gap-6">
        {!pj && (
          <Bloco titulo="Benefícios" descricao={companyBenefits.length === 0 ? 'Nenhum benefício cadastrado. Crie o catálogo em Pessoas → Benefícios.' : undefined}>
            {leitura ? (
              vinculados.length ? (
                <div className="flex flex-wrap gap-2">
                  {vinculados.map((b) => (
                    <span key={b.id} className="text-sm px-3 py-1.5 rounded-full" style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}>
                      {b.nome} · {fmtMoney(b.valor)}{b.por_dia_trabalhado ? '/dia' : '/mês'}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Nenhum benefício vinculado.</p>
              )
            ) : companyBenefits.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {companyBenefits.map((b) => {
                  const marcado = v.benefit_ids.includes(b.id)
                  return (
                    <label key={b.id} className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${travado('benefit_ids') ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                      style={{ borderColor: marcado ? 'var(--color-brand)' : 'var(--color-card-border)', backgroundColor: marcado ? 'var(--color-brand-light)' : '#fff', opacity: travado('benefit_ids') && !marcado ? 0.5 : 1 }}>
                      <input
                        type="checkbox"
                        checked={marcado}
                        disabled={travado('benefit_ids')}
                        onChange={(e) => set('benefit_ids')(e.target.checked ? [...v.benefit_ids, b.id] : v.benefit_ids.filter((id) => id !== b.id))}
                        className="mt-0.5 w-4 h-4"
                        style={{ accentColor: 'var(--color-brand)' }}
                      />
                      <span>
                        <span className="block text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{b.nome}</span>
                        <span className="block text-xs" style={{ color: 'var(--color-text-muted)' }}>{fmtMoney(b.valor)}{b.por_dia_trabalhado ? '/dia' : '/mês'}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
            )}
          </Bloco>
        )}

        {!pj && (cadastro ? (
          <Toggle value={v.pin_ativo} onChange={set('pin_ativo')} label="Registra ponto" />
        ) : (
          <Bloco titulo="Registro de ponto" descricao="O funcionário bate o ponto no sistema, confirmando com o PIN de segurança da conta dele.">
            {leitura
              ? <Grade><Campo label="Registra ponto" valor={v.pin_ativo ? 'Sim' : 'Não'}>{null}</Campo></Grade>
              : <Toggle value={v.pin_ativo} onChange={set('pin_ativo')} label="Registra ponto" />}
          </Bloco>
        ))}

        {!cadastro && <Bloco titulo="Acesso ao sistema" descricao="Com acesso, o funcionário entra no sistema como colaborador e vê os próprios dados.">
          {temAcesso ? (
            <p className="text-sm flex items-center gap-2" style={{ color: '#15803D' }}><Icon name="check" size={16} /> Tem acesso ao sistema.</p>
          ) : employee?.status === 'demitido' || employee?.status === 'inativo' ? (
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Sem acesso ao sistema: a pessoa foi desligada.</p>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Ainda não tem acesso ao sistema.</p>
              {podeGerenciar && (
                <Button type="button" variant="secondary" size="sm" onClick={concederAcesso} loading={concedendo} disabled={!employee?.email}
                  title={employee?.email ? undefined : 'Cadastre um e-mail para conceder o acesso'}>
                  Enviar convite de acesso
                </Button>
              )}
            </div>
          )}
        </Bloco>}
      </div>
    )
  }

  function secaoArquivos() {
    const fotoSalva = !!employee?.foto_path && !removidos.foto
    return (
      <div className="flex flex-col gap-6">
        <Bloco titulo="Foto">
          {leitura ? (
            <span className="w-32 h-32 rounded-full overflow-hidden flex items-center justify-center" style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {fotoUrl ? <img src={fotoUrl} alt={v.nome} className="w-full h-full object-cover" /> : <Icon name="user" size={48} />}
            </span>
          ) : (
            <div className="self-start">
              <FotoPicker
                preview={fotoPreview}
                alt={`Foto de ${v.nome || 'funcionário'}`}
                onPick={(file) => {
                  setArquivosNovos((p) => ({ ...p, foto: file }))
                  setRemovidos((p) => ({ ...p, foto: false }))
                  setFotoPreview(URL.createObjectURL(file))
                }}
                onRemove={() => {
                  setArquivosNovos((p) => ({ ...p, foto: undefined }))
                  if (fotoSalva) setRemovidos((p) => ({ ...p, foto: true }))
                  setFotoPreview(null)
                }}
              />
            </div>
          )}
        </Bloco>

        <Bloco titulo="Documentos" descricao={leitura ? undefined : 'Imagens (JPG, PNG) ou PDF, até 20 MB cada. Todos são opcionais.'}>
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {ARQUIVOS.map((a) => {
              const salvo = caminho(a.key)
              const novo = arquivosNovos[a.key]
              const removido = !!removidos[a.key]
              const tem = !!novo || (!!salvo && !removido)
              const status = novo ? novo.name : removido ? 'Será removido ao salvar' : salvo ? 'Anexado' : 'Não anexado'
              const abrir = salvo && !novo && !removido
                ? () => setViewTarget({ id: a.key, titulo: a.label, nome: `${a.label}.${salvo.split('.').pop()}`, tipo: tipoPorCaminho(salvo) })
                : undefined
              return (
                <li key={a.key} className="flex items-center gap-3 rounded-xl border px-3.5 py-3"
                  style={{ borderColor: tem ? 'var(--color-brand)' : 'var(--color-card-border)', backgroundColor: tem ? 'var(--color-brand-light)' : '#fff' }}>
                  <span className="shrink-0" style={{ color: tem ? 'var(--color-brand)' : 'var(--color-text-muted)' }}><Icon name="file" size={18} /></span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>{a.label}</p>
                    <p className="text-xs truncate" style={{ color: removido ? '#B91C1C' : 'var(--color-text-muted)' }}>{status}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {abrir && (
                      <button type="button" onClick={abrir} className="p-1.5 rounded-lg hover:bg-white/70" style={{ color: 'var(--color-brand)' }} aria-label={`Visualizar ${a.label}`} title="Visualizar">
                        <Icon name="eye" size={16} />
                      </button>
                    )}
                    {!leitura && !('somenteLeitura' in a) && (
                      novo ? (
                        <button type="button" onClick={() => setArquivosNovos((p) => ({ ...p, [a.key]: undefined }))} className="text-xs font-medium px-2 py-1 rounded-lg hover:bg-white/70" style={{ color: '#B91C1C' }}>
                          Cancelar
                        </button>
                      ) : removido ? (
                        <button type="button" onClick={() => setRemovidos((p) => ({ ...p, [a.key]: false }))} className="text-xs font-medium px-2 py-1 rounded-lg hover:bg-white/70" style={{ color: 'var(--color-text-secondary)' }}>
                          Desfazer
                        </button>
                      ) : (
                        <>
                          <label className="text-xs font-medium px-2 py-1 rounded-lg cursor-pointer hover:bg-white/70" style={{ color: 'var(--color-brand)' }}>
                            {salvo ? 'Trocar' : 'Anexar'}
                            <input type="file" accept="image/*,application/pdf" className="hidden"
                              onChange={(e) => { escolherArquivo(a.key, e.target.files?.[0]); e.target.value = '' }} />
                          </label>
                          {salvo && (
                            <button type="button" onClick={() => setRemovidos((p) => ({ ...p, [a.key]: true }))} className="p-1.5 rounded-lg hover:bg-white/70" style={{ color: '#B91C1C' }} aria-label={`Remover ${a.label}`} title="Remover">
                              <Icon name="trash" size={16} />
                            </button>
                          )}
                        </>
                      )
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </Bloco>
      </div>
    )
  }

  const conteudo: Record<SecaoId, () => React.ReactNode> = {
    identificacao: secaoIdentificacao,
    cargo: secaoCargo,
    datas: secaoDatas,
    documentacao: secaoDocumentacao,
    beneficios: secaoBeneficios,
    arquivos: secaoArquivos,
  }

  const labels = secoes.map((s) => s.label)

  return (
    <SomenteLeitura.Provider value={leitura}>
      {cadastro ? (
        <Stepper labels={labels} step={idx} onSelect={(i) => setAba(secoes[i].id)} />
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-x-4">
          <Tabs labels={labels} step={idx} onSelect={(i) => setAba(secoes[i].id)} />
          {acoes && <div className="flex flex-wrap items-center gap-2 mb-6">{acoes}</div>}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
        {conteudo[atual]()}

        {!leitura && (
          <div className="flex items-center justify-between gap-2 pt-2 border-t" style={{ borderColor: 'var(--color-card-border)' }}>
            <Button type="button" variant="secondary" className="mt-4" onClick={cadastro && idx > 0 ? () => setAba(secoes[idx - 1].id) : onCancel}>
              {cadastro && idx > 0 ? 'Voltar' : 'Cancelar'}
            </Button>
            {cadastro && !ultima ? (
              <Button key="next" type="button" className="mt-4" onClick={avancar}>Avançar</Button>
            ) : (
              <Button key="submit" type="submit" className="mt-4" loading={loading}>{cadastro ? 'Concluir admissão' : 'Salvar alterações'}</Button>
            )}
          </div>
        )}
      </form>

      {employee && (
        <FileViewer
          file={viewTarget}
          getUrl={(id) => getEmployeeDocUrlAction(employee.id, id as ArquivoKey)}
          onClose={() => setViewTarget(null)}
          onDownload={baixar}
          downloading={!!viewTarget && baixando === viewTarget.id}
        />
      )}
    </SomenteLeitura.Provider>
  )
}
