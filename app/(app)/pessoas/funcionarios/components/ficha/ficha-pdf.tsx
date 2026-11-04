import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import type { Employee } from '../../queries'
import type { CompanyBenefit } from '../../../beneficios/queries'
import type { Company } from '../../../../empresa/queries'
import {
  ARQUIVOS, CONTRATO_OPTIONS, STATUS_CFG, fmtDate, fmtMoney, iniciais, isPjOuAutonomo, labelDe,
  maskCnpj, maskCpf, tipoLabel, GRAU_OPTIONS,
} from './ficha-config'

const C = {
  primary: '#2C3E50',
  accent: '#C19A6B',
  border: '#E5E7EB',
  muted: '#6B7280',
  text: '#1F2937',
  bgSoft: '#F9FAFB',
}

const s = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 9, color: C.text, paddingHorizontal: 32, paddingTop: 28, paddingBottom: 44 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    borderBottomWidth: 2, borderBottomColor: C.accent, paddingBottom: 10, marginBottom: 16,
  },
  headerLogo: { width: 32, height: 32, marginBottom: 4, borderRadius: 4 },
  companyName: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.primary },
  companyDetail: { fontSize: 8, color: C.muted, marginTop: 1 },
  docTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: C.primary, textAlign: 'right' },
  docSub: { fontSize: 8, color: C.muted, marginTop: 2, textAlign: 'right' },

  perfil: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  foto: { width: 56, height: 56, borderRadius: 28, objectFit: 'cover' },
  fotoVazia: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#EEF2F7',
    alignItems: 'center', justifyContent: 'center',
  },
  fotoIniciais: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: C.primary },
  nome: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: C.text },
  cargo: { fontSize: 9, color: C.muted, marginTop: 2 },
  selos: { flexDirection: 'row', gap: 4, marginTop: 5 },
  selo: { fontSize: 7, fontFamily: 'Helvetica-Bold', paddingVertical: 2, paddingHorizontal: 6, borderRadius: 8 },

  secao: { marginBottom: 12 },
  secaoTitulo: {
    fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.primary, textTransform: 'uppercase', letterSpacing: 0.8,
    borderLeftWidth: 3, borderLeftColor: C.accent, paddingLeft: 6, marginBottom: 6,
  },
  grade: { flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, borderColor: C.border, borderRadius: 4 },
  celula: { width: '33.33%', paddingVertical: 5, paddingHorizontal: 7, borderBottomWidth: 1, borderBottomColor: C.border },
  celulaLarga: { width: '100%' },
  rotulo: { fontSize: 6.5, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
  valor: { fontSize: 9, color: C.text },
  vazio: { fontSize: 9, color: '#9CA3AF' },

  footer: {
    position: 'absolute', bottom: 18, left: 32, right: 32, flexDirection: 'row', justifyContent: 'space-between',
    borderTopWidth: 1, borderTopColor: C.border, paddingTop: 5,
  },
  footerText: { fontSize: 7, color: C.muted },
})

type Item = { rotulo: string; valor: string | null | undefined; largo?: boolean }

