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
const R  = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const V  = (n: number) => n > 0 ? R(n) : '—'
const VI = (n: number) => n > 0 ? String(n) : '—'

const fmtCnpj = (cnpj: string | null) => {
  if (!cnpj) return '—'
  const d = cnpj.replace(/\D/g, '')
  if (d.length !== 14) return cnpj
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

// ── Paleta ───────────────────────────────────────────────────────────────────
const C = {
  primary: '#2C3E50',
  accent:  '#C19A6B',
  green:   '#1E8449',
  red:     '#C0392B',
  blue:    '#2471A3',
  border:  '#E5E7EB',
  muted:   '#6B7280',
  text:    '#1F2937',
  textSub: '#4B5563',
  bgAlt:   '#FFFFFF',
  bgRow:   '#F9FAFB',
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 2,
    borderBottomColor: C.accent,
    paddingBottom: 8,
    marginBottom: 12,
  },
  headerLeft:   { flexDirection: 'column', gap: 2 },
  headerRight:  { alignItems: 'flex-end', gap: 2 },
  headerLogo:   { width: 36, height: 36, marginBottom: 4, borderRadius: 4 },
  companyName:  { fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.primary },
  companyDetail:{ fontSize: 7, color: C.muted },
  reportTitle:  { fontSize: 14, fontFamily: 'Helvetica-Bold', color: C.primary },
  reportSub:    { fontSize: 8, color: C.muted, marginTop: 2 },

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
  thR: { fontSize: 6, fontFamily: 'Helvetica-Bold', color: '#FFF', textAlign: 'right' },
  thL: { fontSize: 6, fontFamily: 'Helvetica-Bold', color: '#FFF', textAlign: 'left' },

  // linha principal de dados
  dataRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  // linha de observação (abaixo da linha de dados)
  obsRow: {
    paddingLeft: 10,
    paddingRight: 4,
    paddingBottom: 4,
  },
  obsText: { fontSize: 5.5, color: C.muted },

  tdR:  { fontSize: 6.5, color: C.textSub, textAlign: 'right' },
  tdL:  { fontSize: 6.5, color: C.text,    textAlign: 'left' },
  tdB:  { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: C.text, textAlign: 'left' },

  tableFooter: {
    flexDirection: 'row',
    backgroundColor: C.primary,
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  tfR: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: '#FFF', textAlign: 'right' },
  tfL: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: '#FFF', textAlign: 'left' },

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
  footerText:       { fontSize: 6,   color: C.muted },
  footerDisclaimer: { fontSize: 5.5, color: C.muted, maxWidth: 360, textAlign: 'center' },
})

// ── Rodapé de página ─────────────────────────────────────────────────────────
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
  const nome  = company?.nome_fantasia ?? company?.razao_social ?? 'Empresa'
  const cnpj  = fmtCnpj(company?.cnpj ?? null)
  const local = [company?.cidade, company?.uf].filter(Boolean).join(' / ')
  return (
    <View style={s.header} fixed>
      <View style={s.headerLeft}>
        {company?.logo_url && <Image src={company.logo_url} style={s.headerLogo} />}
        <Text style={s.companyName}>{nome}</Text>
        <Text style={s.companyDetail}>CNPJ: {cnpj}</Text>
        {local ? <Text style={s.companyDetail}>{local}</Text> : null}
        {company?.telefone ? <Text style={s.companyDetail}>{company.telefone}</Text> : null}
        {company?.email    ? <Text style={s.companyDetail}>{company.email}</Text>    : null}
      </View>
      <View style={s.headerRight}>
        <Text style={s.reportTitle}>Folha de Pagamento</Text>
        <Text style={s.reportSub}>{mesAnoLabel}</Text>
        <Text style={[s.companyDetail, { marginTop: 4 }]}>Gerado em {geradoEm}</Text>
      </View>
    </View>
  )
}

