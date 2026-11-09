// Cálculo da folha a partir do ponto, da escala e dos benefícios.
// Puro: o servidor usa para fechar a folha e a tela usa para recalcular enquanto a pessoa edita.

import { DIAS_UTEIS_MES, descontoMensal, valorMensal, type BeneficioCalculo } from '@/lib/beneficios-calculo'
import type { DayResult, ScheduleRule } from '@/lib/escala/generate'
import { minutosTrabalhados } from '@/lib/ponto'

export const VIGENCIA_TABELAS = '2026'

// INSS empregado 2026 (Portaria Interministerial MPS/MF nº 13/2026)
const TETO_INSS = 8475.55
const INSS_FAIXAS = [
  { limite: 1621.00, aliq: 0.075 },
  { limite: 2902.84, aliq: 0.09 },
  { limite: 4354.27, aliq: 0.12 },
  { limite: TETO_INSS, aliq: 0.14 },
]

// IRRF mensal e redução da Lei 15.270/2025
const IRRF_FAIXAS = [
  { limite: 2428.80, aliq: 0, deduz: 0 },
  { limite: 2826.65, aliq: 0.075, deduz: 182.16 },
  { limite: 3751.05, aliq: 0.15, deduz: 394.16 },
  { limite: 4664.68, aliq: 0.225, deduz: 675.49 },
  { limite: Infinity, aliq: 0.275, deduz: 908.73 },
]
const DEDUCAO_DEPENDENTE = 189.59
const DESCONTO_SIMPLIFICADO = 607.20

/** Art. 58 §1º da CLT: até 10 minutos no dia não contam como atraso nem hora extra */
export const TOLERANCIA_DIARIA_MIN = 10
const DIVISOR_PADRAO = 220
const ADICIONAL_PERICULOSIDADE = 0.30

const centavos = (v: number) => Math.round(v * 100) / 100

export function calcInss(base: number) {
  let inss = 0
  let anterior = 0
  const teto = Math.min(base, TETO_INSS)
  for (const { limite, aliq } of INSS_FAIXAS) {
    if (teto <= anterior) break
    inss += (Math.min(teto, limite) - anterior) * aliq
    anterior = limite
  }
  return centavos(inss)
}

export function calcIrrf(rendimento: number, inss: number, dependentes: number) {
  const deducoes = Math.max(inss + dependentes * DEDUCAO_DEPENDENTE, DESCONTO_SIMPLIFICADO)
  const base = rendimento - deducoes
  const faixa = IRRF_FAIXAS.find((f) => base <= f.limite) ?? IRRF_FAIXAS[IRRF_FAIXAS.length - 1]
  const imposto = Math.max(0, base * faixa.aliq - faixa.deduz)
  const reducao = rendimento <= 5000 ? imposto : rendimento <= 7350 ? Math.max(0, 978.62 - 0.133145 * rendimento) : 0
  return centavos(Math.max(0, imposto - reducao))
}

// ── Ponto ─────────────────────────────────────────────────────────────────────

export type RegistroPonto = {
  data: string
  batidas: { em: string }[]
  tipo: string
}

export type MotivoSemApuracao = 'sem_controle' | 'sem_escala' | 'sem_registros'

export type ApuracaoPonto = {
  /** Por que o ponto não foi usado; sem motivo, os números abaixo são automáticos */
  motivo: MotivoSemApuracao | null
  diasEscala: number
  diasTrabalhados: number
  faltas: number
  atestados: number
  ferias: number
  atrasoMin: number
  he50Min: number
  heFeriadoMin: number
  heDomingoMin: number
  /** Dias já passados com número ímpar de batidas (entrada sem saída): não entram no cálculo */
  incompletos: number
  ocorrencias: { data: string; texto: string }[]
}

const paraMin = (hora: string) => {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}

/** 200 → "3h20" */
export function horas(minutos: number) {
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return `${h}h${String(m).padStart(2, '0')}`
}

function previsto(d: DayResult) {
  if (!d.hora_entrada || !d.hora_saida) return 0
  let m = paraMin(d.hora_saida) - paraMin(d.hora_entrada)
  if (m < 0) m += 1440
  if (d.hora_almoco_inicio && d.hora_almoco_fim) m -= paraMin(d.hora_almoco_fim) - paraMin(d.hora_almoco_inicio)
  return Math.max(0, m)
}

