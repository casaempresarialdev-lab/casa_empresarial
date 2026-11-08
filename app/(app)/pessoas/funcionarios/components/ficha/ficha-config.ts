import type { Employee } from '../../queries'

// ── Opções ───────────────────────────────────────────────────────────────────

export const TIPO_OPTIONS = [
  { value: 'clt', label: 'CLT' },
  { value: 'estagio', label: 'Estágio' },
  { value: 'menor_aprendiz', label: 'Menor Aprendiz' },
  { value: 'pj', label: 'PJ (Pessoa Jurídica)' },
  { value: 'autonomo', label: 'Autônomo' },
]

export const STATUS_OPTIONS = [
  { value: 'admissao', label: 'Admissão' },
  { value: 'experiencia', label: 'Experiência' },
  { value: 'ativo', label: 'Ativo' },
  { value: 'ferias', label: 'Férias' },
  { value: 'afastado', label: 'Afastado' },
  { value: 'inativo', label: 'Inativo' },
  { value: 'demitido', label: 'Demitido' },
]
// PJ / autônomo não passam por experiência, férias etc.
export const STATUS_OPTIONS_PJ = STATUS_OPTIONS.filter((o) => ['ativo', 'inativo'].includes(o.value))

export const CONTRATO_OPTIONS = [
  { value: 'assinado', label: 'Assinado' },
  { value: 'nao_assinado', label: 'Não assinado' },
  { value: 'nao_tem', label: 'Não tem' },
]

export const GRAU_OPTIONS = [
  'Fundamental Incompleto', 'Fundamental Completo', 'Médio Incompleto', 'Médio Completo',
  'Técnico', 'Superior Incompleto', 'Superior Completo', 'Pós-graduação', 'Mestrado', 'Doutorado',
].map((g) => ({ value: g, label: g }))

// Cadastros antigos gravavam o grau em snake_case
const GRAU_LEGADO: Record<string, string> = {
  fundamental_incompleto: 'Fundamental Incompleto',
  fundamental_completo: 'Fundamental Completo',
  medio_incompleto: 'Médio Incompleto',
  medio_completo: 'Médio Completo',
  superior_incompleto: 'Superior Incompleto',
  superior_completo: 'Superior Completo',
  pos_graduacao: 'Pós-graduação',
}

export const STATUS_CFG: Record<string, { label: string; bg: string; color: string }> = {
  admissao:    { label: 'Admissão',    bg: '#DBEAFE', color: '#1D4ED8' },
  experiencia: { label: 'Experiência', bg: '#FEF3C7', color: '#B45309' },
  ativo:       { label: 'Ativo',       bg: '#DCFCE7', color: '#15803D' },
  ferias:      { label: 'Férias',      bg: '#E0F2FE', color: '#0369A1' },
  afastado:    { label: 'Afastado',    bg: '#F3E8FF', color: '#7E22CE' },
  inativo:     { label: 'Inativo',     bg: '#F3F4F6', color: '#6B7280' },
  demitido:    { label: 'Demitido',    bg: '#FEE2E2', color: '#B91C1C' },
}

// Arquivos da ficha (a foto fica à parte)
export const ARQUIVOS = [
  { key: 'rg_cnh_frente', label: 'RG frente / CNH', col: 'doc_rg_cnh_frente_path' },
  { key: 'rg_verso', label: 'RG verso', col: 'doc_rg_verso_path' },
  { key: 'cpf', label: 'CPF', col: 'doc_cpf_path' },
  { key: 'ctps', label: 'Carteira de Trabalho', col: 'doc_ctps_path' },
  { key: 'pis', label: 'PIS', col: 'doc_pis_path' },
  { key: 'titulo_eleitor', label: 'Título de Eleitor', col: 'doc_titulo_eleitor_path' },
  { key: 'certidao', label: 'Certidão Nasc./Casamento', col: 'doc_certidao_path' },
  { key: 'comprovante_residencia', label: 'Comprovante de Residência', col: 'doc_comprovante_residencia_path' },
  { key: 'exame_admissional', label: 'Exame Admissional', col: 'doc_exame_admissional_path' },
  // Gerado no aceite: é o registro da proposta, não pode ser trocado
  { key: 'carta_proposta', label: 'Carta proposta aceita', col: 'doc_carta_proposta_path', somenteLeitura: true },
  { key: 'contrato', label: 'Contrato de trabalho', col: 'doc_contrato_path' },
  { key: 'exame_demissional', label: 'Exame Demissional', col: 'doc_exame_demissional_path' },
  { key: 'trct', label: 'TRCT assinado', col: 'doc_trct_path' },
] as const satisfies readonly { key: string; label: string; col: keyof Employee; somenteLeitura?: boolean }[]

export type ArquivoKey = (typeof ARQUIVOS)[number]['key']

// ── Seções (etapas no cadastro, abas na ficha) ───────────────────────────────

export type SecaoId = 'identificacao' | 'cargo' | 'datas' | 'documentacao' | 'beneficios' | 'arquivos'

export const SECOES: { id: SecaoId; label: string }[] = [
  { id: 'identificacao', label: 'Identificação' },
  { id: 'cargo', label: 'Cargo e remuneração' },
  { id: 'datas', label: 'Datas e contrato' },
  { id: 'documentacao', label: 'Documentação' },
  { id: 'beneficios', label: 'Benefícios e acessos' },
  { id: 'arquivos', label: 'Foto e arquivos' },
]

export const isPjOuAutonomo = (tipo: string | null | undefined) => tipo === 'pj' || tipo === 'autonomo'

