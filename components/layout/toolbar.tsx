'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon, type IconName } from '@/components/ui/icon'
import { resumoLembretesAction, concluirLembreteAction, marcarAvisosVistosAction, type ResumoNotificacoes } from '@/app/(app)/lembretes/actions'
import type { Lembrete } from '@/app/(app)/lembretes/queries'
import type { AvisoCompartilhamento } from '@/app/(app)/cofre-de-senhas/queries'

export const LINK_LEMBRETES = '/lembretes'
export const LINK_COMPARTILHADAS = '/cofre-de-senhas?aba=compartilhadas'

// Barra de ferramentas da área logada (cor primária), no canto superior direito, encostada na borda da tela.
// Esquerda: Lembretes (leva à página) e Calendário. Direita: notificações (avisos de lembretes) e tela cheia.

type Painel = 'notificacoes' | null

function ToolButton({ icon, label, onClick, href, active, comTexto, badge, balancar }: {
  icon: IconName; label: string; onClick?: () => void; href?: string; active?: boolean; comTexto?: boolean; badge?: number; balancar?: boolean
}) {
  const className = `relative h-10 rounded-full flex items-center justify-center gap-2 transition-colors hover:bg-white/20 cursor-pointer ${comTexto ? 'px-3.5' : 'w-10'}`
  const style = { color: '#fff', backgroundColor: active ? 'rgba(255,255,255,0.2)' : undefined }
  const conteudo = (
    <>
      <span className={balancar ? 'bell-ring' : undefined}><Icon name={icon} size={21} /></span>
      {comTexto && <span className="hidden sm:inline text-sm font-semibold">{label}</span>}
      {!!badge && (
        <span className="absolute top-0.5 right-0.5 min-w-4 h-4 px-1 rounded-full text-[10px] font-bold leading-4 text-center" style={{ backgroundColor: '#fff', color: 'var(--color-brand)' }}>
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </>
  )
  if (href) return <Link href={href} aria-label={label} title={label} className={className} style={style}>{conteudo}</Link>
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={className}
      style={style}
    >
      {conteudo}
    </button>
  )
}

// Painel suspenso abaixo da barra
function PainelSuspenso({ titulo, alinhar, children }: { titulo: string; alinhar: 'left' | 'right'; children: React.ReactNode }) {
  return (
    <div
      className={`absolute top-full mt-2 w-72 rounded-xl border shadow-lg z-50 p-4 ${alinhar === 'right' ? 'right-0' : 'left-0'}`}
      style={{ backgroundColor: '#fff', borderColor: 'var(--color-bg-surface)' }}
    >
      <p className="text-sm font-semibold mb-2" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>{titulo}</p>
      {children}
    </div>
  )
}

function Vazio({ icon, texto }: { icon: IconName; texto: string }) {
  return (
    <div className="flex flex-col items-center text-center gap-2 py-6">
      <span className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}>
        <Icon name={icon} size={18} />
      </span>
      <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{texto}</p>
    </div>
  )
}

const quandoFormat = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
const quando = (iso: string) => { const t = quandoFormat.format(new Date(iso)); return t.charAt(0).toUpperCase() + t.slice(1) }

const AVISADOS_KEY = 'lembretes_avisados'
const CONSULTA_MS = 60_000

// Separa os avisos que ainda não foram mostrados (uma vez por lembrete; só os das últimas 24h)
// e dispara também a notificação do navegador, se permitida
function avisosNovos(avisos: Lembrete[]): Lembrete[] {
  let vistos: string[] = []
  try { vistos = JSON.parse(localStorage.getItem(AVISADOS_KEY) ?? '[]') } catch {}
  const limite = Date.now() - 24 * 60 * 60 * 1000
  const novos: Lembrete[] = []
  for (const l of avisos) {
    if (vistos.includes(l.id)) continue
    vistos.push(l.id)
    const aviso = new Date(l.data_hora).getTime() - l.antecedencia_min * 60_000
    if (aviso < limite) continue
    novos.push(l)
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try { new Notification('Lembrete: ' + l.titulo, { body: quando(l.data_hora), tag: 'lembrete-' + l.id }) } catch {}
    }
  }
  try { localStorage.setItem(AVISADOS_KEY, JSON.stringify(vistos.slice(-200))) } catch {}
  return novos
}

