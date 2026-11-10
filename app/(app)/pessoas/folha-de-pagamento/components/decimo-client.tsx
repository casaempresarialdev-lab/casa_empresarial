'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { SummaryCard } from '@/components/modules/dashboard/summary-card'
import { baixarHolerite } from '@/components/modules/folha/baixar-holerite'
import { Button } from '@/components/ui/button'
import { FilterResult, SearchField } from '@/components/ui/filter-select'
import { Tabs } from '@/components/ui/form-steps'
import { Icon } from '@/components/ui/icon'
import { ListEmpty, ListItem } from '@/components/ui/list-item'
import { Modal } from '@/components/ui/modal'
import { fmtDataBr } from '@/lib/folha/config'
import { toast } from '@/lib/toast'
import { iniciais } from '../../funcionarios/components/ficha/ficha-config'
import type { Company } from '../../../empresa/queries'
import { fecharDecimoAction, reabrirDecimoAction } from '../actions-decimo'
import type { DecimoDoAno } from '../queries-decimo'
import { AbasFolha } from './abas-folha'

const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

function Valor({ rotulo, valor, forte }: { rotulo: string; valor: number; forte?: boolean }) {
  return (
    <span className="text-right">
      <span className="block text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{rotulo}</span>
      <span className={`block text-sm tabular-nums whitespace-nowrap ${forte ? 'font-bold' : 'font-semibold'}`} style={{ color: forte ? 'var(--color-brand)' : 'var(--color-text-primary)', fontFamily: forte ? 'Manrope' : undefined }}>{moeda(valor)}</span>
    </span>
  )
}

function Selo({ children, alerta }: { children: React.ReactNode; alerta?: boolean }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap" style={alerta ? { backgroundColor: '#FEF3C7', color: '#B45309' } : { backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}>
      {children}
    </span>
  )
}

