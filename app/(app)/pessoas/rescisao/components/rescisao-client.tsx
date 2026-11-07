'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { AddButton } from '@/components/ui/add-button'
import { FilterResult, SearchField } from '@/components/ui/filter-select'
import { toast } from '@/lib/toast'
import { fmtDataHora } from '@/lib/validations/admissao'
import { iniciais, isPjOuAutonomo, tipoLabel } from '../../funcionarios/components/ficha/ficha-config'
import { moverEtapaRescisaoAction } from '../actions'
import {
  R_AGUARDAR_CONTABILIDADE, R_AVISO, R_CONTABILIDADE, R_EXAME, R_FINAL, R_RETORNO_EXAME, R_TRCT,
  indiceEtapa, tipoDesligamentoLabel, type Etapa,
} from '../etapas'
import { IniciarRescisao } from './iniciar-rescisao'
import type { Rescisao } from '../queries'
import type { Exame } from '../../admissao/queries'

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`
const fmtData = (d: string) => d.split('-').reverse().join('/')

const SELO = {
  pendente: { backgroundColor: '#FEF3C7', color: '#B45309' },
  info: { backgroundColor: '#DBEAFE', color: '#1D4ED8' },
  neutro: { backgroundColor: '#F3F4F6', color: '#4B5563' },
}

function Selo({ tom, children }: { tom: keyof typeof SELO; children: React.ReactNode }) {
  return <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-md" style={SELO[tom]}>{children}</span>
}

interface Props {
  rescisoes: Rescisao[]
  etapas: Etapa[]
  exames: Record<string, Exame[]>
  fotos: Record<string, string>
  funcionarios: { id: string; nome: string }[]
  companyId: string
}

// Kanban da rescisão: arrastar para trás muda a etapa; para frente, abre a ficha para registrar a ação
export function RescisaoClient({ rescisoes, etapas, exames, fotos, funcionarios, companyId }: Props) {
  const router = useRouter()
  const [movidos, setMovidos] = useState<Record<string, string>>({})
  const [arrastando, setArrastando] = useState<string | null>(null)
  const [sobre, setSobre] = useState<string | null>(null)
  const [movendo, setMovendo] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [iniciando, setIniciando] = useState(false)
  const [agora] = useState(() => Date.now())

  const etapaDe = (r: Rescisao) => movidos[r.id] ?? (indiceEtapa(etapas, r.etapa) >= 0 ? r.etapa : etapas[0].key)
  // Colunas: as etapas ativas; uma inativa só aparece enquanto ainda tiver alguém nela
  const colunas = etapas.filter((x) => x.ativo || rescisoes.some((r) => etapaDe(r) === x.key))

  const q = busca.toLowerCase()
  const visiveis = rescisoes.filter((r) => !q || r.employee.nome.toLowerCase().includes(q) || (r.employee.cargo ?? '').toLowerCase().includes(q))

  async function mover(r: Rescisao, etapa: string) {
    if (etapaDe(r) === etapa) return
    if (!etapas.find((x) => x.key === etapa)?.ativo) { toast.error('Esta etapa está inativa nas configurações.'); return }
    // Para frente, cada etapa avança pela ação dela: abre a ficha para registrar
    if (indiceEtapa(etapas, etapa) > indiceEtapa(etapas, etapaDe(r))) { router.push(`/pessoas/rescisao/${r.id}`); return }
    setMovendo(r.id)
    setMovidos((m) => ({ ...m, [r.id]: etapa }))
    const res = await moverEtapaRescisaoAction(companyId, r.id, etapa)
    setMovendo(null)
    setMovidos((m) => { const n = { ...m }; delete n[r.id]; return n })
    if ('error' in res) toast.error(res.error ?? 'Não foi possível mover.')
  }

  function selos(r: Rescisao, etapa: string) {
    const exame = exames[r.id]?.find((x) => x.status === 'encaminhado')
    switch (etapa) {
      case R_AVISO: return <Selo tom="pendente">Aviso ainda não registrado</Selo>
      case R_EXAME: return <Selo tom="pendente">Exame ainda não encaminhado</Selo>
      case R_RETORNO_EXAME:
        return exame?.data_hora && Date.parse(exame.data_hora) > agora
          ? <Selo tom="info">Exame marcado para {fmtDataHora(exame.data_hora)}</Selo>
          : <Selo tom="pendente">Aguardando retorno do exame</Selo>
      case R_CONTABILIDADE: return <Selo tom="pendente">Dados ainda não enviados</Selo>
      case R_AGUARDAR_CONTABILIDADE: return r.contabilidade_enviada_em && <Selo tom="info">Enviados em {fmtDataHora(r.contabilidade_enviada_em).split(' às ')[0]}</Selo>
      case R_TRCT: return <Selo tom="pendente">Aguardando TRCT assinado</Selo>
      default: return etapas.find((x) => x.key === etapa)?.padrao === false && <Selo tom="neutro">Controle interno</Selo>
    }
  }

  return (
    <>
      <div className="flex flex-col min-h-[calc(100dvh-5.5rem)] md:min-h-[calc(100dvh-3rem)]">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>Rescisão</h1>
          <Breadcrumb />
        </div>

        <div className="app-card p-5 flex flex-col gap-4 flex-1">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
                {rescisoes.length === 0 ? 'Nenhuma rescisão em andamento' : plural(rescisoes.length, 'rescisão em andamento', 'rescisões em andamento')}
              </h2>
              <AddButton onClick={() => setIniciando(true)} label="Nova rescisão" />
            </div>
            <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              Inicie aqui ou pela ficha do funcionário, em Equipe. A pessoa sai da Equipe ao finalizar.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <SearchField value={busca} onChange={setBusca} placeholder="Pesquisar por nome ou cargo..." />
            {busca && <FilterResult total={visiveis.length} onClear={() => setBusca('')} />}
          </div>

          <div className="overflow-x-auto pb-2 -mx-1 px-1 flex-1 flex flex-col">
            <div className="flex gap-3 flex-1" style={{ minWidth: `${colunas.length * 252}px` }}>
              {colunas.map((etapa) => {
                const cards = visiveis.filter((r) => etapaDe(r) === etapa.key)
                const destacar = sobre === etapa.key
                const final = etapa.key === R_FINAL
                return (
                  <section
                    key={etapa.key}
                    aria-label={etapa.label}
                    className="flex flex-col rounded-xl flex-1 min-w-[240px]"
                    style={{
                      backgroundColor: `color-mix(in srgb, var(--color-brand) ${destacar ? 20 : 10}%, transparent)`,
                      border: `2px solid ${destacar ? 'var(--color-brand)' : 'transparent'}`,
                      transition: 'background-color 0.15s, border-color 0.15s',
                    }}
                    onDragOver={(ev) => { ev.preventDefault(); ev.dataTransfer.dropEffect = 'move'; setSobre(etapa.key) }}
                    onDragLeave={(ev) => { if (!ev.currentTarget.contains(ev.relatedTarget as Node)) setSobre(null) }}
                    onDrop={(ev) => {
                      ev.preventDefault()
                      setSobre(null)
                      setArrastando(null)
                      const alvo = rescisoes.find((x) => x.id === ev.dataTransfer.getData('rescisaoId'))
                      if (alvo) mover(alvo, etapa.key)
                    }}
                  >
                    <header className="flex items-center gap-2 px-3 pt-3 pb-2">
                      <h3 className="text-xs font-bold flex-1" style={{ color: 'var(--color-brand)' }}>
                        {etapa.label}
                        {!etapa.ativo && <span className="ml-1.5 font-semibold" style={{ color: 'var(--color-text-muted)' }}>· inativa</span>}
                      </h3>
                      {!final && (
                        <span className="text-xs rounded-full px-1.5 py-0.5 font-semibold shrink-0" style={{ backgroundColor: 'color-mix(in srgb, var(--color-brand) 15%, transparent)', color: 'var(--color-brand)' }}>
                          {cards.length}
                        </span>
                      )}
                    </header>

                    <div className="flex flex-col gap-2 px-2 pb-3 flex-1 min-h-[96px]">
                      {final && (
                        <p className="text-xs text-center px-2 py-6 rounded-lg border-2 border-dashed" style={{ borderColor: destacar ? 'var(--color-brand)' : 'color-mix(in srgb, var(--color-brand) 35%, transparent)', color: 'var(--color-text-muted)' }}>
                          A rescisão termina ao concluir a última etapa na ficha. A pessoa sai da Equipe.
                        </p>
                      )}
                      {cards.map((r) => (
                        <article
                          key={r.id}
                          draggable
                          onDragStart={(ev) => { ev.dataTransfer.setData('rescisaoId', r.id); ev.dataTransfer.effectAllowed = 'move'; setArrastando(r.id) }}
                          onDragEnd={() => { setArrastando(null); setSobre(null) }}
                          onClick={() => router.push(`/pessoas/rescisao/${r.id}`)}
                          className="rounded-lg border bg-white cursor-pointer select-none min-h-24"
                          style={{ borderColor: 'var(--color-card-border)', opacity: arrastando === r.id ? 0.35 : movendo === r.id ? 0.65 : 1, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
                        >
                          <div className="p-3 flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                              <p className="text-xs truncate flex-1 min-w-0" style={{ color: 'var(--color-text-muted)' }}>{tipoDesligamentoLabel(r.tipo)}</p>
                              <span className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center shrink-0 text-xs font-bold" style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                {fotos[r.id] ? <img src={fotos[r.id]} alt={r.employee.nome} className="w-full h-full object-cover" /> : iniciais(r.employee.nome)}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>{r.employee.nome}</p>
                              <p className="text-[11px] truncate" style={{ color: 'var(--color-text-muted)' }}>{r.employee.cargo || r.employee.servico || '—'}</p>
                              <div className="flex flex-wrap gap-1 mt-3 empty:hidden">
                                {isPjOuAutonomo(r.employee.tipo_contrato) && <Selo tom="neutro">{tipoLabel(r.employee.tipo_contrato)}</Selo>}
                                {r.ultimo_dia && <Selo tom="neutro">Último dia {fmtData(r.ultimo_dia)}</Selo>}
                                {selos(r, etapa.key)}
                              </div>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <IniciarRescisao open={iniciando} onClose={() => setIniciando(false)} companyId={companyId} funcionarios={funcionarios} />
    </>
  )
}