// Cartão de aviso no canto da tela (fica até fechar): Concluir ou Ver
function CartaoAviso({ l, onFechar, onConcluir }: { l: Lembrete; onFechar: () => void; onConcluir: () => void }) {
  return (
    <div role="alert" className="animate-enter w-80 max-w-[calc(100vw-2rem)] rounded-2xl border shadow-xl p-4 flex gap-3" style={{ backgroundColor: '#fff', borderColor: 'var(--color-brand)' }}>
      <span className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bell-ring" style={{ backgroundColor: 'var(--color-brand)', color: '#fff' }}>
        <Icon name="bell" size={18} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-brand)' }}>Lembrete</p>
          <button type="button" onClick={onFechar} aria-label="Fechar aviso" className="-mt-1 -mr-1 w-6 h-6 rounded-full flex items-center justify-center hover:bg-gray-100 cursor-pointer text-lg leading-none" style={{ color: 'var(--color-text-muted)' }}>×</button>
        </div>
        <p className="text-sm font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>{l.titulo}</p>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{quando(l.data_hora)}</p>
        <div className="flex gap-2 mt-3">
          <button type="button" onClick={onConcluir} className="h-8 px-3 rounded-lg text-xs font-semibold text-white cursor-pointer" style={{ backgroundColor: 'var(--color-brand)' }}>Concluir</button>
          <Link href="/lembretes" onClick={onFechar} className="h-8 px-3 rounded-lg text-xs font-semibold border flex items-center" style={{ borderColor: 'var(--color-brand)', color: 'var(--color-brand)' }}>Ver</Link>
        </div>
      </div>
    </div>
  )
}

