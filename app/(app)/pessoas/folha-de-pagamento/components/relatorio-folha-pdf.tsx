import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  Image,
} from '@react-pdf/renderer'
import type { EmployeeForPayroll } from '../queries'
import type { Company } from '../../../empresa/queries'

// ── Tipagem interna ──────────────────────────────────────────────────────────
export type PayrollPdfRow = {
  nome: string
  cpf: string | null
  regime: string
  cargo: string | null
  bruto: number
  inss: number
  irpf: number
  desc6VT: number
  fixoVA: number
  liquido: number
  fgts: number
  custoVA: number
  custoVT: number
  custoTotal: number
  statusContrato: string | null
  dataAdmissao: string | null
  vctoFerias: string | null
  concederAte: string | null
  exame: string | null
}

export type PayrollPdfTotals = {
  bruto: number
  inss: number
  irpf: number
  liquido: number
  fgts: number
  custo: number
}

interface Props {
  company: Company | null
  rows: PayrollPdfRow[]
  totals: PayrollPdfTotals
  mesAnoLabel: string
  geradoEm: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const R = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const fmtDate = (iso: string | null) => {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const fmtCpf = (cpf: string | null) => {
  if (!cpf) return '—'
  const d = cpf.replace(/\D/g, '')
  if (d.length !== 11) return cpf
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

const fmtCnpj = (cnpj: string | null) => {
  if (!cnpj) return '—'
  const d = cnpj.replace(/\D/g, '')
  if (d.length !== 14) return cnpj
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

const REGIME_LABEL: Record<string, string> = {
  clt: 'CLT',
  pj: 'PJ',
  estagio: 'Estágio',
  menor_aprendiz: 'M. Aprendiz',
}

const CONTRATO_LABEL: Record<string, string> = {
  assinado: 'Assinado',
  nao_tem: 'Sem contrato',
  nao_assinado: 'Não assinado',
}

// ── Paleta ───────────────────────────────────────────────────────────────────
const C = {
  primary:  '#2C3E50',
  accent:   '#C19A6B',
  green:    '#1E8449',
  orange:   '#E67E22',
  red:      '#C0392B',
  blue:     '#2471A3',
  bg:       '#F8F9FA',
  bgAlt:    '#FFFFFF',
  border:   '#E5E7EB',
  muted:    '#6B7280',
  text:     '#1F2937',
  textSub:  '#4B5563',
}

// ── Estilos ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 7.5,
    color: C.text,
    backgroundColor: C.bgAlt,
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 32,
  },

  // Cabeçalho
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 2,
    borderBottomColor: C.accent,
    paddingBottom: 8,
    marginBottom: 12,
  },
  headerLeft: { flexDirection: 'column', gap: 2 },
  headerRight: { alignItems: 'flex-end', gap: 2 },
  headerLogo: { width: 36, height: 36, marginBottom: 4, borderRadius: 4 },
  companyName: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.primary },
  companyDetail: { fontSize: 7, color: C.muted },
  reportTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: C.primary },
  reportSub: { fontSize: 8, color: C.muted, marginTop: 2 },

  // Cards de resumo
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  card: {
    flex: 1,
    backgroundColor: C.bg,
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardLabel: { fontSize: 6.5, color: C.muted, marginBottom: 3, textTransform: 'uppercase' },
  cardValue: { fontSize: 11, fontFamily: 'Helvetica-Bold' },

  // Seção
  sectionTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: C.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 5,
    marginTop: 4,
    borderLeftWidth: 3,
    borderLeftColor: C.accent,
    paddingLeft: 6,
  },

  // Tabela genérica
  table: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 14,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: C.primary,
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  tableHeaderCell: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: '#FFFFFF',
    textAlign: 'right',
  },
  tableHeaderCellLeft: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: '#FFFFFF',
    textAlign: 'left',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  tableRowAlt: {
    backgroundColor: '#F9FAFB',
  },
  tableCell: {
    fontSize: 7,
    color: C.textSub,
    textAlign: 'right',
  },
  tableCellLeft: {
    fontSize: 7,
    color: C.text,
    textAlign: 'left',
  },
  tableCellBold: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: C.text,
    textAlign: 'right',
  },
  tableFooter: {
    flexDirection: 'row',
    backgroundColor: C.primary,
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  tableFooterCell: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#FFFFFF',
    textAlign: 'right',
  },
  tableFooterCellLeft: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#FFFFFF',
    textAlign: 'left',
  },

  // Rodapé de página
  footer: {
    position: 'absolute',
    bottom: 14,
    left: 24,
    right: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 5,
  },
  footerText: { fontSize: 6, color: C.muted },
  footerDisclaimer: { fontSize: 5.5, color: C.muted, maxWidth: 360, textAlign: 'center' },
})

