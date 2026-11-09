import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { DEFAULT_BRAND_COLOR } from '@/lib/theme'
import type { Company } from '../../../empresa/queries'

export type PayrollPdfRow = {
  nome: string
  cargo: string | null
  salario: number
  diasTrabalhados: number | null
  faltas: number
  atestados: number
  atrasos: number
  atrasoMin: number
  he50: number
  he50Min: number
  heFeriado: number
  heFeriadoMin: number
  heDomingo: number
  heDomingoMin: number
  comissao: number
  alimentacao: number
  transporte: number
  bruto: number
  inss: number
  irrf: number
  descVT: number
  descVR: number
  descOutros: number
  adiantamento: number
  liquido: number
  fgts: number
  encargos: number
  custoTotal: number
  observacao: string | null
}

interface Props {
  company: Company | null
  rows: PayrollPdfRow[]
  mesAnoLabel: string
  geradoEm: string
  fechada: boolean
}

const C = {
  dark: '#1F2937',
  text: '#1F2937',
  sub: '#4B5563',
  muted: '#9CA3AF',
  border: '#E5E7EB',
  zebra: '#F9FAFB',
  tile: '#F3F4F6',
}

const R = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const V = (n: number) => (n > 0 ? R(n) : '—')
const Q = (n: number) => (n > 0 ? String(n) : '—')
const H = (m: number) => `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`

const fmtCnpj = (cnpj: string | null | undefined) => {
  const d = (cnpj ?? '').replace(/\D/g, '')
  return d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : cnpj || '—'
}

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 8, color: C.text, paddingHorizontal: 28, paddingTop: 24, paddingBottom: 40 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 2, paddingBottom: 10, marginBottom: 14 },
  headerEmpresa: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 38, height: 38, objectFit: 'contain' },
  empresa: { fontSize: 12, fontFamily: 'Helvetica-Bold' },
  detalhe: { fontSize: 8, color: C.sub, marginTop: 2 },
  headerDireita: { alignItems: 'flex-end' },
  titulo: { fontSize: 15, fontFamily: 'Helvetica-Bold' },
  competencia: { fontSize: 9, color: C.sub, marginTop: 2 },

  tiles: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  tile: { flex: 1, backgroundColor: C.tile, borderRadius: 4, paddingVertical: 8, paddingHorizontal: 10 },
  tileRotulo: { fontSize: 7, color: C.sub },
  tileValor: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginTop: 3 },

  secao: { fontSize: 10, fontFamily: 'Helvetica-Bold', marginBottom: 6 },

  linhaTitulos: { flexDirection: 'row', backgroundColor: C.dark, paddingVertical: 6, paddingHorizontal: 4, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  th: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#FFFFFF', textAlign: 'right', paddingHorizontal: 2 },
  linha: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: C.border },
  td: { fontSize: 7.5, color: C.sub, textAlign: 'right', paddingHorizontal: 2 },
  sub: { fontSize: 6.5, color: C.muted, textAlign: 'right', marginTop: 1 },
  nome: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: C.text },
  cargo: { fontSize: 6.5, color: C.muted, marginTop: 1 },
  linhaTotal: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.tile, paddingVertical: 6, paddingHorizontal: 4, borderBottomLeftRadius: 3, borderBottomRightRadius: 3 },
  tf: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: C.text, textAlign: 'right', paddingHorizontal: 2 },

  obsTitulo: { fontSize: 10, fontFamily: 'Helvetica-Bold', marginTop: 16, marginBottom: 6 },
  obs: { flexDirection: 'row', marginBottom: 4 },
  obsNome: { width: 150, fontSize: 7.5, fontFamily: 'Helvetica-Bold' },
  obsTexto: { flex: 1, fontSize: 7.5, color: C.sub },

  rodape: { position: 'absolute', bottom: 16, left: 28, right: 28, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: C.border, paddingTop: 5 },
  rodapeTexto: { fontSize: 6.5, color: C.muted },
})

function Cabecalho({ company, mesAnoLabel, fechada, cor }: { company: Company | null; mesAnoLabel: string; fechada: boolean; cor: string }) {
  const nome = company?.nome_fantasia || company?.razao_social || 'Empresa'
  return (
    <View style={[s.header, { borderBottomColor: cor }]} fixed>
      <View style={s.headerEmpresa}>
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        {company?.logo_url ? <Image src={company.logo_url} style={s.logo} /> : null}
        <View>
          <Text style={s.empresa}>{nome}</Text>
          <Text style={s.detalhe}>CNPJ {fmtCnpj(company?.cnpj)}</Text>
        </View>
      </View>
      <View style={s.headerDireita}>
        <Text style={s.titulo}>Folha de Pagamento</Text>
        <Text style={s.competencia}>{mesAnoLabel} · {fechada ? 'Fechada' : 'Em conferência'}</Text>
      </View>
    </View>
  )
}

