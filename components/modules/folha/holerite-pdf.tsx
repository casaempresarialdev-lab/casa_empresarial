import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { Company } from '@/app/(app)/empresa/queries'
import { fmtDataBr } from '@/lib/folha/config'
import type { DocumentoHolerite } from '@/lib/folha/holerite'
import { DEFAULT_BRAND_COLOR } from '@/lib/theme'

export type DadosHolerite = {
  company: Company | null
  employee: { nome: string; cpf: string | null; cargo: string | null }
  competencia: string
  /** Holerite mensal (montarHolerite), recibo de férias ou parcela do 13º */
  documento: DocumentoHolerite
  responsavel: 'sistema' | 'contabilidade'
  pagamentoEm?: string | null
}

const C = { dark: '#1F2937', sub: '#4B5563', muted: '#9CA3AF', border: '#E5E7EB', tile: '#F3F4F6' }
const R = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtCnpj = (v: string | null | undefined) => {
  const d = (v ?? '').replace(/\D/g, '')
  return d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : v || '—'
}
const fmtCpf = (v: string | null | undefined) => {
  const d = (v ?? '').replace(/\D/g, '')
  return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : v || '—'
}

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 9, color: C.dark, paddingHorizontal: 36, paddingTop: 32, paddingBottom: 48 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 2, paddingBottom: 10, marginBottom: 14 },
  esquerda: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 38, height: 38, objectFit: 'contain' },
  empresa: { fontSize: 12, fontFamily: 'Helvetica-Bold' },
  detalhe: { fontSize: 8, color: C.sub, marginTop: 2 },
  direita: { alignItems: 'flex-end' },
  titulo: { fontSize: 14, fontFamily: 'Helvetica-Bold' },
  competencia: { fontSize: 9, color: C.sub, marginTop: 2 },
  pessoa: { flexDirection: 'row', backgroundColor: C.tile, borderRadius: 4, paddingVertical: 8, paddingHorizontal: 10, marginBottom: 14, gap: 16 },
  rotulo: { fontSize: 7, color: C.sub },
  valor: { fontSize: 9, fontFamily: 'Helvetica-Bold', marginTop: 2 },
  titulos: { flexDirection: 'row', backgroundColor: C.dark, paddingVertical: 6, paddingHorizontal: 6, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  th: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#FFFFFF' },
  linha: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: C.border },
  td: { fontSize: 8.5, color: C.sub },
  total: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 6, backgroundColor: C.tile },
  tf: { fontSize: 8.5, fontFamily: 'Helvetica-Bold' },
  liquido: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 4, paddingVertical: 10, paddingHorizontal: 12, marginTop: 10 },
  liquidoTexto: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#FFFFFF' },
  liquidoValor: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#FFFFFF' },
  bases: { flexDirection: 'row', gap: 8, marginTop: 10 },
  base: { flex: 1, backgroundColor: C.tile, borderRadius: 4, paddingVertical: 6, paddingHorizontal: 8 },
  obs: { fontSize: 7.5, color: C.sub, marginTop: 10, lineHeight: 1.4 },
  rodape: { position: 'absolute', bottom: 20, left: 36, right: 36, borderTopWidth: 0.5, borderTopColor: C.border, paddingTop: 5 },
  rodapeTexto: { fontSize: 7, color: C.muted, textAlign: 'center' },
})

const W = { desc: '46%', ref: '14%', val: '20%' }

