import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from '@react-pdf/renderer'
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
  observacao: string | null
  // campos variáveis mensais
  faltas: number
  atestados: number
  he50: number
  heFeriado: number
  heDomingo: number
  comissao: number
  descVT: number
  descVR: number
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

const V  = (n: number) => n > 0 ? R(n) : '—'
const VI = (n: number) => n > 0 ? String(n) : '—'

const fmtDate = (iso: string | null) => {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const fmtCnpj = (cnpj: string | null) => {
  if (!cnpj) return '—'
  const d = cnpj.replace(/\D/g, '')
  if (d.length !== 14) return cnpj
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
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
    fontSize: 7,
    color: C.text,
    backgroundColor: C.bgAlt,
    paddingHorizontal: 20,
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
    fontSize: 6,
    fontFamily: 'Helvetica-Bold',
    color: '#FFFFFF',
    textAlign: 'right',
  },
  tableHeaderCellLeft: {
    fontSize: 6,
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
    fontSize: 6.5,
    color: C.textSub,
    textAlign: 'right',
  },
  tableCellLeft: {
    fontSize: 6.5,
    color: C.text,
    textAlign: 'left',
  },
  tableCellBold: {
    fontSize: 6.5,
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
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: '#FFFFFF',
    textAlign: 'right',
  },
  tableFooterCellLeft: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    color: '#FFFFFF',
    textAlign: 'left',
  },

  // Rodapé de página
  footer: {
    position: 'absolute',
    bottom: 14,
    left: 20,
    right: 20,
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

// ── Página 1: Tabela principal (espelho da tela) ─────────────────────────────
function Page1({ company, rows, mesAnoLabel, geradoEm }: Props) {
  const W = {
    nome:      '15%',
    bruto:     '8%',
    alim:      '7%',
    transp:    '7%',
    faltas:    '5%',
    atestados: '5%',
    he50:      '7%',
    heFer:     '8%',
    heDom:     '8%',
    comissao:  '7%',
    descVT:    '6%',
    descVR:    '6%',
    obs:       '11%',
  }

  const tot = rows.reduce(
    (t, r) => ({
      bruto:     t.bruto     + r.bruto,
      alim:      t.alim      + r.custoVA,
      transp:    t.transp    + r.custoVT,
      he50:      t.he50      + r.he50,
      heFer:     t.heFer     + r.heFeriado,
      heDom:     t.heDom     + r.heDomingo,
      comissao:  t.comissao  + r.comissao,
      descVT:    t.descVT    + r.descVT,
      descVR:    t.descVR    + r.descVR,
    }),
    { bruto: 0, alim: 0, transp: 0, he50: 0, heFer: 0, heDom: 0, comissao: 0, descVT: 0, descVR: 0 }
  )

  return (
    <Page size="A4" orientation="landscape" style={s.page}>
      <Header company={company} mesAnoLabel={mesAnoLabel} geradoEm={geradoEm} />

      <Text style={s.sectionTitle}>Folha de Pagamento — {mesAnoLabel}</Text>
      <View style={s.table}>
        <View style={s.tableHeader}>
          <Text style={[s.tableHeaderCellLeft, { width: W.nome }]}>Nome</Text>
          <Text style={[s.tableHeaderCell, { width: W.bruto }]}>Sal. Bruto</Text>
          <Text style={[s.tableHeaderCell, { width: W.alim }]}>Alimentação</Text>
          <Text style={[s.tableHeaderCell, { width: W.transp }]}>Transporte</Text>
          <Text style={[s.tableHeaderCell, { width: W.faltas }]}>Faltas</Text>
          <Text style={[s.tableHeaderCell, { width: W.atestados }]}>Atest.</Text>
          <Text style={[s.tableHeaderCell, { width: W.he50 }]}>HE 50%</Text>
          <Text style={[s.tableHeaderCell, { width: W.heFer }]}>HE Feriado</Text>
          <Text style={[s.tableHeaderCell, { width: W.heDom }]}>HE Domingo</Text>
          <Text style={[s.tableHeaderCell, { width: W.comissao }]}>Comissão</Text>
          <Text style={[s.tableHeaderCell, { width: W.descVT }]}>Desc.VT</Text>
          <Text style={[s.tableHeaderCell, { width: W.descVR }]}>Desc.VR</Text>
          <Text style={[s.tableHeaderCellLeft, { width: W.obs }]}>Observação</Text>
        </View>

        {rows.map((r, i) => (
          <View key={i} style={[s.tableRow, i % 2 !== 0 ? s.tableRowAlt : {}]}>
            <Text style={[s.tableCellBold, { width: W.nome }]}>{r.nome}</Text>
            <Text style={[s.tableCell, { width: W.bruto }]}>{R(r.bruto)}</Text>
            <Text style={[s.tableCell, { width: W.alim, color: r.custoVA > 0 ? C.textSub : C.muted }]}>{V(r.custoVA)}</Text>
            <Text style={[s.tableCell, { width: W.transp, color: r.custoVT > 0 ? C.textSub : C.muted }]}>{V(r.custoVT)}</Text>
            <Text style={[s.tableCell, { width: W.faltas, color: r.faltas > 0 ? C.red : C.muted }]}>{VI(r.faltas)}</Text>
            <Text style={[s.tableCell, { width: W.atestados, color: r.atestados > 0 ? C.blue : C.muted }]}>{VI(r.atestados)}</Text>
            <Text style={[s.tableCell, { width: W.he50, color: r.he50 > 0 ? C.green : C.muted }]}>{V(r.he50)}</Text>
            <Text style={[s.tableCell, { width: W.heFer, color: r.heFeriado > 0 ? C.green : C.muted }]}>{V(r.heFeriado)}</Text>
            <Text style={[s.tableCell, { width: W.heDom, color: r.heDomingo > 0 ? C.green : C.muted }]}>{V(r.heDomingo)}</Text>
            <Text style={[s.tableCell, { width: W.comissao, color: r.comissao > 0 ? C.textSub : C.muted }]}>{V(r.comissao)}</Text>
            <Text style={[s.tableCell, { width: W.descVT, color: r.descVT > 0 ? C.red : C.muted }]}>{V(r.descVT)}</Text>
            <Text style={[s.tableCell, { width: W.descVR, color: r.descVR > 0 ? C.red : C.muted }]}>{V(r.descVR)}</Text>
            <Text style={[s.tableCellLeft, { width: W.obs, color: r.observacao ? C.textSub : C.muted }]}>{r.observacao ?? '—'}</Text>
          </View>
        ))}

        <View style={s.tableFooter}>
          <Text style={[s.tableFooterCellLeft, { width: W.nome }]}>TOTAL — {rows.length} func.</Text>
          <Text style={[s.tableFooterCell, { width: W.bruto }]}>{R(tot.bruto)}</Text>
          <Text style={[s.tableFooterCell, { width: W.alim }]}>{V(tot.alim)}</Text>
          <Text style={[s.tableFooterCell, { width: W.transp }]}>{V(tot.transp)}</Text>
          <Text style={{ width: W.faltas }} />
          <Text style={{ width: W.atestados }} />
          <Text style={[s.tableFooterCell, { width: W.he50 }]}>{V(tot.he50)}</Text>
          <Text style={[s.tableFooterCell, { width: W.heFer }]}>{V(tot.heFer)}</Text>
          <Text style={[s.tableFooterCell, { width: W.heDom }]}>{V(tot.heDom)}</Text>
          <Text style={[s.tableFooterCell, { width: W.comissao }]}>{V(tot.comissao)}</Text>
          <Text style={[s.tableFooterCell, { width: W.descVT }]}>{V(tot.descVT)}</Text>
          <Text style={[s.tableFooterCell, { width: W.descVR }]}>{V(tot.descVR)}</Text>
          <Text style={{ width: W.obs }} />
        </View>
      </View>

      <Footer geradoEm={geradoEm} />
    </Page>
  )
}

// ── Página 2: Agenda RH ──────────────────────────────────────────────────────
function Page2({ company, rows, mesAnoLabel, geradoEm }: Props) {
  const WH = { nome: '22%', contrato: '14%', admissao: '12%', ferias: '12%', conceder: '12%', exame: '12%', obs: '16%' }

  return (
    <Page size="A4" orientation="landscape" style={s.page}>
      <Header company={company} mesAnoLabel={mesAnoLabel} geradoEm={geradoEm} />

      <Text style={s.sectionTitle}>Agenda RH — Datas e Contratos</Text>
      <View style={s.table}>
        <View style={s.tableHeader}>
          <Text style={[s.tableHeaderCellLeft, { width: WH.nome }]}>Nome</Text>
          <Text style={[s.tableHeaderCell, { width: WH.contrato }]}>Contrato</Text>
          <Text style={[s.tableHeaderCell, { width: WH.admissao }]}>Admissão</Text>
          <Text style={[s.tableHeaderCell, { width: WH.ferias }]}>Vcto Férias</Text>
          <Text style={[s.tableHeaderCell, { width: WH.conceder }]}>Conceder Até</Text>
          <Text style={[s.tableHeaderCell, { width: WH.exame }]}>Exame Perió.</Text>
          <Text style={[s.tableHeaderCellLeft, { width: WH.obs }]}>Observação</Text>
        </View>
        {rows.map((r, i) => (
          <View key={i} style={[s.tableRow, i % 2 !== 0 ? s.tableRowAlt : {}]}>
            <Text style={[s.tableCellLeft, { width: WH.nome }]}>{r.nome}</Text>
            <Text style={[s.tableCell, { width: WH.contrato }]}>
              {r.statusContrato ? (CONTRATO_LABEL[r.statusContrato] ?? r.statusContrato) : '—'}
            </Text>
            <Text style={[s.tableCell, { width: WH.admissao }]}>{fmtDate(r.dataAdmissao)}</Text>
            <Text style={[s.tableCell, { width: WH.ferias }]}>{fmtDate(r.vctoFerias)}</Text>
            <Text style={[s.tableCell, { width: WH.conceder }]}>{fmtDate(r.concederAte)}</Text>
            <Text style={[s.tableCell, { width: WH.exame }]}>{fmtDate(r.exame)}</Text>
            <Text style={[s.tableCellLeft, { width: WH.obs, color: r.observacao ? C.textSub : C.muted }]}>{r.observacao ?? '—'}</Text>
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