function Secao({ titulo, itens }: { titulo: string; itens: Item[] }) {
  return (
    <View style={s.secao} wrap={false}>
      <Text style={s.secaoTitulo}>{titulo}</Text>
      <View style={s.grade}>
        {itens.map((it) => (
          <View key={it.rotulo} style={it.largo ? [s.celula, s.celulaLarga] : s.celula}>
            <Text style={s.rotulo}>{it.rotulo}</Text>
            <Text style={it.valor ? s.valor : s.vazio}>{it.valor || '—'}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

interface Props {
  employee: Employee
  company: Company | null
  /** Foto já baixada (data URL) — sem foto, mostra as iniciais */
  foto: string | null
  benefits: CompanyBenefit[]
  geradoEm: string
}

// Ficha cadastral do funcionário em PDF (mesmas seções da tela)
export function FichaPdf({ employee: e, company, foto, benefits, geradoEm }: Props) {
  const pj = isPjOuAutonomo(e.tipo_contrato)
  const status = STATUS_CFG[e.status]
  const empresa = company?.nome_fantasia || company?.razao_social || ''
  const vinculados = benefits.filter((b) => e.employee_benefits.some((eb) => eb.benefit_id === b.id))

  const identificacao: Item[] = [
    { rotulo: 'Nome completo', valor: e.nome, largo: true },
    { rotulo: 'CPF', valor: e.cpf ? maskCpf(e.cpf) : null },
    { rotulo: 'RG', valor: e.rg },
    { rotulo: 'Nascimento', valor: fmtDate(e.nascimento) },
    { rotulo: 'Telefone', valor: e.telefone },
    { rotulo: 'E-mail', valor: e.email },
    { rotulo: 'Forma de contratação', valor: tipoLabel(e.tipo_contrato) },
  ]

  const cargo: Item[] = pj
    ? [
        ...(e.tipo_contrato === 'pj' ? [{ rotulo: 'CNPJ', valor: e.cnpj ? maskCnpj(e.cnpj) : null }] : []),
        { rotulo: 'Serviço prestado', valor: e.servico },
        { rotulo: 'Valor do contrato', valor: fmtMoney(e.valor_servico) },
        { rotulo: 'Data de início', valor: fmtDate(e.data_admissao) },
        { rotulo: 'Status', valor: status?.label },
      ]
    : [
        { rotulo: 'Cargo', valor: e.cargo },
        { rotulo: 'Departamento', valor: e.departamento },
        { rotulo: 'Local de trabalho', valor: e.local_trabalho },
        { rotulo: 'Status', valor: status?.label },
        { rotulo: 'Grau de instrução', valor: labelDe(GRAU_OPTIONS, e.grau_instrucao) },
        { rotulo: 'Salário bruto', valor: fmtMoney(e.salario) },
        { rotulo: 'Plano de saúde', valor: e.plano_saude ? 'Sim' : 'Não' },
      ]

  const datas: Item[] = [
    { rotulo: 'Admissão', valor: fmtDate(e.data_admissao) },
    { rotulo: 'Status do contrato', valor: labelDe(CONTRATO_OPTIONS, e.status_contrato) },
    { rotulo: 'Fim do 1º período de experiência', valor: fmtDate(e.fim_experiencia_1) },
    { rotulo: 'Fim do 2º período de experiência', valor: fmtDate(e.fim_experiencia_2) },
    { rotulo: 'Vencimento de férias', valor: fmtDate(e.vcto_ferias) },
    { rotulo: 'Conceder férias até', valor: fmtDate(e.conceder_ferias_ate) },
    { rotulo: 'Próximo exame periódico', valor: fmtDate(e.exame_periodico) },
    ...(e.data_demissao ? [{ rotulo: 'Demissão', valor: fmtDate(e.data_demissao) }] : []),
  ]

  const documentacao: Item[] = [
    ...(!pj
      ? [
          { rotulo: 'PIS / PASEP', valor: e.pis_pasep },
          { rotulo: 'Matrícula', valor: e.matricula },
          { rotulo: 'Série da CTPS', valor: e.serie_ctps },
          { rotulo: 'Certificado de reservista', valor: e.certificado_reservista },
          { rotulo: 'Dependentes', valor: String(e.dependentes ?? 0) },
        ]
      : []),
    { rotulo: 'Dados bancários', valor: e.dados_bancarios, largo: true },
  ]

  const beneficios: Item[] = [
    ...(!pj
      ? [{
          rotulo: 'Benefícios vinculados',
          valor: vinculados.map((b) => `${b.nome} (${fmtMoney(b.valor)}${b.por_dia_trabalhado ? '/dia' : '/mês'})`).join(' · '),
          largo: true,
        }]
      : []),
    ...(!pj ? [{ rotulo: 'Registro de ponto pelo colaborador', valor: e.pin_ativo ? 'Permitido' : 'Não permitido' }] : []),
    { rotulo: 'Acesso ao sistema', valor: e.profile_id ? 'Sim' : 'Não' },
  ]

  const arquivos: Item[] = ARQUIVOS.map((a) => ({ rotulo: a.label, valor: e[a.col] ? 'Anexado' : null }))

  return (
    <Document title={`Ficha - ${e.nome}`} author={empresa}>
      <Page size="A4" style={s.page}>
        <View style={s.header} fixed>
          <View>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            {company?.logo_url && <Image src={company.logo_url} style={s.headerLogo} />}
            <Text style={s.companyName}>{empresa}</Text>
            {company?.cnpj && <Text style={s.companyDetail}>CNPJ {maskCnpj(company.cnpj)}</Text>}
          </View>
          <View>
            <Text style={s.docTitle}>Ficha do funcionário</Text>
            <Text style={s.docSub}>Gerada em {geradoEm}</Text>
          </View>
        </View>

        <View style={s.perfil}>
          {foto ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={foto} style={s.foto} />
          ) : (
            <View style={s.fotoVazia}><Text style={s.fotoIniciais}>{iniciais(e.nome)}</Text></View>
          )}
          <View>
            <Text style={s.nome}>{e.nome}</Text>
            {(e.cargo || e.servico) && <Text style={s.cargo}>{pj ? e.servico : e.cargo}</Text>}
            <View style={s.selos}>
              {status && <Text style={[s.selo, { backgroundColor: status.bg, color: status.color }]}>{status.label}</Text>}
              {e.tipo_contrato && <Text style={[s.selo, { backgroundColor: '#EEF2F7', color: C.primary }]}>{tipoLabel(e.tipo_contrato)}</Text>}
            </View>
          </View>
        </View>

        <Secao titulo="Identificação" itens={identificacao} />
        <Secao titulo={pj ? 'Contrato e valores' : 'Cargo e remuneração'} itens={cargo} />
        {!pj && <Secao titulo="Datas e contrato" itens={datas} />}
        <Secao titulo="Documentação" itens={documentacao} />
        <Secao titulo={pj ? 'Acessos' : 'Benefícios e acessos'} itens={beneficios} />
        <Secao titulo="Arquivos" itens={arquivos} />

        <View style={s.footer} fixed>
          <Text style={s.footerText}>{empresa} · Ficha de {e.nome}</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
