import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { CORES_ESCALA, SEMANA_CURTA, diaDaSemana, feriadosDoPeriodo, fmtDia, rotuloGrupo, textoCelula, type CelulaExport, type QuadroExport } from '@/lib/export/escala-export'
import type { Company } from '../../../empresa/queries'

const C = {
  dark: '#1F2937',
  text: '#1F2937',
  sub: '#4B5563',
  muted: '#9CA3AF',
  border: '#E5E7EB',
  tile: '#F3F4F6',
}

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
  periodo: { fontSize: 9, color: C.sub, marginTop: 2 },

  tiles: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  tile: { flex: 1, backgroundColor: C.tile, borderRadius: 4, paddingVertical: 8, paddingHorizontal: 10 },
  tileRotulo: { fontSize: 7, color: C.sub },
  tileValor: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginTop: 3 },

  linhaTitulos: { flexDirection: 'row', alignItems: 'stretch', backgroundColor: C.dark, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  thTexto: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#FFFFFF', textAlign: 'center' },
  thSub: { fontSize: 6, color: '#D1D5DB', textAlign: 'center', marginBottom: 1 },
  thDia: { flex: 1, paddingVertical: 4, justifyContent: 'center' },

  grupo: { backgroundColor: C.tile, paddingVertical: 4, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: C.border },
  grupoTexto: { fontSize: 7.5, fontFamily: 'Helvetica-Bold' },
  linha: { flexDirection: 'row', alignItems: 'stretch', borderBottomWidth: 0.5, borderBottomColor: C.border },
  pessoa: { justifyContent: 'center', paddingVertical: 3, paddingHorizontal: 6 },
  nome: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: C.text },
  escala: { fontSize: 6.5, color: C.muted, marginTop: 1 },
  dia: { flex: 1, padding: 1, justifyContent: 'center' },
  marca: { borderRadius: 2, alignItems: 'center', justifyContent: 'center' },
  marcaTexto: { fontSize: 7, textAlign: 'center' },
  folgas: { justifyContent: 'center' },
  folgasTexto: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', textAlign: 'center' },

  linhaTotal: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.tile, paddingVertical: 5, borderBottomLeftRadius: 3, borderBottomRightRadius: 3 },
  totalRotulo: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', paddingHorizontal: 6 },
  totalDia: { flex: 1, fontSize: 7, fontFamily: 'Helvetica-Bold', textAlign: 'center' },

  vazio: { paddingVertical: 24, textAlign: 'center', color: C.muted, fontSize: 9 },

  legenda: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 },
  legendaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendaMarca: { width: 11, height: 11, borderRadius: 2, alignItems: 'center', justifyContent: 'center' },
  legendaLetra: { fontSize: 6.5, fontFamily: 'Helvetica-Bold' },
  legendaTexto: { fontSize: 7, color: C.sub },

  feriadosTitulo: { fontSize: 8, fontFamily: 'Helvetica-Bold', marginTop: 10, marginBottom: 3 },
  feriados: { fontSize: 7.5, color: C.sub, lineHeight: 1.4 },

  rodape: { position: 'absolute', bottom: 16, left: 28, right: 28, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: C.border, paddingTop: 5 },
  rodapeTexto: { fontSize: 6.5, color: C.muted },
})

function Marca({ c, cor }: { c: CelulaExport; cor: string }) {
  const estilo = c.foraDaEscala
    ? { backgroundColor: CORES_ESCALA.foraFundo, borderWidth: 0.75, borderColor: CORES_ESCALA.foraTexto }
    : c.tipo === 'folga' ? { backgroundColor: cor } : {}
  const corTexto = c.foraDaEscala ? CORES_ESCALA.foraTexto : c.tipo === 'folga' ? '#FFFFFF' : C.sub
  const forte = c.foraDaEscala || c.tipo === 'folga'
  return (
    <View style={[s.marca, estilo, { height: 15 }]}>
      <Text style={[s.marcaTexto, { color: corTexto, fontFamily: forte ? 'Helvetica-Bold' : 'Helvetica' }]}>{textoCelula(c)}</Text>
    </View>
  )
}