export function apurarPonto(
  dias: DayResult[],
  registros: RegistroPonto[],
  { hoje, admissao, controlaPonto }: { hoje: string; admissao: string | null; controlaPonto: boolean },
): ApuracaoPonto {
  const a: ApuracaoPonto = {
    motivo: null, diasEscala: 0, diasTrabalhados: 0, faltas: 0, atestados: 0, ferias: 0,
    atrasoMin: 0, he50Min: 0, heFeriadoMin: 0, heDomingoMin: 0, incompletos: 0, ocorrencias: [],
  }
  if (!controlaPonto) return { ...a, motivo: 'sem_controle' }
  if (!dias.some((d) => d.tipo !== 'sem_regra')) return { ...a, motivo: 'sem_escala' }
  // Mês sem nenhuma batida: é falta de uso do ponto, não o mês inteiro de faltas
  if (registros.length === 0 && dias.some((d) => d.date < hoje)) return { ...a, motivo: 'sem_registros' }

  const porData = new Map(registros.map((r) => [r.data, r]))
  const anotar = (data: string, texto: string) => a.ocorrencias.push({ data, texto })

  for (const d of dias) {
    if (d.tipo === 'sem_regra' || (admissao && d.date < admissao)) continue
    const r = porData.get(d.date)
    const trabalho = d.tipo === 'trabalho'
    const naEscala = trabalho && (!d.feriado || !!r?.batidas.length)
    if (naEscala) a.diasEscala++
    if (d.date > hoje) continue

    if (r?.tipo === 'ferias') { if (naEscala) a.ferias++; continue }
    if (r?.tipo === 'atestado') { if (naEscala) { a.atestados++; anotar(d.date, 'Atestado') } continue }
    if (r?.tipo === 'falta') { a.faltas++; anotar(d.date, 'Falta'); continue }

    if (!r?.batidas.length) {
      if (naEscala && r?.tipo !== 'folga' && d.date < hoje) { a.faltas++; anotar(d.date, 'Falta') }
      continue
    }

    a.diasTrabalhados++
    // Número ímpar de batidas: a última entrada ficou sem saída
    if (r.batidas.length % 2) {
      if (d.date < hoje) { a.incompletos++; anotar(d.date, 'Ponto sem saída: não entrou no cálculo') }
      continue
    }

    const feito = minutosTrabalhados(r.batidas.map((b) => b.em))
    if (d.feriado) { a.heFeriadoMin += feito; anotar(d.date, `Feriado trabalhado: ${horas(feito)}`); continue }
    if (!trabalho) {
      if (d.domingo) { a.heDomingoMin += feito; anotar(d.date, `Domingo de folga trabalhado: ${horas(feito)}`) }
      else { a.he50Min += feito; anotar(d.date, `Folga trabalhada: ${horas(feito)}`) }
      continue
    }

    const saldo = feito - previsto(d)
    if (Math.abs(saldo) <= TOLERANCIA_DIARIA_MIN) continue
    if (saldo > 0) { a.he50Min += saldo; anotar(d.date, `Hora extra: ${horas(saldo)}`) }
    else { a.atrasoMin -= saldo; anotar(d.date, `Atraso ou saída antecipada: ${horas(-saldo)}`) }
  }
  return a
}

/** Horas do mês pela jornada da escala (44h semanais → 220). Sem escala, 220. */
export function divisorHoras(regra: ScheduleRule | null | undefined) {
  if (!regra) return DIVISOR_PADRAO
  let diario = paraMin(regra.hora_saida.slice(0, 5)) - paraMin(regra.hora_entrada.slice(0, 5))
  if (diario < 0) diario += 1440
  if (regra.hora_almoco_inicio && regra.hora_almoco_fim) diario -= paraMin(regra.hora_almoco_fim.slice(0, 5)) - paraMin(regra.hora_almoco_inicio.slice(0, 5))
  const diasNaSemana = regra.tipo_escala === 'ciclo' && regra.ciclo_trabalho_dias && regra.ciclo_folga_dias
    ? (regra.ciclo_trabalho_dias / (regra.ciclo_trabalho_dias + regra.ciclo_folga_dias)) * 7
    : 7 - regra.dias_folga.length
  const semanal = Math.min(44, (diario / 60) * diasNaSemana)
  return semanal > 0 ? Math.round(semanal * 5) : DIVISOR_PADRAO
}

// ── Valores ───────────────────────────────────────────────────────────────────

export const CAMPOS_FOLHA = [
  'desconto_faltas', 'atestados', 'horas_extras', 'horas_extras_feriado', 'horas_extras_domingo', 'bonus',
  'desconto_atrasos', 'desconto_vt', 'desconto_vr', 'desconto_outros', 'desconto_adiantamento',
] as const
export type CampoFolha = (typeof CAMPOS_FOLHA)[number]
export type AjustesFolha = Partial<Record<CampoFolha, number>>
export type ValoresFolha = Record<CampoFolha, number>