// ── Rodapé de página (render) ────────────────────────────────────────────────
function Footer({ geradoEm }: { geradoEm: string }) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>{geradoEm}</Text>
      <Text style={s.footerDisclaimer}>
        Valores estimados — INSS/IRPF pela tabela progressiva 2024. Não substitui documento contábil oficial.
      </Text>
      <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
    </View>
  )
}

// ── Cabeçalho de página ──────────────────────────────────────────────────────
function Header({ company, mesAnoLabel, geradoEm }: { company: Company | null; mesAnoLabel: string; geradoEm: string }) {
  const nome = company?.nome_fantasia ?? company?.razao_social ?? 'Empresa'
  const cnpj = fmtCnpj(company?.cnpj ?? null)
  const local = [company?.cidade, company?.uf].filter(Boolean).join(' / ')

  return (
    <View style={s.header} fixed>
      <View style={s.headerLeft}>
        {company?.logo_url && (
          <Image src={company.logo_url} style={s.headerLogo} />
        )}
        <Text style={s.companyName}>{nome}</Text>
        <Text style={s.companyDetail}>CNPJ: {cnpj}</Text>
        {local ? <Text style={s.companyDetail}>{local}</Text> : null}
        {company?.telefone ? <Text style={s.companyDetail}>{company.telefone}</Text> : null}
        {company?.email ? <Text style={s.companyDetail}>{company.email}</Text> : null}
      </View>
      <View style={s.headerRight}>
        <Text style={s.reportTitle}>Folha de Pagamento</Text>
        <Text style={s.reportSub}>{mesAnoLabel}</Text>
        <Text style={[s.companyDetail, { marginTop: 4 }]}>Gerado em {geradoEm}</Text>
      </View>
    </View>
  )
}