// ── Documento ────────────────────────────────────────────────────────────────
export function RelatorioPdf({ company, rows, mesAnoLabel, geradoEm }: Props) {
  // col widths — somam 100%
  const W = {
    nome:      '19%',
    bruto:     '9%',
    alim:      '8%',
    transp:    '8%',
    faltas:    '5%',
    atestados: '6%',
    he50:      '7%',
    heFer:     '8%',
    heDom:     '8%',
    comissao:  '8%',
    descVT:    '7%',
    descVR:    '7%',
  }

  const tot = rows.reduce(
    (t, r) => ({
      bruto:    t.bruto    + r.bruto,
      alim:     t.alim     + r.custoVA,
      transp:   t.transp   + r.custoVT,
      he50:     t.he50     + r.he50,
      heFer:    t.heFer    + r.heFeriado,
      heDom:    t.heDom    + r.heDomingo,
      comissao: t.comissao + r.comissao,
      descVT:   t.descVT   + r.descVT,
      descVR:   t.descVR   + r.descVR,
    }),
    { bruto: 0, alim: 0, transp: 0, he50: 0, heFer: 0, heDom: 0, comissao: 0, descVT: 0, descVR: 0 }
  )

  return (
    <Document
      title={`Folha de Pagamento — ${mesAnoLabel}`}
      author={company?.razao_social ?? 'Casa Empresarial'}
      creator="Casa Empresarial"
    >
      <Page size="A4" orientation="landscape" style={s.page}>
        <Header company={company} mesAnoLabel={mesAnoLabel} geradoEm={geradoEm} />

        <Text style={s.sectionTitle}>Folha de Pagamento — {mesAnoLabel}</Text>
        <View style={s.table}>
          {/* Cabeçalho */}
          <View style={s.tableHeader}>
            <Text style={[s.thL, { width: W.nome }]}>Nome</Text>
            <Text style={[s.thR, { width: W.bruto }]}>Sal. Bruto</Text>
            <Text style={[s.thR, { width: W.alim }]}>Alimentação</Text>
            <Text style={[s.thR, { width: W.transp }]}>Transporte</Text>
            <Text style={[s.thR, { width: W.faltas }]}>Faltas</Text>
            <Text style={[s.thR, { width: W.atestados }]}>Atest.</Text>
            <Text style={[s.thR, { width: W.he50 }]}>HE 50%</Text>
            <Text style={[s.thR, { width: W.heFer }]}>HE Feriado</Text>
            <Text style={[s.thR, { width: W.heDom }]}>HE Domingo</Text>
            <Text style={[s.thR, { width: W.comissao }]}>Comissão</Text>
            <Text style={[s.thR, { width: W.descVT }]}>Desc.VT</Text>
            <Text style={[s.thR, { width: W.descVR }]}>Desc.VR</Text>
          </View>

          {/* Linhas de dados */}
          {rows.map((r, i) => {
            const bg = i % 2 !== 0 ? C.bgRow : C.bgAlt
            return (
              <View key={i} style={{ backgroundColor: bg }}>
                {/* Linha principal */}
                <View style={s.dataRow}>
                  <Text style={[s.tdB, { width: W.nome }]}>{r.nome}</Text>
                  <Text style={[s.tdR, { width: W.bruto }]}>{R(r.bruto)}</Text>
                  <Text style={[s.tdR, { width: W.alim,   color: r.custoVA   > 0 ? C.textSub : C.muted }]}>{V(r.custoVA)}</Text>
                  <Text style={[s.tdR, { width: W.transp, color: r.custoVT   > 0 ? C.textSub : C.muted }]}>{V(r.custoVT)}</Text>
                  <Text style={[s.tdR, { width: W.faltas,    color: r.faltas    > 0 ? C.red   : C.muted }]}>{VI(r.faltas)}</Text>
                  <Text style={[s.tdR, { width: W.atestados, color: r.atestados > 0 ? C.blue  : C.muted }]}>{VI(r.atestados)}</Text>
                  <Text style={[s.tdR, { width: W.he50,    color: r.he50      > 0 ? C.green : C.muted }]}>{V(r.he50)}</Text>
                  <Text style={[s.tdR, { width: W.heFer,   color: r.heFeriado > 0 ? C.green : C.muted }]}>{V(r.heFeriado)}</Text>
                  <Text style={[s.tdR, { width: W.heDom,   color: r.heDomingo > 0 ? C.green : C.muted }]}>{V(r.heDomingo)}</Text>
                  <Text style={[s.tdR, { width: W.comissao,color: r.comissao  > 0 ? C.textSub : C.muted }]}>{V(r.comissao)}</Text>
                  <Text style={[s.tdR, { width: W.descVT,  color: r.descVT    > 0 ? C.red   : C.muted }]}>{V(r.descVT)}</Text>
                  <Text style={[s.tdR, { width: W.descVR,  color: r.descVR    > 0 ? C.red   : C.muted }]}>{V(r.descVR)}</Text>
                </View>
                {/* Linha de observação (apenas se existir) */}
                {r.observacao ? (
                  <View style={s.obsRow}>
                    <Text style={s.obsText}>Obs: {r.observacao}</Text>
                  </View>
                ) : null}
              </View>
            )
          })}

          {/* Rodapé com totais */}
          <View style={s.tableFooter}>
            <Text style={[s.tfL, { width: W.nome }]}>TOTAL — {rows.length} func.</Text>
            <Text style={[s.tfR, { width: W.bruto }]}>{R(tot.bruto)}</Text>
            <Text style={[s.tfR, { width: W.alim }]}>{V(tot.alim)}</Text>
            <Text style={[s.tfR, { width: W.transp }]}>{V(tot.transp)}</Text>
            <Text style={{ width: W.faltas }} />
            <Text style={{ width: W.atestados }} />
            <Text style={[s.tfR, { width: W.he50 }]}>{V(tot.he50)}</Text>
            <Text style={[s.tfR, { width: W.heFer }]}>{V(tot.heFer)}</Text>
            <Text style={[s.tfR, { width: W.heDom }]}>{V(tot.heDom)}</Text>
            <Text style={[s.tfR, { width: W.comissao }]}>{V(tot.comissao)}</Text>
            <Text style={[s.tfR, { width: W.descVT }]}>{V(tot.descVT)}</Text>
            <Text style={[s.tfR, { width: W.descVR }]}>{V(tot.descVR)}</Text>
          </View>
        </View>

        <Footer geradoEm={geradoEm} />
      </Page>
    </Document>
  )
}