// 13º salário do ano, por parcela: confere, fecha (vai para o fluxo de caixa) e libera o recibo
export function DecimoClient({ decimo, company, companyId }: { decimo: DecimoDoAno; company: Company | null; companyId: string }) {
  const router = useRouter()
  const { ano, parcela, linhas, fechada, pagamentoEm } = decimo
  const [busca, setBusca] = useState('')
  const [confirmar, setConfirmar] = useState<'fechar' | 'reabrir' | null>(null)
  const [processando, setProcessando] = useState(false)

  const totais = useMemo(() => linhas.reduce((t, l) => ({
    bruto: t.bruto + (parcela === 1 ? l.recibo.resumo.valor : l.recibo.resumo.integral),
    liquido: t.liquido + l.recibo.liquido,
    retidos: t.retidos + l.recibo.resumo.inss + l.recibo.resumo.irrf,
    fgts: t.fgts + l.recibo.resumo.fgts,
  }), { bruto: 0, liquido: 0, retidos: 0, fgts: 0 }), [linhas, parcela])

  const q = busca.toLowerCase()
  const visiveis = linhas.filter((l) => !q || l.employee.nome.toLowerCase().includes(q) || (l.employee.cargo ?? '').toLowerCase().includes(q))
  const ir = (a: number, p: 1 | 2) => router.push(`/pessoas/folha-de-pagamento?aba=decimo&ano=${a}&parcela=${p}`)

  async function baixar(l: DecimoDoAno['linhas'][number]) {
    try {
      await toast.promise(
        baixarHolerite({ company, employee: l.employee, competencia: `13º salário ${ano}`, documento: l.recibo, responsavel: decimo.responsavel, pagamentoEm }, `13-salario-${ano}-${parcela}a-parcela-${l.employee.nome.split(' ')[0].toLowerCase()}`),
        { loading: 'Gerando o recibo…', success: 'Recibo baixado.', error: 'Não foi possível gerar o recibo.' },
      )
    } catch {
      // A mensagem de erro já apareceu
    }
  }

  async function executar() {
    const acao = confirmar
    if (!acao) return
    setProcessando(true)
    try {
      await toast.promise(acao === 'fechar' ? fecharDecimoAction(companyId, ano, parcela) : reabrirDecimoAction(companyId, ano, parcela), {
        loading: acao === 'fechar' ? 'Fechando…' : 'Reabrindo…',
        success: acao === 'fechar' ? `${parcela}ª parcela do 13º fechada.` : `${parcela}ª parcela do 13º reaberta.`,
        error: 'Não foi possível concluir.',
      })
      router.refresh()
    } catch {
      // A mensagem de erro já apareceu
    }
    setProcessando(false)
    setConfirmar(null)
  }

  const seta = 'w-9 h-9 rounded-lg flex items-center justify-center transition-colors hover:bg-gray-100'

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>Folha de Pagamento</h1>
        <Breadcrumb />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 gap-4 mb-6">
        <SummaryCard icon="users" title={parcela === 1 ? 'Valor da 1ª parcela' : '13º integral'} value={moeda(totais.bruto)} caption={plural(linhas.length, 'pessoa com direito', 'pessoas com direito')} />
        <SummaryCard icon="wallet" title="Líquido a pagar" value={moeda(totais.liquido)} caption={`até ${fmtDataBr(pagamentoEm)}`} delay={60} />
        <SummaryCard icon="file" title="INSS e IRRF retidos" value={moeda(totais.retidos)} caption={parcela === 1 ? 'Descontados só na 2ª parcela' : 'Calculados só sobre o 13º'} delay={120} />
        <SummaryCard icon="dollar" title="FGTS" value={moeda(totais.fgts)} caption="Sobre o valor da parcela" delay={180} />
      </div>

      <AbasFolha aba="decimo" ano={ano} />

      <div className="app-card p-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1" style={{ color: 'var(--color-sidebar-text)' }}>
            <button type="button" onClick={() => ir(ano - 1, parcela)} aria-label="Ano anterior" className={seta}><Icon name="chevron-left" size={18} /></button>
            <span className="w-20 text-center text-sm font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>{ano}</span>
            <button type="button" onClick={() => ir(ano + 1, parcela)} aria-label="Próximo ano" className={seta}><Icon name="chevron-right" size={18} /></button>
            <span className="ml-2"><Selo alerta={!fechada}>{fechada ? 'Fechada' : 'Em conferência'}</Selo></span>
          </div>
          {linhas.length > 0 && (
            fechada
              ? <Button type="button" variant="secondary" size="sm" onClick={() => setConfirmar('reabrir')} disabled={decimo.segundaFechada}>Reabrir {parcela}ª parcela</Button>
              : <Button type="button" size="sm" onClick={() => setConfirmar('fechar')}>Fechar {parcela}ª parcela</Button>
          )}
        </div>

        <div className="-mb-2">
          <Tabs labels={['1ª parcela · até 30/11', '2ª parcela · até 20/12']} step={parcela - 1} onSelect={(i) => ir(ano, (i + 1) as 1 | 2)} />
        </div>

        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {parcela === 1
            ? <>Metade do 13º proporcional aos meses trabalhados até novembro, sem INSS e IRRF. Pagamento até <strong>{fmtDataBr(pagamentoEm)}</strong>.</>
            : <>13º integral do ano, menos a 1ª parcela, com INSS e IRRF calculados só sobre o 13º. Pagamento até <strong>{fmtDataBr(pagamentoEm)}</strong>.</>}
          {' '}Conta o mês com 15 dias ou mais de trabalho, e a base inclui a média de horas extras, adicional noturno, DSR e comissões das folhas fechadas.
        </p>

        {parcela === 2 && !decimo.primeiraFechada && !fechada && linhas.length > 0 && (
          <p className="text-sm rounded-lg px-3 py-2" style={{ backgroundColor: '#FEF3C7', color: '#B45309' }}>
            A 1ª parcela de {ano} não foi fechada no sistema: a 2ª parcela paga o 13º inteiro.
          </p>
        )}
        {parcela === 1 && decimo.segundaFechada && (
          <p className="text-sm rounded-lg px-3 py-2" style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-text-secondary)' }}>
            A 2ª parcela já foi fechada. Para reabrir a 1ª, reabra a 2ª antes.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <SearchField value={busca} onChange={setBusca} placeholder="Pesquisar por nome ou cargo..." />
          {busca && <FilterResult total={visiveis.length} onClear={() => setBusca('')} />}
        </div>

        <ul className="flex flex-col gap-3">
          {visiveis.length === 0 && <ListEmpty>{linhas.length === 0 ? 'Ninguém com 13º neste ano: só entram CLT e menor aprendiz ativos, com salário.' : 'Nenhum funcionário encontrado.'}</ListEmpty>}
          {visiveis.map((l) => {
            const r = l.recibo.resumo
            return (
              <ListItem
                key={l.employee.id}
                media={
                  <span className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold" style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}>
                    {iniciais(l.employee.nome)}
                  </span>
                }
                title={l.employee.nome}
                subtitle={`${r.avos}/12 avos · base ${moeda(r.base)}${parcela === 2 && r.primeira > 0 ? ` · 1ª parcela ${moeda(r.primeira)}` : ''}`}
                aside={
                  <>
                    <span className="hidden xl:grid grid-cols-2 gap-4 w-56">
                      <Valor rotulo={parcela === 1 ? 'Parcela' : 'Integral'} valor={parcela === 1 ? r.valor : r.integral} />
                      <Valor rotulo="INSS e IRRF" valor={r.inss + r.irrf} />
                    </span>
                    <span className="xl:w-28"><Valor rotulo="Líquido" valor={l.recibo.liquido} forte /></span>
                  </>
                }
                onClick={() => baixar(l)}
                actionsLabel={l.employee.nome}
                actions={[{ icon: 'download', label: fechada ? 'Baixar recibo' : 'Baixar prévia do recibo', onClick: () => baixar(l) }]}
              />
            )
          })}
        </ul>

        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {decimo.responsavel === 'contabilidade' ? 'Estimativa para conferência da contabilidade' : 'Cálculo do sistema'}, com INSS e IRRF pelas tabelas de 2026. Quem saiu da empresa recebe o 13º proporcional na rescisão.
        </p>
      </div>

      <Modal open={confirmar !== null} onClose={() => { if (!processando) setConfirmar(null) }} title={confirmar === 'fechar' ? `Fechar a ${parcela}ª parcela do 13º de ${ano}` : `Reabrir a ${parcela}ª parcela do 13º de ${ano}`}>
        <div className="flex flex-col gap-4">
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {confirmar === 'fechar'
              ? `Os valores ficam congelados e ${moeda(totais.liquido)} entram no fluxo de caixa como pendentes, com vencimento em ${fmtDataBr(pagamentoEm)}, além das guias de FGTS${parcela === 2 ? ', INSS e IRRF' : ''}. Se a empresa disponibiliza o holerite, cada pessoa recebe o recibo em Meu holerite.`
              : 'Os lançamentos pendentes desta parcela saem do fluxo de caixa e os valores voltam a ser calculados.'}
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setConfirmar(null)} disabled={processando}>Cancelar</Button>
            <Button type="button" loading={processando} onClick={executar}>{confirmar === 'fechar' ? 'Fechar parcela' : 'Reabrir parcela'}</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
