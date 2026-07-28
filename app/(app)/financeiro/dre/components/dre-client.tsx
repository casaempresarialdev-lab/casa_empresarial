'use client'

import { useRouter } from 'next/navigation'
import type { DREData, DRELinha } from '../queries'
import type { DreGrupo } from '../../categorias/queries'

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function pct(part: number, total: number) {
  if (total === 0) return null
  return ((part / total) * 100).toFixed(1) + '%'
}

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

// ── Estrutura do DRE ──────────────────────────────────────────────────────────

type DRESecao = {
  grupo: DreGrupo
  titulo: string
  sinal: 1 | -1   // 1 = some ao resultado, -1 = subtrai
  subtotal_label?: string
}

const SECOES: DRESecao[] = [
  { grupo: 'receita_operacional', titulo: 'Receita Operacional Bruta',   sinal:  1 },
  { grupo: 'deducao_receita',     titulo: 'Deduções da Receita',         sinal: -1 },
  { grupo: 'cmv_cpv',             titulo: 'CMV / CPV',                   sinal: -1, subtotal_label: 'Lucro Bruto' },
  { grupo: 'despesa_pessoal',     titulo: 'Despesas com Pessoal',        sinal: -1 },
  { grupo: 'despesa_administrativa', titulo: 'Despesas Administrativas', sinal: -1 },
  { grupo: 'despesa_comercial',   titulo: 'Despesas Comerciais',         sinal: -1 },
  { grupo: 'outras_receitas',     titulo: 'Outras Receitas Operacionais',sinal:  1, subtotal_label: 'Resultado Operacional' },
  { grupo: 'receita_financeira',  titulo: 'Receitas Financeiras',        sinal:  1 },
  { grupo: 'despesa_financeira',  titulo: 'Despesas Financeiras',        sinal: -1, subtotal_label: 'Resultado antes do Imposto' },
  { grupo: 'imposto',             titulo: 'Impostos (DAS / Simples)',    sinal: -1, subtotal_label: 'Resultado Líquido' },
]

// Totais intermediários que queremos calcular
const SUBTOTAL_AFTER: Record<string, string> = {
  cmv_cpv:             'Lucro Bruto',
  outras_receitas:     'Resultado Operacional',
  despesa_financeira:  'Resultado antes do Imposto',
  imposto:             'Resultado Líquido',
}

// ── Componentes de linha ──────────────────────────────────────────────────────

function LinhaCategoria({ linha, receitaLiquida }: { linha: DRELinha; receitaLiquida: number }) {
  const p = pct(linha.total, receitaLiquida)
  return (
    <tr className="border-t" style={{ borderColor: 'var(--color-bg-surface)' }}>
      <td className="pl-8 pr-4 py-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        {linha.categoria_icone && <span className="mr-1">{linha.categoria_icone}</span>}
        {linha.categoria_nome}
      </td>
      <td className="px-4 py-2 text-sm text-right tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
        {fmt(linha.total)}
      </td>
      <td className="pl-4 pr-6 py-2 text-xs text-right tabular-nums w-16" style={{ color: 'var(--color-text-muted)' }}>
        {p ?? ''}
      </td>
    </tr>
  )
}

function LinhaSecaoHeader({ titulo, total, sinal }: { titulo: string; total: number; sinal: 1 | -1 }) {
  const color = sinal === 1 ? '#1E8449' : '#C0392B'
  const prefix = sinal === -1 ? '(−) ' : ''
  return (
    <tr style={{ backgroundColor: 'var(--color-bg-surface)' }}>
      <td className="px-4 py-2 text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--color-text-secondary)', letterSpacing: '0.08em' }}>
        {prefix}{titulo}
      </td>
      <td className="px-4 py-2 text-sm font-semibold text-right tabular-nums" style={{ color: total === 0 ? 'var(--color-text-muted)' : color }}>
        {total === 0 ? '—' : fmt(total)}
      </td>
      <td className="pr-6 py-2" />
    </tr>
  )
}