/** Seções que se aplicam (PJ/autônomo não têm datas trabalhistas) — iguais no cadastro, na ficha e na edição */
export function secoesVisiveis(tipo: string | null | undefined) {
  return SECOES
    .filter((s) => !(s.id === 'datas' && isPjOuAutonomo(tipo)))
    .map((s) => (s.id === 'cargo' && isPjOuAutonomo(tipo) ? { ...s, label: 'Contrato e valores' } : s))
}

export const isSecaoId = (v: string | null | undefined): v is SecaoId => SECOES.some((s) => s.id === v)

/** Extensão → tipo do arquivo (para o visualizador) */
export function tipoPorCaminho(path: string) {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'pdf') return 'application/pdf'
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return `image/${ext === 'jpg' ? 'jpeg' : ext}`
  return null
}

// ── Formatação ───────────────────────────────────────────────────────────────

export function maskCpf(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

export function maskCnpj(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 14)
  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

export function maskTelefone(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d.length ? `(${d}` : ''
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

export function fmtDate(iso: string | null | undefined) {
  if (!iso) return ''
  const [y, m, d] = iso.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

export function fmtMoney(v: number | string | null | undefined) {
  if (v === null || v === undefined || v === '') return ''
  const n = typeof v === 'number' ? v : Number(normalizarValor(String(v)))
  return Number.isNaN(n) ? '' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function addDays(iso: string, days: number) {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const labelDe = (opts: { value: string; label: string }[], v: string | null | undefined) =>
  (v && opts.find((o) => o.value === v)?.label) || (v ? GRAU_LEGADO[v] ?? v : '')

export const tipoLabel = (v: string | null | undefined) => labelDe(TIPO_OPTIONS, v).replace(' (Pessoa Jurídica)', '')

export const iniciais = (nome: string) =>
  nome.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?'

// ── Valores do formulário ────────────────────────────────────────────────────

export type Valores = {
  tipo_contrato: string
  nome: string
  cpf: string
  rg: string
  nascimento: string
  telefone: string
  email: string
  position_id: string
  cargo: string
  departamento: string
  local_trabalho: string
  status: string
  grau_instrucao: string
  salario: string
  plano_saude: boolean
  cnpj: string
  servico: string
  valor_servico: string
  data_admissao: string
  status_contrato: string
  fim_experiencia_1: string
  fim_experiencia_2: string
  vcto_ferias: string
  exame_periodico: string
  data_demissao: string
  pis_pasep: string
  matricula: string
  serie_ctps: string
  certificado_reservista: string
  dependentes: string
  dados_bancarios: string
  benefit_ids: string[]
  pin: string
  pin_ativo: boolean
}

// 2500 → "2.500,00" (como o usuário digita)
const valorBr = (n: number | null | undefined) =>
  n != null ? n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''

export function valoresIniciais(e: Employee | null): Valores {
  return {
    tipo_contrato: e?.tipo_contrato ?? '',
    nome: e?.nome ?? '',
    cpf: e?.cpf ? maskCpf(e.cpf) : '',
    rg: e?.rg ?? '',
    nascimento: e?.nascimento ?? '',
    telefone: e?.telefone ?? '',
    email: e?.email ?? '',
    position_id: e?.position_id ?? '',
    cargo: e?.cargo ?? '',
    departamento: e?.departamento ?? '',
    local_trabalho: e?.local_trabalho ?? '',
    status: e?.status ?? 'admissao',
    grau_instrucao: e?.grau_instrucao ? labelDe(GRAU_OPTIONS, e.grau_instrucao) : '',
    salario: valorBr(e?.salario),
    plano_saude: e?.plano_saude ?? false,
    cnpj: e?.cnpj ? maskCnpj(e.cnpj) : '',
    servico: e?.servico ?? '',
    valor_servico: valorBr(e?.valor_servico),
    data_admissao: e?.data_admissao ?? '',
    status_contrato: e?.status_contrato ?? '',
    fim_experiencia_1: e?.fim_experiencia_1 ?? '',
    fim_experiencia_2: e?.fim_experiencia_2 ?? '',
    vcto_ferias: e?.vcto_ferias ?? '',
    exame_periodico: e?.exame_periodico ?? '',
    data_demissao: e?.data_demissao ?? '',
    pis_pasep: e?.pis_pasep ?? '',
    matricula: e?.matricula ?? '',
    serie_ctps: e?.serie_ctps ?? '',
    certificado_reservista: e?.certificado_reservista ?? '',
    dependentes: String(e?.dependentes ?? 0),
    dados_bancarios: e?.dados_bancarios ?? '',
    benefit_ids: e?.employee_benefits?.map((b) => b.benefit_id) ?? [],
    pin: e?.pin ?? '',
    pin_ativo: e?.pin_ativo ?? false,
  }
}

/** "2.500,50" / "2500.5" → "2500.50" (o servidor espera ponto decimal) */
/**
 * Máscara de moeda ao digitar: os dígitos viram centavos, como em app de banco
 * ("2" → "0,02", "250000" → "2.500,00"). Apagando tudo, fica vazio.
 */
export function maskMoeda(v: string) {
  const digitos = v.replace(/\D/g, '').replace(/^0+/, '').slice(0, 13)
  if (!digitos) return ''
  return (Number(digitos) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function normalizarValor(v: string) {
  const s = v.trim().replace(/[R$\s]/g, '')
  if (!s) return ''
  return s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s
}

/** Monta o FormData esperado por createEmployeeAction / updateEmployeeAction */
export function valoresParaFormData(v: Valores) {
  const fd = new FormData()
  for (const [k, val] of Object.entries(v)) {
    if (k === 'benefit_ids') fd.set(k, JSON.stringify(val))
    else if (k === 'salario' || k === 'valor_servico') fd.set(k, normalizarValor(val as string))
    else fd.set(k, typeof val === 'boolean' ? String(val) : (val as string))
  }
  return fd
}
