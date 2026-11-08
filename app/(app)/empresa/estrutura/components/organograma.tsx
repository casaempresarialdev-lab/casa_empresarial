'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AddButton } from '@/components/ui/add-button'
import { FilterResult, FilterSelect, SearchField } from '@/components/ui/filter-select'
import { Icon } from '@/components/ui/icon'
import { toast } from '@/lib/toast'
import { iniciais } from '../../../pessoas/funcionarios/components/ficha/ficha-config'
import { moverCargoAction } from '../actions'
import { corDepartamento, descendentesDe, type Cargo, type Departamento, type Ocupante } from '../tipos'

const ZOOM_MIN = 0.3
const ZOOM_MAX = 1.5
const COR_LINHA = 'var(--color-card-border)'

type No = Cargo & { filhos: No[] }

function montarArvore(cargos: Cargo[]): No[] {
  const nos = new Map<string, No>(cargos.map((c) => [c.id, { ...c, filhos: [] }]))
  const raizes: No[] = []
  for (const n of nos.values()) {
    const pai = n.superior_id ? nos.get(n.superior_id) : undefined
    if (pai) pai.filhos.push(n)
    else raizes.push(n)
  }
  return raizes
}

function Fotos({ pessoas }: { pessoas: Ocupante[] }) {
  const visiveis = pessoas.slice(0, 4)
  const resto = pessoas.length - visiveis.length
  return (
    <span className="flex items-center">
      {visiveis.map((p, i) => (
        <span
          key={p.id}
          title={p.nome}
          className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center text-[10px] font-bold ring-2 ring-white"
          style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)', marginLeft: i ? -8 : 0 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {p.foto ? <img src={p.foto} alt={p.nome} className="w-full h-full object-cover" draggable={false} /> : iniciais(p.nome)}
        </span>
      ))}
      {resto > 0 && <span className="text-xs font-semibold ml-1.5" style={{ color: 'var(--color-text-muted)' }}>+{resto}</span>}
    </span>
  )
}

type Contexto = {
  recolhidos: Set<string>
  arrastando: string | null
  bloqueados: Set<string>
  sobre: string | null
  destaque: (c: Cargo) => boolean
  filtrando: boolean
  alternar: (id: string) => void
  arrastar: (id: string | null) => void
  passarSobre: (id: string | null) => void
  soltar: (superiorId: string | null) => void
  editar: (c: Cargo) => void
  adicionarAbaixo: (c: Cargo) => void
}

function Cartao({ no, ctx }: { no: No; ctx: Contexto }) {
  const cor = corDepartamento(no.department_id)
  const recolhido = ctx.recolhidos.has(no.id)
  const bloqueado = ctx.arrastando !== null && ctx.bloqueados.has(no.id)
  const alvo = ctx.sobre === no.id && !bloqueado
  const apagado = (ctx.filtrando && !ctx.destaque(no)) || bloqueado
  const qtd = no.ocupantes.length

  return (
    <article
      data-no
      draggable
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', no.id); e.dataTransfer.effectAllowed = 'move'; ctx.arrastar(no.id) }}
      onDragEnd={() => { ctx.arrastar(null); ctx.passarSobre(null) }}
      onDragOver={(e) => { if (bloqueado || !ctx.arrastando) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; ctx.passarSobre(no.id) }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) ctx.passarSobre(null) }}
      onDrop={(e) => { e.preventDefault(); if (!bloqueado) ctx.soltar(no.id) }}
      onClick={() => ctx.editar(no)}
      className="relative w-60 rounded-xl border bg-white cursor-pointer select-none transition-all hover:-translate-y-0.5"
      style={{
        borderColor: alvo ? 'var(--color-brand)' : 'var(--color-card-border)',
        borderTop: `3px solid ${cor}`,
        boxShadow: alvo ? '0 0 0 3px color-mix(in srgb, var(--color-brand) 25%, transparent)' : '0 2px 8px rgba(0,0,0,0.07)',
        opacity: ctx.arrastando === no.id ? 0.4 : apagado ? 0.35 : 1,
      }}
    >
      <div className="px-3.5 pt-3 pb-2.5 flex flex-col gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold truncate" style={{ color: cor }}>{no.departamento}</p>
          <p className="text-sm font-bold leading-snug line-clamp-2" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>{no.nome}</p>
        </div>
        <div className="flex items-center justify-between gap-2 min-h-7">
          {qtd > 0
            ? <Fotos pessoas={no.ocupantes} />
            : <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border border-dashed" style={{ borderColor: '#D97706', color: '#B45309' }}>Vago</span>}
          <button
            type="button"
            title="Adicionar cargo abaixo"
            aria-label={`Adicionar cargo abaixo de ${no.nome}`}
            onClick={(e) => { e.stopPropagation(); ctx.adicionarAbaixo(no) }}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--color-brand-light)] cursor-pointer"
            style={{ color: 'var(--color-brand)' }}
          >
            <Icon name="plus" size={15} />
          </button>
        </div>
      </div>
      {no.filhos.length > 0 && (
        <button
          type="button"
          aria-expanded={!recolhido}
          aria-label={`${recolhido ? 'Mostrar' : 'Recolher'} os cargos abaixo de ${no.nome}`}
          onClick={(e) => { e.stopPropagation(); ctx.alternar(no.id) }}
          className="absolute -bottom-3 left-1/2 -translate-x-1/2 h-6 min-w-6 px-1.5 rounded-full border bg-white text-[11px] font-bold flex items-center justify-center z-10 cursor-pointer"
          style={{ borderColor: COR_LINHA, color: 'var(--color-text-muted)' }}
        >
          {recolhido ? `+${no.filhos.length}` : '−'}
        </button>
      )}
    </article>
  )
}

