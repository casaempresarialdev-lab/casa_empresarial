'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { ModalFerias } from '@/components/modules/ferias/modal-ferias'
import { Button } from '@/components/ui/button'
import { ListEmpty } from '@/components/ui/list-item'
import { ROTULO_SITUACAO, ROTULO_STATUS, calcularPeriodos, fimDasFerias, fmt, type ConfigFerias } from '@/lib/ferias/regras'
import { toast } from '@/lib/toast'
import type { FeriasEquipe } from '../../pessoas/ferias/queries'
import { desistirFeriasAction, solicitarFeriasAction } from '../actions'

function Selo({ texto, fundo, cor }: { texto: string; fundo: string; cor: string }) {
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap" style={{ backgroundColor: fundo, color: cor }}>{texto}</span>
}

function Numero({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{rotulo}</p>
      <p className="text-sm font-bold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>{valor}</p>
    </div>
  )
}

export function MinhasFeriasClient({ pessoa, ferias, config }: { pessoa: { id: string; nome: string; data_admissao: string | null } | null; ferias: FeriasEquipe[]; config: ConfigFerias }) {
  const router = useRouter()
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
  const [solicitando, setSolicitando] = useState(false)
  const [desistindo, setDesistindo] = useState<string | null>(null)

  const feriasDe = useCallback(() => ferias, [ferias])
  const periodos = useMemo(() => (pessoa ? calcularPeriodos(pessoa.data_admissao, hoje, ferias) : []), [pessoa, hoje, ferias])
  const podePedir = config.ferias_solicitacao_ativa && periodos.some((p) => p.saldo > 0 && p.situacao !== 'em_aquisicao')
  const historico = [...ferias].sort((a, b) => b.data_inicio.localeCompare(a.data_inicio))

  async function desistir(id: string) {
    setDesistindo(id)
    const r = await toast.promise(desistirFeriasAction(id), { loading: 'Cancelando o pedido…', success: 'Pedido cancelado.', error: 'Não foi possível cancelar.' })
    setDesistindo(null)
    if (!('error' in r)) router.refresh()
  }

  const bloqueio = !pessoa ? 'Seu usuário não está ligado a uma ficha da Equipe.' : !pessoa.data_admissao ? 'Sua ficha ainda não tem a data de admissão. Fale com a área de Pessoas.' : null

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>Minhas férias</h1>
        <Breadcrumb />
      </div>

      {bloqueio ? (
        <div className="app-card p-5"><p className="text-sm text-center py-8" style={{ color: 'var(--color-text-muted)' }}>{bloqueio}</p></div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="app-card p-5 flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>Períodos aquisitivos</h2>
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>A cada 12 meses de trabalho, você ganha 30 dias de férias para tirar nos 12 meses seguintes.</p>
              </div>
              {config.ferias_solicitacao_ativa
                ? <Button type="button" size="sm" disabled={!podePedir} onClick={() => setSolicitando(true)} title={podePedir ? undefined : 'Nenhum período com saldo disponível'}>Solicitar férias</Button>
                : <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Os pedidos de férias são feitos com a área de Pessoas.</p>}
            </div>

            {periodos.length === 0 && <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Nenhum período aquisitivo em aberto.</p>}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {periodos.map((p) => (
                <div key={p.inicio} className="rounded-xl border px-4 py-3.5 flex flex-col gap-3" style={{ borderColor: p.situacao === 'vencendo' ? '#F59E0B' : 'var(--color-card-border)' }}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold tabular-nums" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>{fmt(p.inicio)} a {fmt(p.fim)}</p>
                    <Selo {...ROTULO_SITUACAO[p.situacao]} />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {p.situacao === 'em_aquisicao'
                      ? <Numero rotulo="Trabalhado" valor={`${p.mesesAdquiridos} de 12 meses`} />
                      : <Numero rotulo="Saldo" valor={`${p.saldo} dias`} />}
                    <Numero rotulo="Já marcados" valor={`${p.usados + p.reservados} dias`} />
                    <Numero rotulo="Tirar até" valor={fmt(p.concessivoFim)} />
                  </div>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {p.situacao === 'em_aquisicao'
                      ? `Este período fecha em ${fmt(p.fim)}. Depois disso, você pode pedir as férias dele.`
                      : p.situacao === 'concluido' ? 'Todos os dias deste período já estão marcados.'
                      : `As férias precisam começar até ${fmt(p.concessivoFim)}.`}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="app-card p-5 flex flex-col gap-4">
            <h2 className="text-base font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>Pedidos e férias marcadas</h2>
            <ul className="flex flex-col gap-2">
              {historico.length === 0 && <ListEmpty>Nenhum pedido de férias ainda.</ListEmpty>}
              {historico.map((f) => {
                const fim = fimDasFerias(f.data_inicio, f.dias)
                const s = f.status === 'aprovada' && f.data_inicio <= hoje && fim >= hoje ? { texto: 'Em férias', fundo: '#DCFCE7', cor: '#15803D' } : ROTULO_STATUS[f.status]
                return (
                  <li key={f.id} className="rounded-xl border bg-white px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-1" style={{ borderColor: 'var(--color-card-border)' }}>
                    <span className="flex-1 min-w-[220px] text-sm" style={{ color: 'var(--color-text-primary)' }}>
                      <strong className="tabular-nums">{fmt(f.data_inicio)} a {fmt(fim)}</strong>
                      <span style={{ color: 'var(--color-text-muted)' }}> · {f.dias} dias{f.dias_abono ? ` · ${f.dias_abono} vendidos` : ''}</span>
                    </span>
                    <Selo {...s} />
                    {f.status === 'solicitada' && (
                      <button type="button" disabled={desistindo === f.id} onClick={() => desistir(f.id)} className="text-xs font-semibold cursor-pointer hover:underline disabled:opacity-50" style={{ color: 'var(--color-text-muted)' }}>Cancelar pedido</button>
                    )}
                    {f.status === 'recusada' && f.resposta && <p className="basis-full text-xs" style={{ color: '#B91C1C' }}>Resposta: {f.resposta}</p>}
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      )}

      {solicitando && pessoa && (
        <ModalFerias
          titulo="Solicitar férias"
          pessoas={[pessoa]}
          feriasDe={feriasDe}
          config={config}
          origem="colaborador"
          acao={(d) => solicitarFeriasAction(d)}
          onClose={() => setSolicitando(false)}
          onSalvo={() => { setSolicitando(false); router.refresh() }}
        />
      )}
    </>
  )
}