function Rodape({ geradoEm }: { geradoEm: string }) {
  return (
    <View style={s.rodape} fixed>
      <Text style={s.rodapeTexto}>Gerado em {geradoEm}</Text>
      <Text style={s.rodapeTexto}>Estimativa para a contabilidade · INSS e IRRF pelas tabelas de 2026 · DSR, adicional noturno, férias e 13º não incluídos</Text>
      <Text style={s.rodapeTexto} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
    </View>
  )
}

function Funcionario({ r, largura }: { r: PayrollPdfRow; largura: string }) {
  return (
    <View style={{ width: largura, paddingHorizontal: 2 }}>
      <Text style={s.nome}>{r.nome}</Text>
      {r.cargo ? <Text style={s.cargo}>{r.cargo}</Text> : null}
    </View>
  )
}

function Com_Horas({ valor, minutos, largura }: { valor: number; minutos: number; largura: string }) {
  return (
    <View style={{ width: largura }}>
      <Text style={s.td}>{V(valor)}</Text>
      {minutos > 0 ? <Text style={[s.sub, { paddingHorizontal: 2 }]}>{H(minutos)}</Text> : null}
    </View>
  )
}

const E = { nome: '19%', sal: '9%', dias: '5%', falt: '5%', atest: '5%', atr: '8%', he: '8%', com: '8%', ben: '8.5%' }
const F = { nome: '19%', val: '8.1%', forte: '9%' }

