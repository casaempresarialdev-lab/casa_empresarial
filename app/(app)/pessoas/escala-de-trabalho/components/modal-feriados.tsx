'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { buildFeriadoMap, type FeriadoEmpresa } from '@/lib/escala/feriados'
import { toast } from '@/lib/toast'
import { feriadoSchema } from '@/lib/validations/escala'
import { adicionarFeriadoAction, considerarFeriadoNacionalAction, excluirFeriadoAction } from '../actions'

const SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

type Linha =
  | { origem: 'nacional'; data: string; nome: string; considerado: boolean }
  | { origem: 'empresa'; data: string; nome: string; id: string; recorrente: boolean }

const fmtDia = (data: string) => `${data.slice(8)}/${data.slice(5, 7)}`
const semana = (data: string) => SEMANA[new Date(`${data}T00:00:00`).getDay()]

/** Feriados do ano para a empresa: os nacionais, que ela pode desconsiderar, e os que ela acrescenta */
export function ModalFeriados({ companyId, feriados, anoInicial, onClose }: {
  companyId: string
  feriados: FeriadoEmpresa[]
  anoInicial: number
  onClose: () => void
}) {
  const router = useRouter()
  const [ano, setAno] = useState(anoInicial)
  const [data, setData] = useState('')
  const [nome, setNome] = useState('')
  const [recorrente, setRecorrente] = useState(false)
  const [erro, setErro] = useState('')
  const [ocupado, setOcupado] = useState(false)

  const nacionais: Linha[] = [...buildFeriadoMap(ano).entries()].map(([dia, f]) => ({
    origem: 'nacional', data: dia, nome: f.nome, considerado: !feriados.some((x) => x.tipo === 'removido' && x.data === dia),
  }))
  const daEmpresa: Linha[] = feriados
    .filter((f) => f.tipo === 'adicionado' && (f.data.startsWith(String(ano)) || (f.recorrente && f.data.slice(0, 4) < String(ano))))
    .map((f) => ({ origem: 'empresa', id: f.id, data: `${ano}-${f.data.slice(5)}`, nome: f.nome, recorrente: f.recorrente }))
  const linhas = [...nacionais, ...daEmpresa].sort((a, b) => a.data.localeCompare(b.data))

  async function adicionar(e: React.FormEvent) {
    e.preventDefault()
    const dados = { data, nome, recorrente }
    const v = feriadoSchema.safeParse(dados)
    if (!v.success) { setErro(data ? v.error.issues[0].message : 'Informe a data do feriado'); return }

    setErro('')
    setOcupado(true)
    const r = await toast.promise(adicionarFeriadoAction(companyId, dados), {
      loading: 'Adicionando o feriado…',
      success: `${nome.trim()} adicionado.`,
      error: 'Não foi possível adicionar o feriado.',
    })
    setOcupado(false)
    if ('error' in r) return
    setData('')
    setNome('')
    setRecorrente(false)
    setAno(Number(data.slice(0, 4)))
    router.refresh()
  }

  async function executar(acao: Promise<{ error?: string } | { success: true }>) {
    setOcupado(true)
    const r = await acao
    setOcupado(false)
    if ('error' in r) toast.error(r.error ?? 'Não foi possível salvar.')
    else router.refresh()
  }

  const seta = 'w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-colors hover:bg-gray-100'

  return (
    <Modal open onClose={() => { if (!ocupado) onClose() }} title="Feriados" description="Valem para o quadro, o registro de ponto e a folha do mês aberto.">
      <div className="flex flex-col gap-4">
        <form onSubmit={adicionar} noValidate className="flex flex-col gap-3 rounded-xl p-3" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
          <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)] gap-3">
            <Input label="Data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
            <Input label="Nome" placeholder="Ex.: Aniversário da cidade" maxLength={80} value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--color-text-secondary)' }}>
              <input type="checkbox" checked={recorrente} onChange={(e) => setRecorrente(e.target.checked)} style={{ accentColor: 'var(--color-brand)' }} />
              Repete todo ano
            </label>
            <Button type="submit" size="sm" variant="secondary" disabled={ocupado}>Adicionar feriado</Button>
          </div>
          {erro && <p className="text-sm" style={{ color: 'var(--color-error)' }}>{erro}</p>}
        </form>

        <div className="flex items-center justify-center gap-2" style={{ color: 'var(--color-sidebar-text)' }}>
          <button type="button" onClick={() => setAno(ano - 1)} aria-label="Ano anterior" className={seta}><Icon name="chevron-left" size={18} /></button>
          <span className="w-16 text-center text-sm font-bold tabular-nums" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>{ano}</span>
          <button type="button" onClick={() => setAno(ano + 1)} aria-label="Próximo ano" className={seta}><Icon name="chevron-right" size={18} /></button>
        </div>

        <ul className="flex flex-col max-h-72 overflow-y-auto divide-y rounded-xl border" style={{ borderColor: 'var(--color-card-border)' }}>
          {linhas.map((l) => {
            const inativo = l.origem === 'nacional' && !l.considerado
            return (
              <li key={`${l.origem}-${l.data}-${l.nome}`} className="flex items-center gap-3 px-3 py-2" style={{ borderColor: 'var(--color-card-border)' }}>
                <span className="w-16 shrink-0 text-sm font-semibold tabular-nums" style={{ color: inativo ? 'var(--color-text-muted)' : 'var(--color-text-primary)' }}>
                  {fmtDia(l.data)}
                  <span className="block text-[11px] font-normal" style={{ color: 'var(--color-text-muted)' }}>{semana(l.data)}</span>
                </span>
                <span className="flex-1 min-w-0">
                  <span className={`block text-sm truncate ${inativo ? 'line-through' : ''}`} style={{ color: inativo ? 'var(--color-text-muted)' : 'var(--color-text-primary)' }}>{l.nome}</span>
                  <span className="block text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                    {l.origem === 'nacional' ? (l.considerado ? 'Nacional' : 'Nacional · não considerado neste ano') : l.recorrente ? 'Da empresa · todo ano' : 'Da empresa'}
                  </span>
                </span>
                {l.origem === 'nacional' ? (
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={() => executar(considerarFeriadoNacionalAction(companyId, l.data, l.nome, !l.considerado))}
                    className="shrink-0 text-xs font-semibold cursor-pointer hover:underline disabled:opacity-50"
                    style={{ color: l.considerado ? 'var(--color-text-muted)' : 'var(--color-brand)' }}
                  >
                    {l.considerado ? 'Não considerar' : 'Considerar'}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={() => executar(excluirFeriadoAction(companyId, l.id))}
                    aria-label={`Excluir ${l.nome}`}
                    className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer hover:bg-red-50 disabled:opacity-50"
                    style={{ color: 'var(--color-error)' }}
                  >
                    <Icon name="trash" size={16} />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </Modal>
  )
}