// Cada ramo desenha as próprias ligações: uma linha sobe até a barra horizontal dos irmãos
function Ramo({ no, ctx, raiz, primeiro, ultimo }: { no: No; ctx: Contexto; raiz?: boolean; primeiro?: boolean; ultimo?: boolean }) {
  const aberto = no.filhos.length > 0 && !ctx.recolhidos.has(no.id)
  return (
    <div className={`relative flex flex-col items-center px-3 ${raiz ? '' : 'pt-7'}`}>
      {!raiz && (
        <>
          <span aria-hidden className="absolute top-0 left-1/2 w-px h-7" style={{ backgroundColor: COR_LINHA }} />
          {!primeiro && <span aria-hidden className="absolute top-0 left-0 right-1/2 h-px" style={{ backgroundColor: COR_LINHA }} />}
          {!ultimo && <span aria-hidden className="absolute top-0 left-1/2 right-0 h-px" style={{ backgroundColor: COR_LINHA }} />}
        </>
      )}
      <Cartao no={no} ctx={ctx} />
      {aberto && (
        <>
          <span aria-hidden className="w-px h-7" style={{ backgroundColor: COR_LINHA }} />
          <div className="flex items-start">
            {no.filhos.map((f, i) => <Ramo key={f.id} no={f} ctx={ctx} primeiro={i === 0} ultimo={i === no.filhos.length - 1} />)}
          </div>
        </>
      )}
    </div>
  )
}

