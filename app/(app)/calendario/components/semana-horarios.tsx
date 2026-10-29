'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { Evento } from '../queries'
import { estiloEvento } from './avatar'

const SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const HORAS = Array.from({ length: 24 }, (_, h) => h)
const ALTURA_HORA = 48 // px por hora na grade
const MIN_NA_GRADE = 30 // eventos curtos ocupam ao menos 30 min na grade (para caber o título)
const HORA_INICIAL_ROLAGEM = 7 // sem "hoje" na semana, a grade abre às 7h

const pad = (n: number) => String(n).padStart(2, '0')
const chaveDia = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const horaFormat = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })
const minutosDoDia = (d: Date) => d.getHours() * 60 + d.getMinutes()

type Posicionado = { e: Evento; ini: number; fim: number; coluna: number; colunas: number }

// Eventos que se sobrepõem no mesmo horário ficam lado a lado (cada grupo divide a largura do dia)
function posicionar(lista: Evento[]): Posicionado[] {
  const ordenados = [...lista].sort((a, b) => a.data_hora.localeCompare(b.data_hora))
  const res: Posicionado[] = []
  let grupo: Posicionado[] = []
  let fimColunas: number[] = []
  let fimGrupo = -1
  const fecharGrupo = () => { for (const p of grupo) p.colunas = fimColunas.length; res.push(...grupo) }

  for (const e of ordenados) {
    const ini = minutosDoDia(new Date(e.data_hora))
    // Na grade, termina no fim do dia (eventos que passam da meia-noite não continuam no dia seguinte)
    const fim = Math.min(24 * 60, ini + Math.max(MIN_NA_GRADE, e.duracao_min))
    if (ini >= fimGrupo) { fecharGrupo(); grupo = []; fimColunas = [] }
    let coluna = fimColunas.findIndex((f) => f <= ini)
    if (coluna < 0) { coluna = fimColunas.length; fimColunas.push(fim) } else fimColunas[coluna] = fim
    grupo.push({ e, ini, fim, coluna, colunas: 1 })
    fimGrupo = Math.max(fimGrupo, fim)
  }
  fecharGrupo()
  return res
}

interface Props {
  dias: Date[]
  porDia: Map<string, Evento[]>
  selecionado: Date
  ehAtrasado: (e: Evento) => boolean
  onSelecionarDia: (d: Date) => void
  /** Duplo clique num horário: novo evento naquele dia e hora */
  onNovo: (d: Date, hora: number) => void
  onAbrir: (e: Evento) => void
}