// ── Página 1: Resumo + Proventos/Descontos ───────────────────────────────────
function Page1({ company, rows, totals, mesAnoLabel, geradoEm }: Props) {
  // col widths em % (devem somar 100)
  const W = { nome: '22%', cpf: '10%', regime: '7%', cargo: '10%', bruto: '10%', inss: '8%', irpf: '7%', vt: '7%', va: '7%', liq: '12%' }

  return (
    <Page size="A4" orientation="landscape" style={s.page}>
      <Header company={company} mesAnoLabel={mesAnoLabel} geradoEm={geradoEm} />

      {/* Cards de resumo */}
      <View style={s.summaryRow}>
        <View style={s.card}>
          <Text style={s.cardLabel}>Salário Líquido Total</Text>
          <Text style={[s.cardValue, { color: C.green }]}>{R(totals.liquido)}</Text>
        </View>
        <View style={s.card}>
          <Text style={s.cardLabel}>Salário Bruto Total</Text>
          <Text style={[s.cardValue, { color: C.primary }]}>{R(totals.bruto)}</Text>
        </View>
        <View style={s.card}>
          <Text style={s.cardLabel}>FGTS do Mês</Text>
          <Text style={[s.cardValue, { color: C.orange }]}>{R(totals.fgts)}</Text>
        </View>
        <View style={s.card}>
          <Text style={s.cardLabel}>Custo Total Empresa</Text>
          <Text style={[s.cardValue, { color: C.primary }]}>{R(totals.custo)}</Text>
        </View>
        <View style={s.card}>
          <Text style={s.cardLabel}>Total INSS</Text>
          <Text style={[s.cardValue, { color: C.red }]}>{R(totals.inss)}</Text>
        </View>
        <View style={s.card}>
          <Text style={s.cardLabel}>Total IRPF</Text>
          <Text style={[s.cardValue, { color: C.red }]}>{R(totals.irpf)}</Text>
        </View>
      </View>

      {/* Tabela proventos e descontos */}
      <Text style={s.sectionTitle}>Proventos e Descontos</Text>
      <View style={s.table}>
        <View style={s.tableHeader}>
          <Text style={[s.tableHeaderCellLeft, { width: W.nome }]}>Nome</Text>
          <Text style={[s.tableHeaderCell, { width: W.cpf }]}>CPF</Text>
          <Text style={[s.tableHeaderCell, { width: W.regime }]}>Regime</Text>
          <Text style={[s.tableHeaderCellLeft, { width: W.cargo }]}>Cargo</Text>
          <Text style={[s.tableHeaderCell, { width: W.bruto }]}>Sal. Bruto</Text>
          <Text style={[s.tableHeaderCell, { width: W.inss }]}>INSS</Text>
          <Text style={[s.tableHeaderCell, { width: W.irpf }]}>IRPF</Text>
          <Text style={[s.tableHeaderCell, { width: W.vt }]}>6% VT</Text>
          <Text style={[s.tableHeaderCell, { width: W.va }]}>Fixo VA</Text>
          <Text style={[s.tableHeaderCell, { width: W.liq }]}>Sal. Líquido</Text>
        </View>

        {rows.map((r, i) => (
          <View key={i} style={[s.tableRow, i % 2 !== 0 ? s.tableRowAlt : {}]}>
            <Text style={[s.tableCellLeft, { width: W.nome }]} >{r.nome}</Text>
            <Text style={[s.tableCell, { width: W.cpf }]}>{fmtCpf(r.cpf)}</Text>
            <Text style={[s.tableCell, { width: W.regime }]}>{REGIME_LABEL[r.regime] ?? r.regime ?? '—'}</Text>
            <Text style={[s.tableCellLeft, { width: W.cargo }]} >{r.cargo ?? '—'}</Text>
            <Text style={[s.tableCell, { width: W.bruto }]}>{R(r.bruto)}</Text>
            <Text style={[s.tableCell, { width: W.inss, color: C.red }]}>-{R(r.inss)}</Text>
            <Text style={[s.tableCell, { width: W.irpf, color: r.irpf > 0 ? C.red : C.muted }]}>
              {r.irpf > 0 ? `-${R(r.irpf)}` : '—'}
            </Text>
            <Text style={[s.tableCell, { width: W.vt, color: r.desc6VT > 0 ? C.red : C.muted }]}>
              {r.desc6VT > 0 ? `-${R(r.desc6VT)}` : '—'}
            </Text>
            <Text style={[s.tableCell, { width: W.va, color: r.fixoVA > 0 ? C.red : C.muted }]}>
              {r.fixoVA > 0 ? `-${R(r.fixoVA)}` : '—'}
            </Text>
            <Text style={[s.tableCellBold, { width: W.liq, color: C.green }]}>{R(r.liquido)}</Text>
          </View>
        ))}

        <View style={s.tableFooter}>
          <Text style={[s.tableFooterCellLeft, { width: W.nome }]}>TOTAL — {rows.length} func.</Text>
          <Text style={{ width: W.cpf }} />
          <Text style={{ width: W.regime }} />
          <Text style={{ width: W.cargo }} />
          <Text style={[s.tableFooterCell, { width: W.bruto }]}>{R(totals.bruto)}</Text>
          <Text style={[s.tableFooterCell, { width: W.inss }]}>-{R(totals.inss)}</Text>
          <Text style={[s.tableFooterCell, { width: W.irpf }]}>-{R(totals.irpf)}</Text>
          <Text style={{ width: W.vt }} />
          <Text style={{ width: W.va }} />
          <Text style={[s.tableFooterCell, { width: W.liq }]}>{R(totals.liquido)}</Text>
        </View>
      </View>

      <Footer geradoEm={geradoEm} />
    </Page>
  )
}