function LinhaSubtotal({ label, valor, receitaLiquida, destaque }: {
  label: string
  valor: number
  receitaLiquida: number
  destaque?: boolean
}) {
  const positive = valor >= 0
  const color = positive ? '#1E8449' : '#C0392B'
  const p = pct(Math.abs(valor), receitaLiquida)

  return (
    <tr style={{ borderTop: `2px solid var(--color-bg-surface)`, backgroundColor: destaque ? (positive ? '#F0FFF4' : '#FFF5F5') : 'white' }}>
      <td className="px-4 py-3 font-bold text-sm" style={{ color: 'var(--color-text-primary)', fontFamily: 'Manrope' }}>
        {destaque ? (positive ? '✓ ' : '✗ ') : '= '}{label}
      </td>
      <td className="px-4 py-3 font-bold text-base text-right tabular-nums" style={{ color }}>
        {fmt(valor)}
      </td>
      <td className="pl-4 pr-6 py-3 text-xs text-right font-semibold tabular-nums" style={{ color }}>
        {p ?? ''}
      </td>
    </tr>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

interface Props {
  dreData: DREData
  mes: number
  ano: number
}

export function DREClient({ dreData, mes, ano }: Props) {
  const router = useRouter()

  function navigate(delta: number) {
    let m = mes + delta
    let a = ano
    if (m > 12) { m = 1; a++ }
    if (m < 1)  { m = 12; a-- }
    router.push(`/financeiro/dre?mes=${m}&ano=${a}`)
  }

  const { linhas, sem_categoria, nao_classificado } = dreData
  const totalIgnorado = sem_categoria + nao_classificado

  // Agrupar linhas por grupo
  const byGrupo = new Map<DreGrupo, DRELinha[]>()
  for (const l of linhas) {
    const arr = byGrupo.get(l.dre_grupo) ?? []
    arr.push(l)
    byGrupo.set(l.dre_grupo, arr)
  }

  function grupoTotal(grupo: DreGrupo) {
    return (byGrupo.get(grupo) ?? []).reduce((s, l) => s + l.total, 0)
  }

  // Calcular subtotais em ordem
  const recBruta   = grupoTotal('receita_operacional')
  const deducoes   = grupoTotal('deducao_receita')
  const recLiquida = recBruta - deducoes
  const cmv        = grupoTotal('cmv_cpv')
  const lucroBruto = recLiquida - cmv

  const despPessoal = grupoTotal('despesa_pessoal')
  const despAdmin   = grupoTotal('despesa_administrativa')
  const despCom     = grupoTotal('despesa_comercial')
  const outrasRec   = grupoTotal('outras_receitas')
  const resultOp    = lucroBruto - despPessoal - despAdmin - despCom + outrasRec

  const recFin  = grupoTotal('receita_financeira')
  const despFin = grupoTotal('despesa_financeira')
  const resultAntesIR = resultOp + recFin - despFin

  const impostos    = grupoTotal('imposto')
  const resultLiq   = resultAntesIR - impostos

  const SUBTOTAIS: Record<string, { valor: number; destaque?: boolean }> = {
    deducao_receita:     { valor: recLiquida },
    cmv_cpv:             { valor: lucroBruto },
    outras_receitas:     { valor: resultOp },
    despesa_financeira:  { valor: resultAntesIR },
    imposto:             { valor: resultLiq, destaque: true },
  }

  const hasSemDados = linhas.length === 0 && totalIgnorado === 0

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
            DRE
          </h1>
          <div className="flex items-center gap-1">
            <button onClick={() => navigate(-1)}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-sm"
              style={{ color: 'var(--color-text-secondary)' }}>
              ◀
            </button>
            <span className="text-sm font-semibold px-2 min-w-[120px] text-center"
              style={{ color: 'var(--color-text-primary)' }}>
              {MESES[mes - 1]} {ano}
            </span>
            <button onClick={() => navigate(1)}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-sm"
              style={{ color: 'var(--color-text-secondary)' }}>
              ▶
            </button>
          </div>
        </div>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Regime de competência · Apenas realizadas (pago / conciliado)
        </p>
      </div>

      {/* Aviso de dados não classificados */}
      {totalIgnorado > 0 && (
        <div className="mb-4 px-4 py-3 rounded-xl border text-sm flex items-start gap-2"
          style={{ backgroundColor: '#FFFBEB', borderColor: '#FDE68A', color: '#92400E' }}>
          <span>⚠</span>
          <span>
            {fmt(totalIgnorado)} em transações sem grupo DRE ({sem_categoria > 0 ? `${fmt(sem_categoria)} sem categoria` : ''}
            {sem_categoria > 0 && nao_classificado > 0 ? ', ' : ''}
            {nao_classificado > 0 ? `${fmt(nao_classificado)} não classificadas` : ''}).
            Os totais podem estar incompletos.{' '}
            <a href="/financeiro/categorias" className="underline font-medium">Classificar categorias →</a>
          </span>
        </div>
      )}

      {hasSemDados ? (
        <div className="rounded-xl border flex flex-col items-center justify-center py-16 gap-2"
          style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white', color: 'var(--color-text-muted)' }}>
          <p className="text-sm">Nenhuma transação realizada neste período.</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
          <table className="w-full text-sm">
            <thead style={{ backgroundColor: 'var(--color-bg-surface)' }}>
              <tr>
                <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                  Demonstração do Resultado do Exercício
                </th>
                <th className="text-right px-4 py-2.5 font-medium w-36" style={{ color: 'var(--color-text-secondary)' }}>
                  Realizado
                </th>
                <th className="text-right pr-6 py-2.5 font-medium w-16" style={{ color: 'var(--color-text-muted)' }}>
                  % RLiq
                </th>
              </tr>
            </thead>
            <tbody>
              {SECOES.map(secao => {
                const grupoLinhas = byGrupo.get(secao.grupo) ?? []
                const total = grupoTotal(secao.grupo)
                const subtotalInfo = SUBTOTAIS[secao.grupo]

                // Linha de "Receita Líquida" após deduções (especial — não tem categorias próprias)
                const showRecLiquida = secao.grupo === 'deducao_receita'

                return (
                  <>
                    <LinhaSecaoHeader
                      key={`h-${secao.grupo}`}
                      titulo={secao.titulo}
                      total={total}
                      sinal={secao.sinal}
                    />
                    {grupoLinhas.map(l => (
                      <LinhaCategoria key={l.categoria_id} linha={l} receitaLiquida={recLiquida} />
                    ))}

                    {showRecLiquida && (
                      <LinhaSubtotal
                        key="receita-liquida"
                        label="Receita Líquida"
                        valor={recLiquida}
                        receitaLiquida={recLiquida}
                      />
                    )}

                    {subtotalInfo && secao.grupo !== 'deducao_receita' && (
                      <LinhaSubtotal
                        key={`st-${secao.grupo}`}
                        label={SUBTOTAL_AFTER[secao.grupo] ?? ''}
                        valor={subtotalInfo.valor}
                        receitaLiquida={recLiquida}
                        destaque={subtotalInfo.destaque}
                      />
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