// Visão semanal com horários: coluna das horas à esquerda e os eventos posicionados no horário e na duração de cada um
export function SemanaHorarios({ dias, porDia, selecionado, ehAtrasado, onSelecionarDia, onNovo, onAbrir }: Props) {
  const rolagemRef = useRef<HTMLDivElement>(null)
  const [agora, setAgora] = useState(() => new Date())
  const chaveHoje = chaveDia(agora)
  const hojeNaSemana = dias.some((d) => chaveDia(d) === chaveHoje)
  const inicioSemana = chaveDia(dias[0])

  // Linha da hora atual: atualiza a cada minuto
  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  // Ao abrir ou trocar de semana: rola até um pouco antes da hora atual (ou 7h)
  useEffect(() => {
    const el = rolagemRef.current
    if (!el) return
    const hora = hojeNaSemana ? Math.max(0, new Date().getHours() - 1) : HORA_INICIAL_ROLAGEM
    el.scrollTop = hora * ALTURA_HORA
  }, [inicioSemana, hojeNaSemana])

  const colunas = 'grid grid-cols-[52px_repeat(7,minmax(0,1fr))]'

  return (
    // No celular a grade rola na horizontal (7 colunas não cabem)
    <div className="overflow-x-auto -mx-1 px-1">
      <div className="min-w-[640px] rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-bg-surface)' }}>
        {/* Cabeçalho: dia da semana e número */}
        <div className={cn(colunas, 'border-b')} style={{ borderColor: 'var(--color-bg-surface)' }}>
          <div />
          {dias.map((d) => {
            const k = chaveDia(d)
            const ehHoje = k === chaveHoje
            const ehSelecionado = k === chaveDia(selecionado)
            return (
              <button
                key={k}
                type="button"
                onClick={() => onSelecionarDia(d)}
                className="py-2 flex flex-col items-center gap-0.5 cursor-pointer transition-colors hover:bg-gray-50"
                style={ehSelecionado ? { backgroundColor: 'var(--color-brand-light)' } : undefined}
              >
                <span className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>{SEMANA[d.getDay()]}</span>
                <span
                  className={cn('w-8 h-8 rounded-full flex items-center justify-center text-sm', ehHoje ? 'font-bold' : 'font-semibold')}
                  style={ehHoje ? { backgroundColor: 'var(--color-brand)', color: '#fff' } : { color: 'var(--color-text-primary)' }}
                >
                  {d.getDate()}
                </span>
              </button>
            )
          })}
        </div>

        {/* Grade das horas (rolagem vertical) */}
        <div ref={rolagemRef} className="max-h-[560px] overflow-y-auto">
          <div className={colunas} style={{ height: 24 * ALTURA_HORA }}>
            {/* Horas */}
            <div className="relative">
              {HORAS.map((h) => (
                <span
                  key={h}
                  className="absolute right-2 text-[11px] -translate-y-1/2"
                  style={{ top: h * ALTURA_HORA, color: 'var(--color-text-muted)' }}
                >
                  {h > 0 && `${pad(h)}:00`}
                </span>
              ))}
            </div>

            {dias.map((d) => {
              const k = chaveDia(d)
              const ehHoje = k === chaveHoje
              const ehSelecionado = k === chaveDia(selecionado)
              return (
                <div
                  key={k}
                  className="relative border-l"
                  style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: ehSelecionado ? 'color-mix(in srgb, var(--color-brand-light) 35%, transparent)' : undefined }}
                >
                  {/* Faixas de 1h: clique seleciona o dia, duplo clique cria o evento naquela hora */}
                  {HORAS.map((h) => (
                    <div
                      key={h}
                      onClick={() => onSelecionarDia(d)}
                      onDoubleClick={() => onNovo(d, h)}
                      title={`${pad(h)}:00 · duplo clique para criar`}
                      className="border-t cursor-pointer hover:bg-gray-50/80"
                      style={{ height: ALTURA_HORA, borderColor: 'var(--color-bg-surface)' }}
                    />
                  ))}

                  {/* Eventos no horário */}
                  {posicionar(porDia.get(k) ?? []).map(({ e, ini, fim, coluna, colunas: total }) => {
                    const { style, apagado } = estiloEvento(e, ehAtrasado(e))
                    const altura = Math.max(22, ((fim - ini) / 60) * ALTURA_HORA - 2)
                    const termino = new Date(new Date(e.data_hora).getTime() + e.duracao_min * 60_000)
                    return (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => onAbrir(e)}
                        onDoubleClick={(ev) => ev.stopPropagation()}
                        title={`${horaFormat.format(new Date(e.data_hora))}–${horaFormat.format(termino)} · ${e.titulo}${e.dono ? ` · ${e.dono.nome}` : ''}`}
                        className={cn(
                          'absolute rounded-md px-1.5 py-1 text-left text-[11px] leading-tight font-medium overflow-hidden cursor-pointer hover:brightness-95 border-l-[3px]',
                          apagado && 'opacity-50',
                        )}
                        style={{
                          top: (ini / 60) * ALTURA_HORA + 1,
                          height: altura,
                          left: `calc(${(coluna / total) * 100}% + 2px)`,
                          width: `calc(${100 / total}% - 4px)`,
                          ...style,
                        }}
                      >
                        <span className="block font-semibold opacity-80 truncate">{horaFormat.format(new Date(e.data_hora))}{altura >= 40 && ` – ${horaFormat.format(termino)}`}</span>
                        <span className={cn('block truncate', apagado && 'line-through')}>{e.titulo}</span>
                      </button>
                    )
                  })}

                  {/* Hora atual */}
                  {ehHoje && (
                    <div className="absolute left-0 right-0 pointer-events-none z-10" style={{ top: (minutosDoDia(agora) / 60) * ALTURA_HORA }}>
                      <span className="absolute -left-1 -top-[5px] w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#DC2626' }} />
                      <div className="h-0.5" style={{ backgroundColor: '#DC2626' }} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