// ── Página 2: Custo Patronal + Agenda RH ────────────────────────────────────
function Page2({ company, rows, totals, mesAnoLabel, geradoEm }: Props) {
  const WC = { nome: '28%', fgts: '12%', alim: '12%', transp: '12%', custo: '16%', gap: '20%' }
  const WH = { nome: '22%', contrato: '14%', admissao: '12%', ferias: '12%', conceder: '12%', exame: '12%', gap: '16%' }

  return (
    <Page size="A4" orientation="landscape" style={s.page}>
      <Header company={company} mesAnoLabel={mesAnoLabel} geradoEm={geradoEm} />

      {/* Custo patronal */}
      <Text style={s.sectionTitle}>Custo Patronal</Text>
      <View style={s.table}>
        <View style={s.tableHeader}>
          <Text style={[s.tableHeaderCellLeft, { width: WC.nome }]}>Nome</Text>
          <Text style={[s.tableHeaderCell, { width: WC.fgts }]}>FGTS (8%)</Text>
          <Text style={[s.tableHeaderCell, { width: WC.alim }]}>Alimentação</Text>
          <Text style={[s.tableHeaderCell, { width: WC.transp }]}>Transporte</Text>
          <Text style={[s.tableHeaderCell, { width: WC.custo }]}>Custo Total</Text>
          <Text style={{ width: WC.gap }} />
        </View>
        {rows.map((r, i) => (
          <View key={i} style={[s.tableRow, i % 2 !== 0 ? s.tableRowAlt : {}]}>
            <Text style={[s.tableCellLeft, { width: WC.nome }]} >{r.nome}</Text>
            <Text style={[s.tableCell, { width: WC.fgts, color: C.orange }]}>{R(r.fgts)}</Text>
            <Text style={[s.tableCell, { width: WC.alim, color: r.custoVA > 0 ? C.textSub : C.muted }]}>
              {r.custoVA > 0 ? R(r.custoVA) : '—'}
            </Text>
            <Text style={[s.tableCell, { width: WC.transp, color: r.custoVT > 0 ? C.textSub : C.muted }]}>
              {r.custoVT > 0 ? R(r.custoVT) : '—'}
            </Text>
            <Text style={[s.tableCellBold, { width: WC.custo }]}>{R(r.custoTotal)}</Text>
            <Text style={{ width: WC.gap }} />
          </View>
        ))}
        <View style={s.tableFooter}>
          <Text style={[s.tableFooterCellLeft, { width: WC.nome }]}>TOTAL</Text>
          <Text style={[s.tableFooterCell, { width: WC.fgts }]}>{R(totals.fgts)}</Text>
          <Text style={{ width: WC.alim }} />
          <Text style={{ width: WC.transp }} />
          <Text style={[s.tableFooterCell, { width: WC.custo }]}>{R(totals.custo)}</Text>
          <Text style={{ width: WC.gap }} />
        </View>
      </View>

      {/* Agenda RH */}
      <Text style={[s.sectionTitle, { marginTop: 10 }]}>Agenda RH — Datas e Contratos</Text>
      <View style={s.table}>
        <View style={s.tableHeader}>
          <Text style={[s.tableHeaderCellLeft, { width: WH.nome }]}>Nome</Text>
          <Text style={[s.tableHeaderCell, { width: WH.contrato }]}>Contrato</Text>
          <Text style={[s.tableHeaderCell, { width: WH.admissao }]}>Admissão</Text>
          <Text style={[s.tableHeaderCell, { width: WH.ferias }]}>Vcto Férias</Text>
          <Text style={[s.tableHeaderCell, { width: WH.conceder }]}>Conceder Até</Text>
          <Text style={[s.tableHeaderCell, { width: WH.exame }]}>Exame Perió.</Text>
          <Text style={{ width: WH.gap }} />
        </View>
        {rows.map((r, i) => (
          <View key={i} style={[s.tableRow, i % 2 !== 0 ? s.tableRowAlt : {}]}>
            <Text style={[s.tableCellLeft, { width: WH.nome }]} >{r.nome}</Text>
            <Text style={[s.tableCell, { width: WH.contrato }]}>
              {r.statusContrato ? (CONTRATO_LABEL[r.statusContrato] ?? r.statusContrato) : '—'}
            </Text>
            <Text style={[s.tableCell, { width: WH.admissao }]}>{fmtDate(r.dataAdmissao)}</Text>
            <Text style={[s.tableCell, { width: WH.ferias }]}>{fmtDate(r.vctoFerias)}</Text>
            <Text style={[s.tableCell, { width: WH.conceder }]}>{fmtDate(r.concederAte)}</Text>
            <Text style={[s.tableCell, { width: WH.exame }]}>{fmtDate(r.exame)}</Text>
            <Text style={{ width: WH.gap }} />
          </View>
        ))}
      </View>

      <Footer geradoEm={geradoEm} />
    </Page>
  )
}

// ── Documento principal ───────────────────────────────────────────────────────
export function RelatorioPdf(props: Props) {
  return (
    <Document
      title={`Folha de Pagamento — ${props.mesAnoLabel}`}
      author={props.company?.razao_social ?? 'Casa Empresarial'}
      creator="Casa Empresarial"
    >
      <Page1 {...props} />
      <Page2 {...props} />
    </Document>
  )
}