export type InsumosFolha = {
  salario: number
  tipoContrato: string | null
  temPericulosidade: boolean
  dependentes: number
  divisor: number
  fgtsPct: number
  outrosEncargosPct: number
  beneficios: { nome: string; beneficio: BeneficioCalculo; valorPessoa: number | null }[]
}

const RE_VT = /transp|\bvt\b|v\.?t\b/i
const RE_VA = /aliment|refei|\bva\b|\bvr\b|v\.?[ar]\b/i

/** PJ, autônomo e estagiário não têm INSS, IRRF nem encargos na folha */
export const temEncargos = (tipo: string | null) => !tipo || tipo === 'clt' || tipo === 'menor_aprendiz'

export function calcularFolha(i: InsumosFolha, ponto: ApuracaoPonto, ajustes: AjustesFolha = {}) {
  const periculosidade = i.temPericulosidade ? centavos(i.salario * ADICIONAL_PERICULOSIDADE) : 0
  const remuneracao = i.salario + periculosidade
  const valorHora = remuneracao / i.divisor
  const diasBeneficio = ponto.motivo ? DIAS_UTEIS_MES : Math.max(0, ponto.diasEscala - ponto.faltas - ponto.atestados - ponto.ferias)

  const ofertas = i.beneficios.map((b) => ({
    nome: b.nome,
    oferecido: valorMensal(b.beneficio, b.valorPessoa, diasBeneficio),
    desconto: descontoMensal(b.beneficio, b.valorPessoa, i.salario, diasBeneficio),
  }))
  const soma = (lista: typeof ofertas, campo: 'oferecido' | 'desconto') => centavos(lista.reduce((s, o) => s + o[campo], 0))
  const vt = ofertas.filter((o) => RE_VT.test(o.nome))
  const va = ofertas.filter((o) => !RE_VT.test(o.nome) && RE_VA.test(o.nome))
  const demais = ofertas.filter((o) => !RE_VT.test(o.nome) && !RE_VA.test(o.nome))

  const automaticos: ValoresFolha = {
    desconto_faltas: ponto.faltas,
    atestados: ponto.atestados,
    horas_extras: centavos((ponto.he50Min / 60) * valorHora * 1.5),
    horas_extras_feriado: centavos((ponto.heFeriadoMin / 60) * valorHora * 2),
    horas_extras_domingo: centavos((ponto.heDomingoMin / 60) * valorHora * 2),
    bonus: 0,
    desconto_atrasos: centavos((ponto.atrasoMin / 60) * valorHora),
    desconto_vt: soma(vt, 'desconto'),
    desconto_vr: soma(va, 'desconto'),
    desconto_outros: soma(demais, 'desconto'),
    desconto_adiantamento: 0,
  }
  const valores: ValoresFolha = { ...automaticos, ...ajustes }

  const valorFaltas = centavos(valores.desconto_faltas * (remuneracao / 30))
  const proventos = centavos(remuneracao + valores.horas_extras + valores.horas_extras_feriado + valores.horas_extras_domingo + valores.bonus)
  const bruto = Math.max(0, centavos(proventos - valorFaltas - valores.desconto_atrasos))

  const clt = temEncargos(i.tipoContrato)
  const inss = clt ? calcInss(bruto) : 0
  const irrf = clt ? calcIrrf(bruto, inss, i.dependentes) : 0
  const descontosBeneficios = centavos(valores.desconto_vt + valores.desconto_vr + valores.desconto_outros)
  const liquido = Math.max(0, centavos(bruto - inss - irrf - descontosBeneficios - valores.desconto_adiantamento))
  const fgts = clt ? centavos(bruto * (i.fgtsPct / 100)) : 0
  const outrosEncargos = clt ? centavos(bruto * (i.outrosEncargosPct / 100)) : 0

  const oferecido = soma(ofertas, 'oferecido')
  const custoBeneficios = Math.max(0, centavos(oferecido - descontosBeneficios))

  return {
    automaticos,
    valores,
    periculosidade,
    valorFaltas,
    proventos,
    bruto,
    inss,
    irrf,
    descontos: centavos(inss + irrf + descontosBeneficios + valores.desconto_adiantamento),
    liquido,
    fgts,
    outrosEncargos,
    transporte: soma(vt, 'oferecido'),
    alimentacao: soma(va, 'oferecido'),
    custoBeneficios,
    custoTotal: centavos(bruto + fgts + outrosEncargos + custoBeneficios),
  }
}

export type ResultadoFolha = ReturnType<typeof calcularFolha>