export function Organograma({ companyId, departamentos, cargos, onEditar, onNovo, visivel }: {
  companyId: string
  departamentos: Departamento[]
  cargos: Cargo[]
  onEditar: (c: Cargo) => void
  onNovo: (superior: Cargo | null) => void
  visivel: boolean
}) {
  const router = useRouter()
  const viewportRef = useRef<HTMLDivElement>(null)
  const conteudoRef = useRef<HTMLDivElement>(null)
  const panRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  const [zoom, setZoom] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [recolhidos, setRecolhidos] = useState<Set<string>>(new Set())
  const [arrastando, setArrastando] = useState<string | null>(null)
  const [sobre, setSobre] = useState<string | null>(null)
  // Movimento já mostrado na tela enquanto o servidor confirma
  const [movidos, setMovidos] = useState<Record<string, string | null>>({})
  const [departamentoFiltro, setDepartamentoFiltro] = useState('todos')
  const [busca, setBusca] = useState('')

  const atuais = useMemo(() => cargos.map((c) => (c.id in movidos ? { ...c, superior_id: movidos[c.id] } : c)), [cargos, movidos])
  const raizes = useMemo(() => montarArvore(atuais), [atuais])
  const arrastado = atuais.find((c) => c.id === arrastando)
  const bloqueados = useMemo(() => {
    if (!arrastando) return new Set<string>()
    const s = descendentesDe(atuais, arrastando)
    s.add(arrastando)
    return s
  }, [atuais, arrastando])

  const q = busca.trim().toLowerCase()
  const filtrando = departamentoFiltro !== 'todos' || !!q
  const destaque = (c: Cargo) =>
    (departamentoFiltro === 'todos' || c.department_id === departamentoFiltro) &&
    (!q || c.nome.toLowerCase().includes(q) || c.ocupantes.some((p) => p.nome.toLowerCase().includes(q)))

  const ajustar = useCallback(() => {
    const v = viewportRef.current
    const c = conteudoRef.current
    if (!v || !c || !c.offsetWidth) return
    const margem = 32
    const z = Math.max(ZOOM_MIN, Math.min(1, (v.clientWidth - margem * 2) / c.offsetWidth, (v.clientHeight - margem * 2) / c.offsetHeight))
    setZoom(z)
    setPos({ x: (v.clientWidth - c.offsetWidth * z) / 2, y: margem })
  }, [])

  // Enquadra ao abrir a aba e quando a quantidade de cargos muda
  useEffect(() => { if (visivel) ajustar() }, [visivel, cargos.length, ajustar])

  /** Zoom mantendo fixo o ponto indicado da área visível */
  const aplicarZoom = useCallback((fator: number, px?: number, py?: number) => {
    const v = viewportRef.current
    if (!v) return
    const x = px ?? v.clientWidth / 2
    const y = py ?? v.clientHeight / 2
    setZoom((z) => {
      const novo = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z * fator))
      setPos((p) => ({ x: x - ((x - p.x) * novo) / z, y: y - ((y - p.y) * novo) / z }))
      return novo
    })
  }, [])

  // Ctrl + roda do mouse dá zoom; a roda sozinha continua rolando a página
  useEffect(() => {
    const v = viewportRef.current
    if (!v) return
    function roda(e: WheelEvent) {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const r = v!.getBoundingClientRect()
      aplicarZoom(e.deltaY < 0 ? 1.1 : 0.9, e.clientX - r.left, e.clientY - r.top)
    }
    v.addEventListener('wheel', roda, { passive: false })
    return () => v.removeEventListener('wheel', roda)
  }, [aplicarZoom])

  function iniciarPan(e: React.PointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest('[data-no]')) return
    panRef.current = { x: e.clientX, y: e.clientY, ox: pos.x, oy: pos.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function moverPan(e: React.PointerEvent<HTMLDivElement>) {
    const p = panRef.current
    if (p) setPos({ x: p.ox + e.clientX - p.x, y: p.oy + e.clientY - p.y })
  }

  async function soltar(superiorId: string | null) {
    const id = arrastando
    setArrastando(null)
    setSobre(null)
    if (!id) return
    const atual = atuais.find((c) => c.id === id)
    if (!atual || atual.superior_id === superiorId) return
    setMovidos((m) => ({ ...m, [id]: superiorId }))
    if (superiorId) setRecolhidos((s) => { const n = new Set(s); n.delete(superiorId); return n })
    const r = await moverCargoAction(companyId, id, superiorId)
    if ('error' in r) toast.error(r.error ?? 'Não foi possível mover o cargo.')
    else {
      const novo = atuais.find((c) => c.id === superiorId)
      toast(novo ? `${atual.nome} agora responde a ${novo.nome}.` : `${atual.nome} foi para o topo da hierarquia.`)
    }
    router.refresh()
    setMovidos((m) => { const n = { ...m }; delete n[id]; return n })
  }

  const ctx: Contexto = {
    recolhidos,
    arrastando,
    bloqueados,
    sobre,
    destaque,
    filtrando,
    alternar: (id) => setRecolhidos((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n }),
    arrastar: setArrastando,
    passarSobre: setSobre,
    soltar,
    editar: onEditar,
    adicionarAbaixo: (c) => onNovo(c),
  }

  const botaoZoom = 'w-9 h-9 flex items-center justify-center text-base font-semibold transition-colors hover:bg-gray-50 cursor-pointer'

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm" style={{ color: 'var(--color-sidebar-text)' }}>
          <span className="font-semibold">{cargos.length} {cargos.length === 1 ? 'cargo' : 'cargos'}</span>
          <span style={{ color: 'var(--color-text-muted)' }}> · arraste um cargo sobre outro para mudar a quem ele responde</span>
        </p>
        <AddButton onClick={() => onNovo(null)} label="Novo cargo" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect
          value={departamentoFiltro}
          onChange={setDepartamentoFiltro}
          label="Filtrar por departamento"
          options={[{ value: 'todos', label: 'Todos os departamentos' }, ...departamentos.map((d) => ({ value: d.id, label: d.nome }))]}
        />
        <SearchField value={busca} onChange={setBusca} placeholder="Pesquisar cargo ou pessoa..." />
        {filtrando && <FilterResult total={atuais.filter(destaque).length} onClear={() => { setDepartamentoFiltro('todos'); setBusca('') }} />}
      </div>

      <div
        ref={viewportRef}
        onPointerDown={iniciarPan}
        onPointerMove={moverPan}
        onPointerUp={() => { panRef.current = null }}
        onPointerCancel={() => { panRef.current = null }}
        className="relative overflow-hidden rounded-xl h-[calc(100dvh-20rem)] min-h-[440px] cursor-grab active:cursor-grabbing touch-none"
        style={{
          backgroundColor: '#FAFAFA',
          backgroundImage: 'radial-gradient(circle, color-mix(in srgb, var(--color-brand) 22%, transparent) 1px, transparent 1px)',
          backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
          backgroundPosition: `${pos.x}px ${pos.y}px`,
        }}
      >
        <div ref={conteudoRef} className="absolute top-0 left-0 w-max flex items-start origin-top-left" style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${zoom})` }}>
          {raizes.map((r) => <Ramo key={r.id} no={r} ctx={ctx} raiz />)}
        </div>

        {cargos.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6">
            <span className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}><Icon name="users" size={26} /></span>
            <p className="text-sm max-w-xs" style={{ color: 'var(--color-text-muted)' }}>Comece pelo cargo mais alto da empresa e vá adicionando os cargos abaixo dele.</p>
          </div>
        )}

        {/* Soltar aqui: o cargo deixa de responder a alguém */}
        {arrastado?.superior_id && (
          <div
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setSobre('topo') }}
            onDragLeave={() => setSobre(null)}
            onDrop={(e) => { e.preventDefault(); void soltar(null) }}
            className="absolute top-3 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-xl border-2 border-dashed text-sm font-semibold z-20"
            style={{ borderColor: 'var(--color-brand)', color: 'var(--color-brand)', backgroundColor: sobre === 'topo' ? 'var(--color-brand-light)' : '#fff' }}
          >
            Solte aqui para ir ao topo da hierarquia
          </div>
        )}

        {/* Zoom */}
        <div className="absolute bottom-3 right-3 flex rounded-xl border bg-white overflow-hidden z-20" style={{ borderColor: 'var(--color-card-border)', color: 'var(--color-sidebar-text)' }} onPointerDown={(e) => e.stopPropagation()}>
          <button type="button" className={botaoZoom} aria-label="Diminuir zoom" onClick={() => aplicarZoom(0.85)}>−</button>
          <span className="h-9 w-12 flex items-center justify-center text-xs font-semibold border-x" style={{ borderColor: 'var(--color-card-border)' }}>{Math.round(zoom * 100)}%</span>
          <button type="button" className={botaoZoom} aria-label="Aumentar zoom" onClick={() => aplicarZoom(1.15)}>+</button>
          <button type="button" className={`${botaoZoom} border-l`} style={{ borderColor: 'var(--color-card-border)' }} aria-label="Ajustar à tela" title="Ajustar à tela" onClick={ajustar}><Icon name="maximize" size={15} /></button>
        </div>
      </div>
    </div>
  )
}