// Cada notificação é um link: lembrete → página de lembretes; compartilhamento → cofre (Compartilhadas comigo)
function LinhaNotificacao({ icon, titulo, detalhe, href, onNavegar, novo, acao }: {
  icon: IconName; titulo: string; detalhe: string; href: string; onNavegar: () => void; novo?: boolean; acao?: React.ReactNode
}) {
  return (
    <li className="flex items-start gap-1 rounded-lg hover:bg-gray-50 transition-colors">
      <Link href={href} onClick={onNavegar} className="flex-1 min-w-0 flex items-start gap-2 py-1.5 px-1.5">
        <span className="mt-0.5" style={{ color: 'var(--color-brand)' }}><Icon name={icon} size={16} /></span>
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-1.5">
            <span className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{titulo}</span>
            {novo && <span className="shrink-0 w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--color-brand)' }} aria-label="Nova" />}
          </span>
          <span className="block text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>{detalhe}</span>
        </span>
      </Link>
      {acao}
    </li>
  )
}

type ItemNotificacao = { tipo: 'lembrete'; data: number; l: Lembrete } | { tipo: 'compartilhamento'; data: number; c: AvisoCompartilhamento }

// Lembretes e compartilhamentos numa lista só, mais recentes primeiro
function juntarNotificacoes(avisos: Lembrete[], compartilhamentos: AvisoCompartilhamento[]): ItemNotificacao[] {
  return [
    ...avisos.map((l) => ({ tipo: 'lembrete' as const, data: new Date(l.data_hora).getTime() - l.antecedencia_min * 60_000, l })),
    ...compartilhamentos.map((c) => ({ tipo: 'compartilhamento' as const, data: new Date(c.created_at).getTime(), c })),
  ].sort((a, b) => b.data - a.data)
}

// Entrada da barra: bolinha girando no canto direito → cresce da direita para a esquerda (como uma barra de progresso)
// → os itens aparecem em sequência. Só no carregamento do site: a barra fica no layout e não remonta ao trocar de tela.
type Fase = 'carregando' | 'abrindo' | 'pronto'
const ABRIR_MS = 650
const EASE = 'cubic-bezier(0.65, 0, 0.35, 1)'
const MIN_CARREGANDO_MS = 3000 // tempo mínimo da bolinha girando antes de a barra expandir
// Recortes da barra: bolinha de 48px a 8px da borda direita → barra inteira, arredondada só à esquerda
const CLIP_BOLINHA = 'inset(0 8px 0 calc(100% - 56px) round 24px)'
const CLIP_BARRA = 'inset(0 0 0 0 round 24px 0 0 24px)'

export function Toolbar() {
  const [fullscreen, setFullscreen] = useState(false)
  const [painel, setPainel] = useState<Painel>(null)
  const [fase, setFase] = useState<Fase>('carregando')
  const barRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const [resumo, setResumo] = useState<ResumoNotificacoes>({ proximos: [], avisos: [], compartilhamentos: [], naoVistos: 0, proximoAvisoEm: null })
  // Avisos que acabaram de chegar: cartão no canto da tela até a pessoa fechar
  const [cartoes, setCartoes] = useState<Lembrete[]>([])

  // Lembretes: consulta ao abrir, a cada minuto e ao trocar de tela; avisos novos viram cartão + notificação do navegador
  const atualizarLembretes = useCallback(async () => {
    try {
      const r = await resumoLembretesAction()
      setResumo(r)
      const novos = avisosNovos(r.avisos)
      if (novos.length) setCartoes((prev) => [...prev, ...novos.filter((n) => !prev.some((p) => p.id === n.id))])
    } catch { /* sem conexão: tenta de novo na próxima consulta */ }
  }, [])

  useEffect(() => {
    atualizarLembretes()
    const id = setInterval(atualizarLembretes, CONSULTA_MS)
    return () => clearInterval(id)
  }, [atualizarLembretes, pathname])

  // No minuto exato do próximo aviso, consulta de novo (não espera a próxima rodada de 1 minuto)
  useEffect(() => {
    if (!resumo.proximoAvisoEm) return
    const espera = new Date(resumo.proximoAvisoEm).getTime() - Date.now() + 1000
    if (espera > CONSULTA_MS) return
    const id = setTimeout(atualizarLembretes, Math.max(0, espera))
    return () => clearTimeout(id)
  }, [resumo.proximoAvisoEm, atualizarLembretes])

  async function concluirAviso(l: Lembrete) {
    setCartoes((prev) => prev.filter((c) => c.id !== l.id))
    await concluirLembreteAction(l.id, true)
    atualizarLembretes()
  }

  // Espera a página terminar de carregar (com um mínimo de tempo) e abre a barra
  useEffect(() => {
    let cancelado = false
    const carregou = new Promise<void>((resolve) => {
      if (document.readyState === 'complete') return resolve()
      window.addEventListener('load', () => resolve(), { once: true })
      setTimeout(resolve, 3000) // não fica girando para sempre se algum recurso demorar
    })
    const minimo = new Promise((r) => setTimeout(r, MIN_CARREGANDO_MS))
    Promise.all([carregou, minimo]).then(() => {
      if (cancelado) return
      setFase('abrindo')
      setTimeout(() => { if (!cancelado) setFase('pronto') }, ABRIR_MS)
    })
    return () => { cancelado = true }
  }, [])

  // Itens entram em sequência, da direita para a esquerda, perto do fim da abertura
  const entrada = (posDaDireita: number): React.CSSProperties => ({
    opacity: fase === 'carregando' ? 0 : 1,
    transform: fase === 'carregando' ? 'translateX(8px)' : 'none',
    transition: `opacity 300ms ease ${ABRIR_MS * 0.45 + posDaDireita * 60}ms, transform 400ms ${EASE} ${ABRIR_MS * 0.45 + posDaDireita * 60}ms`,
  })

  // Tela cheia: acompanha também quando o usuário sai pelo Esc
  useEffect(() => {
    const sync = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', sync)
    return () => document.removeEventListener('fullscreenchange', sync)
  }, [])

  // Fecha o painel aberto ao clicar fora da barra
  useEffect(() => {
    if (!painel) return
    const fechar = (e: MouseEvent) => { if (!barRef.current?.contains(e.target as Node)) setPainel(null) }
    document.addEventListener('mousedown', fechar)
    return () => document.removeEventListener('mousedown', fechar)
  }, [painel])

  const alternar = (p: Exclude<Painel, null>) => setPainel((atual) => (atual === p ? null : p))

  // Abrir o sino conta como "visto": zera o contador na hora e grava no banco
  function abrirNotificacoes() {
    const abrindo = painel !== 'notificacoes'
    alternar('notificacoes')
    if (abrindo && resumo.naoVistos > 0) {
      setResumo((r) => ({ ...r, naoVistos: 0 }))
      marcarAvisosVistosAction()
    }
  }
  // Na própria página de notificações o contador fica zerado
  const badge = pathname === '/notificacoes' ? 0 : resumo.naoVistos

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await document.documentElement.requestFullscreen()
    } catch { /* navegador sem suporte ou bloqueado: ignora */ }
  }

  return (
    // Até telas médias: linha própria no topo. Telas largas (xl): no canto superior direito, na linha do título da página.
    // Encostada na borda direita da tela (sem arredondar à direita): -mr-6 / right-0 anulam o respiro do <main>.
    <div className="flex justify-end -mr-6 mb-4 xl:mb-0 xl:mr-0 xl:absolute xl:top-5 xl:right-0 xl:z-30">
      <div
        ref={barRef}
        className="relative h-12 flex items-center gap-1 rounded-l-full pl-2 pr-4 shadow-sm"
        style={{
          backgroundColor: 'var(--color-brand)',
          // Pronto: sem recorte (os painéis suspensos precisam sair da barra)
          clipPath: fase === 'carregando' ? CLIP_BOLINHA : fase === 'abrindo' ? CLIP_BARRA : 'none',
          transition: `clip-path ${ABRIR_MS}ms ${EASE}`,
        }}
        role="toolbar"
        aria-label="Ferramentas"
        aria-busy={fase === 'carregando'}
      >
        {/* Bolinha girando enquanto a página carrega (centrada no círculo visível) */}
        <span
          aria-hidden
          className="absolute top-0 right-2 w-12 h-12 flex items-center justify-center pointer-events-none"
          style={{ opacity: fase === 'carregando' ? 1 : 0, transition: 'opacity 200ms ease' }}
        >
          <span className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
        </span>

        {/* Ferramentas (esquerda) */}
        <div style={entrada(4)}>
          <ToolButton icon="alarm" label="Lembretes" comTexto href="/lembretes" active={pathname === '/lembretes'} />
        </div>
        {/* Calendário: sem função por enquanto */}
        <div style={entrada(3)}>
          <ToolButton icon="calendar" label="Calendário" comTexto />
        </div>

        <span className="w-px h-6 mx-2 bg-white/30" aria-hidden style={entrada(2)} />

        {/* Direita: notificações e tela cheia */}
        <div className="relative" style={entrada(1)}>
          <ToolButton icon="bell" label="Notificações" onClick={abrirNotificacoes} active={painel === 'notificacoes'} badge={badge} balancar={cartoes.length > 0} />
          {painel === 'notificacoes' && (
            <PainelSuspenso titulo="Notificações" alinhar="right">
              {resumo.avisos.length + resumo.compartilhamentos.length === 0
                ? <Vazio icon="bell" texto="Nenhuma notificação por enquanto." />
                : (
                  <ul className="flex flex-col max-h-72 overflow-y-auto -mx-1.5">
                    {juntarNotificacoes(resumo.avisos, resumo.compartilhamentos).map((n) => n.tipo === 'lembrete' ? (
                      <LinhaNotificacao
                        key={'l-' + n.l.id}
                        icon="alarm"
                        titulo={n.l.titulo}
                        detalhe={'Lembrete · ' + quando(n.l.data_hora)}
                        href={LINK_LEMBRETES}
                        onNavegar={() => setPainel(null)}
                        novo={!n.l.aviso_visto_em}
                        acao={
                          <button type="button" onClick={() => concluirAviso(n.l)} title="Concluir" aria-label={'Concluir ' + n.l.titulo} className="mt-1 w-8 h-8 shrink-0 rounded-full flex items-center justify-center hover:bg-gray-100 cursor-pointer" style={{ color: 'var(--color-brand)' }}>
                            <Icon name="check" size={18} />
                          </button>
                        }
                      />
                    ) : (
                      <LinhaNotificacao
                        key={'c-' + n.c.id}
                        icon="lock"
                        titulo={n.c.sistema}
                        detalhe={`${n.c.dono_nome} compartilhou uma senha com você`}
                        href={LINK_COMPARTILHADAS}
                        onNavegar={() => setPainel(null)}
                        novo={!n.c.aviso_visto_em}
                      />
                    ))}
                  </ul>
                )}
              <Link href="/notificacoes" onClick={() => setPainel(null)} className="block text-center text-sm font-semibold mt-3 pt-3 border-t hover:underline" style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-brand)' }}>
                Ver notificações
              </Link>
            </PainelSuspenso>
          )}
        </div>
        <div style={entrada(0)}>
          <ToolButton
            icon={fullscreen ? 'minimize' : 'maximize'}
            label={fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
            onClick={toggleFullscreen}
            active={fullscreen}
          />
        </div>
      </div>

      {/* Avisos de lembretes que acabaram de chegar (fora da barra, para não serem cortados pelo recorte da entrada) */}
      {cartoes.length > 0 && (
        <div className="fixed right-4 bottom-4 z-[60] flex flex-col-reverse gap-2" aria-live="assertive">
          {cartoes.map((l) => (
            <CartaoAviso
              key={l.id}
              l={l}
              onFechar={() => setCartoes((prev) => prev.filter((c) => c.id !== l.id))}
              onConcluir={() => concluirAviso(l)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
