import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'

// Dados da tela Minha Empresa (valores atuais do formulário)
export type EmpresaPdfData = {
  razao_social: string
  cnpj: string
  nome_fantasia: string
  telefone: string
  email: string
  cep: string
  uf: string
  cidade: string
  logradouro: string
  numero: string
  bairro: string
  complemento: string
  regime_tributario: string
  inscricao_municipal: string
  ie_situacao: string
  inscricao_estadual: string
}

interface Props {
  data: EmpresaPdfData
  logoUrl: string | null
  /** Cor principal da identidade visual (hex) */
  accent: string
  geradoEm: string
}

const C = {
  primary: '#2C3E50',
  border:  '#E5E7EB',
  muted:   '#6B7280',
  text:    '#1F2937',
  bgRow:   '#F9FAFB',
}

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: C.text,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 36,
    paddingTop: 32,
    paddingBottom: 48,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 2,
    paddingBottom: 10,
    marginBottom: 18,
  },
  headerLeft:    { flexDirection: 'column', gap: 2, maxWidth: '65%' },
  headerRight:   { alignItems: 'flex-end', gap: 2 },
  headerLogo:    { maxWidth: 120, maxHeight: 40, marginBottom: 6, objectFit: 'contain' },
  companyName:   { fontSize: 12, fontFamily: 'Helvetica-Bold', color: C.primary },
  companyDetail: { fontSize: 8, color: C.muted },
  reportTitle:   { fontSize: 14, fontFamily: 'Helvetica-Bold' },
  section:       { marginBottom: 16 },
  sectionTitle:  { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#FFFFFF', paddingVertical: 5, paddingHorizontal: 8, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  grid:          { flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, borderTopWidth: 0, borderColor: C.border },
  field:         { paddingVertical: 6, paddingHorizontal: 8, borderBottomWidth: 1, borderColor: C.border },
  label:         { fontSize: 7, color: C.muted, marginBottom: 2, textTransform: 'uppercase' },
  value:         { fontSize: 9.5, color: C.text },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 36,
    right: 36,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: C.muted,
  },
})

const REGIME: Record<string, string> = {
  mei: 'MEI',
  simples_nacional: 'Simples Nacional',
  lucro_presumido: 'Lucro Presumido',
  lucro_real: 'Lucro Real',
}

const IE_SITUACAO: Record<string, string> = {
  isento: 'Isento',
  nao_contribuinte: 'Não contribuinte do ICMS',
  contribuinte: 'Contribuinte do ICMS',
}

type Field = { label: string; value: string; full?: boolean }

function Section({ title, fields, accent }: { title: string; fields: Field[]; accent: string }) {
  return (
    <View style={s.section} wrap={false}>
      <Text style={[s.sectionTitle, { backgroundColor: accent }]}>{title}</Text>
      <View style={s.grid}>
        {fields.map((f, i) => (
          <View key={f.label} style={[s.field, { width: f.full ? '100%' : '50%', backgroundColor: i % 2 ? '#FFFFFF' : C.bgRow }]}>
            <Text style={s.label}>{f.label}</Text>
            <Text style={s.value}>{f.value.trim() || '—'}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

export function EmpresaPdf({ data, logoUrl, accent, geradoEm }: Props) {
  return (
    <Document title={`Dados da empresa - ${data.razao_social}`}>
      <Page size="A4" style={s.page}>
        <View style={[s.header, { borderBottomColor: accent }]} fixed>
          <View style={s.headerLeft}>
            {logoUrl && <Image src={logoUrl} style={s.headerLogo} />}
            <Text style={s.companyName}>{data.razao_social || '—'}</Text>
            <Text style={s.companyDetail}>CNPJ: {data.cnpj || '—'}</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={[s.reportTitle, { color: accent }]}>Dados da Empresa</Text>
            <Text style={s.companyDetail}>Gerado em {geradoEm}</Text>
          </View>
        </View>

        <Section accent={accent} title="Dados da empresa" fields={[
          { label: 'Razão Social', value: data.razao_social, full: true },
          { label: 'CNPJ', value: data.cnpj },
          { label: 'Nome Fantasia', value: data.nome_fantasia },
          { label: 'Telefone', value: data.telefone },
          { label: 'E-mail da empresa', value: data.email },
        ]} />

        <Section accent={accent} title="Endereço" fields={[
          { label: 'CEP', value: data.cep },
          { label: 'UF', value: data.uf },
          { label: 'Cidade', value: data.cidade },
          { label: 'Bairro', value: data.bairro },
          { label: 'Logradouro', value: data.logradouro },
          { label: 'Número', value: data.numero },
          { label: 'Complemento', value: data.complemento, full: true },
        ]} />

        <Section accent={accent} title="Dados fiscais" fields={[
          { label: 'Regime Tributário', value: REGIME[data.regime_tributario] ?? '' },
          { label: 'IM — Inscrição Municipal', value: data.inscricao_municipal },
          { label: 'IE — Situação', value: IE_SITUACAO[data.ie_situacao] ?? '' },
          { label: 'IE — Número', value: data.inscricao_estadual },
        ]} />

        <View style={s.footer} fixed>
          <Text>{data.razao_social}</Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