export function HoleritePdf({ d }: { d: DadosHolerite }) {
  const h = d.documento
  const cor = d.company?.cor_primaria || DEFAULT_BRAND_COLOR
  const nomeEmpresa = d.company?.nome_fantasia || d.company?.razao_social || 'Empresa'
  const direita = { textAlign: 'right' as const }

  return (
    <Document title={`${h.titulo} — ${d.competencia}`} author={d.company?.razao_social ?? 'Casa Empresarial'} creator="Casa Empresarial">
      <Page size="A4" style={s.page}>
        <View style={[s.header, { borderBottomColor: cor }]}>
          <View style={s.esquerda}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            {d.company?.logo_url ? <Image src={d.company.logo_url} style={s.logo} /> : null}
            <View>
              <Text style={s.empresa}>{nomeEmpresa}</Text>
              <Text style={s.detalhe}>CNPJ {fmtCnpj(d.company?.cnpj)}</Text>
            </View>
          </View>
          <View style={s.direita}>
            <Text style={s.titulo}>{h.titulo}</Text>
            <Text style={s.competencia}>{d.competencia}</Text>
          </View>
        </View>

        <View style={s.pessoa}>
          <View style={{ flex: 2 }}><Text style={s.rotulo}>Colaborador</Text><Text style={s.valor}>{d.employee.nome}</Text></View>
          <View style={{ flex: 1 }}><Text style={s.rotulo}>CPF</Text><Text style={s.valor}>{fmtCpf(d.employee.cpf)}</Text></View>
          <View style={{ flex: 1.5 }}><Text style={s.rotulo}>Cargo</Text><Text style={s.valor}>{d.employee.cargo ?? '—'}</Text></View>
          {d.pagamentoEm ? <View style={{ flex: 1 }}><Text style={s.rotulo}>Pagamento</Text><Text style={s.valor}>{fmtDataBr(d.pagamentoEm)}</Text></View> : null}
        </View>

        <View style={s.titulos}>
          <Text style={[s.th, { width: W.desc }]}>Descrição</Text>
          <Text style={[s.th, { width: W.ref, ...direita }]}>Referência</Text>
          <Text style={[s.th, { width: W.val, ...direita }]}>Proventos</Text>
          <Text style={[s.th, { width: W.val, ...direita }]}>Descontos</Text>
        </View>
        {h.linhas.map((l) => (
          <View key={l.descricao + l.referencia} style={s.linha} wrap={false}>
            <Text style={[s.td, { width: W.desc }]}>{l.descricao}</Text>
            <Text style={[s.td, { width: W.ref, ...direita }]}>{l.referencia}</Text>
            <Text style={[s.td, { width: W.val, ...direita }]}>{l.provento > 0 ? R(l.provento) : ''}</Text>
            <Text style={[s.td, { width: W.val, ...direita }]}>{l.desconto > 0 ? R(l.desconto) : ''}</Text>
          </View>
        ))}
        <View style={s.total} wrap={false}>
          <Text style={[s.tf, { width: W.desc }]}>Totais</Text>
          <Text style={[s.tf, { width: W.ref }]}> </Text>
          <Text style={[s.tf, { width: W.val, ...direita }]}>{R(h.totalProventos)}</Text>
          <Text style={[s.tf, { width: W.val, ...direita }]}>{R(h.totalDescontos)}</Text>
        </View>

        <View style={[s.liquido, { backgroundColor: cor }]} wrap={false}>
          <Text style={s.liquidoTexto}>Líquido a receber</Text>
          <Text style={s.liquidoValor}>R$ {R(h.liquido)}</Text>
        </View>

        <View style={s.bases} wrap={false}>
          {h.bases.map((b) => (
            <View key={b.rotulo} style={s.base}>
              <Text style={s.rotulo}>{b.rotulo}</Text>
              <Text style={s.valor}>R$ {R(b.valor)}</Text>
            </View>
          ))}
        </View>

        {h.observacoes.map((o) => <Text key={o} style={s.obs}>{o}</Text>)}

        <View style={s.rodape} fixed>
          <Text style={s.rodapeTexto}>
            {d.responsavel === 'contabilidade' ? 'Demonstrativo gerado pelo sistema. Os valores oficiais são os conferidos pela contabilidade.' : 'Demonstrativo de pagamento gerado pelo sistema.'}
          </Text>
        </View>
      </Page>
    </Document>
  )
}