// Quadro de folgas no padrão dos relatórios: cabeçalho da empresa, indicadores, grade e rodapé com as páginas
export function QuadroEscalaPdf({ company, q }: { company: Company | null; q: QuadroExport }) {
  const nomeEmpresa = company?.nome_fantasia || company?.razao_social || 'Empresa'
  const cor = q.corMarca
  const larguraPessoa = 130
  const larguraFolgas = 34
  const fundoDia = (i: number) => {
    const d = q.colunas[i]
    return d.feriado ? { backgroundColor: CORES_ESCALA.feriado } : d.domingo ? { backgroundColor: CORES_ESCALA.domingo } : {}
  }
  const feriados = feriadosDoPeriodo(q.colunas)
  const totalFolgas = q.linhas.reduce((t, l) => t + l.folgas, 0)
  const foraDaEscala = q.linhas.reduce((t, l) => t + l.celulas.filter((c) => c.foraDaEscala).length, 0)

  const legenda: [string, { backgroundColor: string; borderWidth?: number; borderColor?: string }, string, string][] = [
    ['F', { backgroundColor: cor }, '#FFFFFF', 'Folga'],
    ['F', { backgroundColor: CORES_ESCALA.foraFundo, borderWidth: 0.75, borderColor: CORES_ESCALA.foraTexto }, CORES_ESCALA.foraTexto, 'Folga fora da escala'],
    ['T', { backgroundColor: CORES_ESCALA.foraFundo, borderWidth: 0.75, borderColor: CORES_ESCALA.foraTexto }, CORES_ESCALA.foraTexto, 'Trabalho fora da escala'],
    ['', { backgroundColor: CORES_ESCALA.feriado, borderWidth: 0.5, borderColor: C.border }, C.text, 'Feriado'],
    ['', { backgroundColor: CORES_ESCALA.domingo, borderWidth: 0.5, borderColor: C.border }, C.text, 'Domingo'],
  ]

  return (
    <Document title={`Escala de Trabalho — ${q.rotulo}`} author={company?.razao_social ?? 'Casa Empresarial'} creator="Casa Empresarial">
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={[s.header, { borderBottomColor: cor }]} fixed>
          <View style={s.headerEmpresa}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            {company?.logo_url ? <Image src={company.logo_url} style={s.logo} /> : null}
            <View>
              <Text style={s.empresa}>{nomeEmpresa}</Text>
              <Text style={s.detalhe}>CNPJ {fmtCnpj(company?.cnpj)}</Text>
            </View>
          </View>
          <View style={s.headerDireita}>
            <Text style={s.titulo}>Escala de Trabalho</Text>
            <Text style={s.periodo}>{q.rotulo}</Text>
          </View>
        </View>

        <View style={s.tiles}>
          {[
            ['Pessoas no quadro', String(q.linhas.length)],
            ['Folgas no período', String(totalFolgas)],
            ['Dias fora da escala', String(foraDaEscala)],
            ['Feriados no período', String(feriados.length)],
          ].map(([rotulo, valor]) => (
            <View key={rotulo} style={s.tile}>
              <Text style={s.tileRotulo}>{rotulo}</Text>
              <Text style={s.tileValor}>{valor}</Text>
            </View>
          ))}
        </View>

        <View style={s.linhaTitulos} fixed>
          <View style={[s.pessoa, { width: larguraPessoa }]}><Text style={[s.thTexto, { textAlign: 'left' }]}>Pessoa</Text></View>
          {q.colunas.map((d) => (
            <View key={d.date} style={[s.thDia, d.feriado ? { backgroundColor: CORES_ESCALA.feriadoForte } : {}]}>
              <Text style={s.thSub}>{SEMANA_CURTA[diaDaSemana(d.date)].slice(0, 1)}</Text>
              <Text style={s.thTexto}>{d.date.slice(8)}</Text>
            </View>
          ))}
          <View style={[s.folgas, { width: larguraFolgas }]}><Text style={s.thTexto}>Folgas</Text></View>
        </View>

        {q.linhas.length === 0 && <Text style={s.vazio}>Ninguém no quadro neste período.</Text>}

        {q.linhas.map((l, n) => (
          // O título do grupo fica na mesma página que a primeira pessoa
          <View key={n} wrap={false}>
            {l.grupo !== q.linhas[n - 1]?.grupo && (
              <View style={s.grupo}><Text style={[s.grupoTexto, { color: cor }]}>{rotuloGrupo(q.linhas, l.grupo)}</Text></View>
            )}
            <View style={s.linha}>
              <View style={[s.pessoa, { width: larguraPessoa }]}>
                <Text style={s.nome}>{l.nome}</Text>
                <Text style={s.escala}>{l.escala}</Text>
              </View>
              {l.celulas.map((c, i) => (
                <View key={c.dia.date} style={[s.dia, fundoDia(i)]}>
                  <Marca c={c} cor={cor} />
                </View>
              ))}
              <View style={[s.folgas, { width: larguraFolgas }]}><Text style={s.folgasTexto}>{l.folgas}</Text></View>
            </View>
          </View>
        ))}

        {q.linhas.length > 0 && (
          <View style={s.linhaTotal} wrap={false}>
            <Text style={[s.totalRotulo, { width: larguraPessoa }]}>Trabalhando</Text>
            {q.colunas.map((d, i) => <Text key={d.date} style={s.totalDia}>{q.linhas.filter((l) => l.celulas[i]?.tipo === 'trabalho').length}</Text>)}
            <View style={{ width: larguraFolgas }} />
          </View>
        )}

        <View wrap={false}>
          <View style={s.legenda}>
            {legenda.map(([letra, estilo, corLetra, texto]) => (
              <View key={texto} style={s.legendaItem}>
                <View style={[s.legendaMarca, estilo]}><Text style={[s.legendaLetra, { color: corLetra }]}>{letra}</Text></View>
                <Text style={s.legendaTexto}>{texto}</Text>
              </View>
            ))}
          </View>

          {feriados.length > 0 && (
            <>
              <Text style={s.feriadosTitulo}>Feriados no período</Text>
              <Text style={s.feriados}>{feriados.map((f) => `${fmtDia(f.date)} ${f.feriado_nome ?? 'Feriado'}`).join('   ·   ')}</Text>
            </>
          )}
        </View>

        <View style={s.rodape} fixed>
          <Text style={s.rodapeTexto}>Gerado em {q.geradoEm}</Text>
          <Text style={s.rodapeTexto} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