// Duas páginas com a mesma estrutura: o que aconteceu no mês e o que foi calculado
export function RelatorioPdf({ company, rows, mesAnoLabel, geradoEm, fechada }: Props) {
  const cor = company?.cor_primaria || DEFAULT_BRAND_COLOR
  const t = (f: (r: PayrollPdfRow) => number) => rows.reduce((soma, r) => soma + f(r), 0)
  const observacoes = rows.filter((r) => r.observacao)

  return (
    <Document title={`Folha de Pagamento — ${mesAnoLabel}`} author={company?.razao_social ?? 'Casa Empresarial'} creator="Casa Empresarial">
      <Page size="A4" orientation="landscape" style={s.page}>
        <Cabecalho company={company} mesAnoLabel={mesAnoLabel} fechada={fechada} cor={cor} />

        <View style={s.tiles}>
          {[
            ['Pessoas na folha', String(rows.length)],
            ['Salários brutos', R(t((r) => r.bruto))],
            ['Líquido a pagar', R(t((r) => r.liquido))],
            ['FGTS e encargos', R(t((r) => r.fgts + r.encargos))],
            ['Custo total da empresa', R(t((r) => r.custoTotal))],
          ].map(([rotulo, valor]) => (
            <View key={rotulo} style={s.tile}>
              <Text style={s.tileRotulo}>{rotulo}</Text>
              <Text style={s.tileValor}>{valor}</Text>
            </View>
          ))}
        </View>

        <Text style={s.secao}>Eventos do mês</Text>
        <View style={s.linhaTitulos} fixed>
          <Text style={[s.th, { width: E.nome, textAlign: 'left' }]}>Funcionário</Text>
          <Text style={[s.th, { width: E.sal }]}>Salário</Text>
          <Text style={[s.th, { width: E.dias }]}>Dias</Text>
          <Text style={[s.th, { width: E.falt }]}>Faltas</Text>
          <Text style={[s.th, { width: E.atest }]}>Atest.</Text>
          <Text style={[s.th, { width: E.atr }]}>Atrasos</Text>
          <Text style={[s.th, { width: E.he }]}>HE 50%</Text>
          <Text style={[s.th, { width: E.he }]}>HE feriado</Text>
          <Text style={[s.th, { width: E.he }]}>HE domingo</Text>
          <Text style={[s.th, { width: E.com }]}>Comissão</Text>
          <Text style={[s.th, { width: E.ben }]}>Alimentação</Text>
          <Text style={[s.th, { width: E.ben }]}>Transporte</Text>
        </View>
        {rows.map((r, i) => (
          <View key={i} style={[s.linha, i % 2 === 1 ? { backgroundColor: C.zebra } : {}]} wrap={false}>
            <Funcionario r={r} largura={E.nome} />
            <Text style={[s.td, { width: E.sal }]}>{R(r.salario)}</Text>
            <Text style={[s.td, { width: E.dias }]}>{r.diasTrabalhados ?? '—'}</Text>
            <Text style={[s.td, { width: E.falt }]}>{Q(r.faltas)}</Text>
            <Text style={[s.td, { width: E.atest }]}>{Q(r.atestados)}</Text>
            <Com_Horas valor={r.atrasos} minutos={r.atrasoMin} largura={E.atr} />
            <Com_Horas valor={r.he50} minutos={r.he50Min} largura={E.he} />
            <Com_Horas valor={r.heFeriado} minutos={r.heFeriadoMin} largura={E.he} />
            <Com_Horas valor={r.heDomingo} minutos={r.heDomingoMin} largura={E.he} />
            <Text style={[s.td, { width: E.com }]}>{V(r.comissao)}</Text>
            <Text style={[s.td, { width: E.ben }]}>{V(r.alimentacao)}</Text>
            <Text style={[s.td, { width: E.ben }]}>{V(r.transporte)}</Text>
          </View>
        ))}
        <View style={s.linhaTotal} wrap={false}>
          <Text style={[s.tf, { width: E.nome, textAlign: 'left' }]}>Total</Text>
          <Text style={[s.tf, { width: E.sal }]}>{R(t((r) => r.salario))}</Text>
          <Text style={[s.tf, { width: E.dias }]}>{t((r) => r.diasTrabalhados ?? 0) || '—'}</Text>
          <Text style={[s.tf, { width: E.falt }]}>{Q(t((r) => r.faltas))}</Text>
          <Text style={[s.tf, { width: E.atest }]}>{Q(t((r) => r.atestados))}</Text>
          <Text style={[s.tf, { width: E.atr }]}>{V(t((r) => r.atrasos))}</Text>
          <Text style={[s.tf, { width: E.he }]}>{V(t((r) => r.he50))}</Text>
          <Text style={[s.tf, { width: E.he }]}>{V(t((r) => r.heFeriado))}</Text>
          <Text style={[s.tf, { width: E.he }]}>{V(t((r) => r.heDomingo))}</Text>
          <Text style={[s.tf, { width: E.com }]}>{V(t((r) => r.comissao))}</Text>
          <Text style={[s.tf, { width: E.ben }]}>{V(t((r) => r.alimentacao))}</Text>
          <Text style={[s.tf, { width: E.ben }]}>{V(t((r) => r.transporte))}</Text>
        </View>

        <Rodape geradoEm={geradoEm} />
      </Page>

      <Page size="A4" orientation="landscape" style={s.page}>
        <Cabecalho company={company} mesAnoLabel={mesAnoLabel} fechada={fechada} cor={cor} />

        <Text style={s.secao}>Valores calculados</Text>
        <View style={s.linhaTitulos} fixed>
          <Text style={[s.th, { width: F.nome, textAlign: 'left' }]}>Funcionário</Text>
          {['Bruto', 'INSS', 'IRRF', 'Desc. VT', 'Desc. VR', 'Outros', 'Adiant.'].map((h) => <Text key={h} style={[s.th, { width: F.val }]}>{h}</Text>)}
          <Text style={[s.th, { width: F.forte }]}>Líquido</Text>
          <Text style={[s.th, { width: F.val }]}>FGTS</Text>
          <Text style={[s.th, { width: F.val }]}>Encargos</Text>
          <Text style={[s.th, { width: F.forte }]}>Custo total</Text>
        </View>
        {rows.map((r, i) => (
          <View key={i} style={[s.linha, i % 2 === 1 ? { backgroundColor: C.zebra } : {}]} wrap={false}>
            <Funcionario r={r} largura={F.nome} />
            {[r.bruto, r.inss, r.irrf, r.descVT, r.descVR, r.descOutros, r.adiantamento].map((v, j) => <Text key={j} style={[s.td, { width: F.val }]}>{V(v)}</Text>)}
            <Text style={[s.td, { width: F.forte, fontFamily: 'Helvetica-Bold', color: C.text }]}>{R(r.liquido)}</Text>
            <Text style={[s.td, { width: F.val }]}>{V(r.fgts)}</Text>
            <Text style={[s.td, { width: F.val }]}>{V(r.encargos)}</Text>
            <Text style={[s.td, { width: F.forte, fontFamily: 'Helvetica-Bold', color: C.text }]}>{R(r.custoTotal)}</Text>
          </View>
        ))}
        <View style={s.linhaTotal} wrap={false}>
          <Text style={[s.tf, { width: F.nome, textAlign: 'left' }]}>Total</Text>
          {[t((r) => r.bruto), t((r) => r.inss), t((r) => r.irrf), t((r) => r.descVT), t((r) => r.descVR), t((r) => r.descOutros), t((r) => r.adiantamento)].map((v, j) => <Text key={j} style={[s.tf, { width: F.val }]}>{V(v)}</Text>)}
          <Text style={[s.tf, { width: F.forte }]}>{R(t((r) => r.liquido))}</Text>
          <Text style={[s.tf, { width: F.val }]}>{V(t((r) => r.fgts))}</Text>
          <Text style={[s.tf, { width: F.val }]}>{V(t((r) => r.encargos))}</Text>
          <Text style={[s.tf, { width: F.forte }]}>{R(t((r) => r.custoTotal))}</Text>
        </View>

        {observacoes.length > 0 && (
          <View>
            <Text style={s.obsTitulo}>Observações</Text>
            {observacoes.map((r, i) => (
              <View key={i} style={s.obs} wrap={false}>
                <Text style={s.obsNome}>{r.nome}</Text>
                <Text style={s.obsTexto}>{r.observacao}</Text>
              </View>
            ))}
          </View>
        )}

        <Rodape geradoEm={geradoEm} />
      </Page>
    </Document>
  )
}
