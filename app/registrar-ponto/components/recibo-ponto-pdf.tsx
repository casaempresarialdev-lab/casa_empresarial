import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'

export type DadosRecibo = {
  empresa: string
  funcionario: string
  data: string
  hora: string
  corMarca: string
  /** Id único deste registro de ponto */
  id: string
}

const s = StyleSheet.create({
  pagina: { padding: 48, fontFamily: 'Helvetica', fontSize: 11, color: '#1F2937' },
  caixa: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 28 },
  empresa: { fontSize: 15, fontFamily: 'Helvetica-Bold' },
  titulo: { fontSize: 11, color: '#6B7280', marginTop: 3 },
  hora: { fontSize: 38, fontFamily: 'Helvetica-Bold', marginTop: 28 },
  divisor: { borderTopWidth: 1, borderTopColor: '#E5E7EB', marginVertical: 22 },
  linha: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 9 },
  rotulo: { color: '#6B7280' },
  id: { fontFamily: 'Courier', fontSize: 9, marginTop: 3 },
})

// Recibo do ponto em PDF, para o funcionário guardar
export function ReciboPontoPdf({ empresa, funcionario, data, hora, corMarca, id }: DadosRecibo) {
  return (
    <Document title={`Comprovante de ponto - ${data}`}>
      <Page size="A5" style={s.pagina}>
        <View style={s.caixa}>
          <Text style={s.empresa}>{empresa}</Text>
          <Text style={s.titulo}>Comprovante de registro de ponto</Text>
          <Text style={[s.hora, { color: corMarca }]}>{hora}</Text>
          <View style={s.divisor} />
          <View style={s.linha}><Text style={s.rotulo}>Funcionário</Text><Text>{funcionario}</Text></View>
          <View style={s.linha}><Text style={s.rotulo}>Data</Text><Text>{data}</Text></View>
          <View style={{ marginTop: 6 }}>
            <Text style={s.rotulo}>Id do registro</Text>
            <Text style={s.id}>{id}</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}
