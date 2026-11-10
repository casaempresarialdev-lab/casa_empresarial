'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon, type IconName } from '@/components/ui/icon'
import { opcoesDe, type MotivoFechada, type Resposta } from '@/lib/pesquisa'
import type { Survey, SurveyQuestion } from '@/app/(app)/pessoas/pesquisas/queries'
import { submitSurveyResponseAction } from '../actions'

type Fase = 'inicio' | 'perguntas' | 'obrigado'
type Direcao = 'fwd' | 'back'
type Marca = { nome: string | null; logo: string | null; cor: string }

const LETRAS = 'ABCDEFGHIJ'
const ESCALA = ['Discordo totalmente', 'Discordo', 'Neutro', 'Concordo', 'Concordo totalmente']
const minutos = (n: number) => Math.max(1, Math.ceil(n * 0.6))

const FECHADA: Record<MotivoFechada, { icone: IconName; titulo: string; texto: string }> = {
  rascunho: { icone: 'lock', titulo: 'Pesquisa ainda não aberta', texto: 'Ela ainda está sendo preparada. Tente de novo quando a empresa avisar.' },
  encerrada: { icone: 'lock', titulo: 'Pesquisa encerrada', texto: 'Esta pesquisa não recebe mais respostas. Obrigado pelo interesse!' },
  antes: { icone: 'calendar', titulo: 'Pesquisa ainda não começou', texto: 'Ela abre em breve. Volte na data informada pela empresa.' },
  depois: { icone: 'calendar', titulo: 'Prazo encerrado', texto: 'O período para responder esta pesquisa terminou.' },
  sem_perguntas: { icone: 'info', titulo: 'Pesquisa sem perguntas', texto: 'Esta pesquisa ainda não tem perguntas cadastradas.' },
}

// Botão principal na cor da empresa
function Botao({ children, onClick, disabled, carregando }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; carregando?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || carregando}
      className="inline-flex items-center justify-center gap-2 h-11 px-6 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
      style={{ backgroundColor: 'var(--marca)' }}
    >
      {carregando && <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
      {children}
    </button>
  )
}

// Tela de mensagem (fechada, já respondida, obrigado, não encontrada)
function Mensagem({ icone, titulo, texto, children, destaque }: { icone: IconName; titulo: string; texto: string; children?: React.ReactNode; destaque?: boolean }) {
  return (
    <div className="text-center flex flex-col items-center">
      <span
        className="w-16 h-16 rounded-full flex items-center justify-center mb-5"
        style={destaque ? { backgroundColor: 'var(--marca)', color: '#fff' } : { backgroundColor: 'var(--marca-claro)', color: 'var(--marca)' }}
      >
        <Icon name={icone} size={28} />
      </span>
      <h1 className="text-2xl font-extrabold mb-2" style={{ fontFamily: 'Manrope', color: '#111827' }}>{titulo}</h1>
      <p className="text-sm leading-relaxed max-w-sm" style={{ color: '#6B7280' }}>{texto}</p>
      {children && <div className="mt-6">{children}</div>}
    </div>
  )
}

export function SurveyForm({ survey, motivo, jaRespondeu, logado, marca }: {
  survey: Survey | null
  motivo: MotivoFechada | null
  jaRespondeu: boolean
  logado: boolean
  marca: Marca
}) {
  const perguntas = survey?.perguntas ?? []
  const [fase, setFase] = useState<Fase>('inicio')
  const [indice, setIndice] = useState(0)
  const [respostas, setRespostas] = useState<Record<string, Resposta>>({})
  const [direcao, setDirecao] = useState<Direcao>('fwd')
  const [saindo, setSaindo] = useState(false)
  const [chave, setChave] = useState(0)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  const atual: SurveyQuestion | undefined = perguntas[indice]
  const ultima = indice === perguntas.length - 1
  const respondidas = perguntas.filter((q) => respostas[q.id] !== undefined).length
  const progresso = fase === 'obrigado' ? 100 : fase === 'perguntas' ? (indice / perguntas.length) * 100 : 0

  const trocar = useCallback((acao: () => void, dir: Direcao = 'fwd') => {
    setDirecao(dir)
    setSaindo(true)
    setTimeout(() => { acao(); setChave((k) => k + 1); setSaindo(false) }, 200)
  }, [])

  async function enviar(finais: Record<string, Resposta>) {
    setEnviando(true)
    setErro('')
    const r = await submitSurveyResponseAction(survey!.id, finais).catch(() => ({ error: 'Sem conexão. Confira a internet e tente de novo.' }))
    setEnviando(false)
    if ('error' in r) { setErro(r.error ?? 'Não foi possível enviar.'); return }
    trocar(() => setFase('obrigado'))
  }

  function avancar(novas = respostas) {
    if (ultima) { enviar(novas); return }
    trocar(() => setIndice((i) => i + 1))
  }

  function responder(valor: Resposta, seguir: boolean) {
    if (!atual) return
    const novas = { ...respostas, [atual.id]: valor }
    setRespostas(novas)
    setErro('')
    // Escolha única e escala seguem sozinhas, com um respiro para ver a marcação
    if (seguir && !ultima) setTimeout(() => avancar(novas), 260)
  }

  function pular() {
    if (!atual) return
    const novas = { ...respostas }
    delete novas[atual.id]
    setRespostas(novas)
    avancar(novas)
  }

  function voltar() {
    setErro('')
    if (indice === 0) trocar(() => setFase('inicio'), 'back')
    else trocar(() => setIndice((i) => i - 1), 'back')
  }

  // Atalhos: letras ou números escolhem, Enter continua
  useEffect(() => {
    if (fase !== 'perguntas' || !atual || enviando) return
    function tecla(e: KeyboardEvent) {
      if (!atual || ['TEXTAREA', 'INPUT'].includes((e.target as HTMLElement).tagName)) return
      const opcoes = opcoesDe(atual)
      if (atual.tipo === 'escala') {
        const n = Number(e.key)
        if (n >= 1 && n <= 5) responder(n, true)
      } else if (atual.tipo === 'escolha' || atual.tipo === 'multipla') {
        const i = LETRAS.indexOf(e.key.toUpperCase())
        if (i >= 0 && i < opcoes.length) {
          if (atual.tipo === 'escolha') responder(opcoes[i], true)
          else {
            const marcadas = (respostas[atual.id] as string[] | undefined) ?? []
            responder(marcadas.includes(opcoes[i]) ? marcadas.filter((m) => m !== opcoes[i]) : [...marcadas, opcoes[i]], false)
          }
        }
      }
      if (e.key === 'Enter' && respostas[atual.id] !== undefined) avancar()
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }) // a cada render: usa as respostas atuais

  const animacao = saindo ? (direcao === 'fwd' ? 's-exit-fwd' : 's-exit-back') : (direcao === 'fwd' ? 's-enter-fwd' : 's-enter-back')
  const estilo = {
    '--marca': marca.cor,
    '--marca-claro': `color-mix(in srgb, ${marca.cor} 12%, #fff)`,
    background: `radial-gradient(circle at 15% 0%, color-mix(in srgb, ${marca.cor} 14%, #fff) 0%, #F7F8FA 55%)`,
  } as React.CSSProperties

  let conteudo: React.ReactNode
  if (!survey) {
    conteudo = <Mensagem icone="info" titulo="Pesquisa não encontrada" texto="O link pode estar incompleto ou a pesquisa foi removida. Confira com quem enviou." />
  } else if (jaRespondeu && fase !== 'obrigado') {
    conteudo = (
      <Mensagem icone="check" titulo="Você já respondeu" texto="Sua participação nesta pesquisa já foi registrada. Obrigado por contribuir!" destaque>
        {logado && <a href="/dashboard" className="text-sm font-semibold hover:underline" style={{ color: 'var(--marca)' }}>Voltar ao sistema</a>}
      </Mensagem>
    )
  } else if (motivo) {
    const m = FECHADA[motivo]
    conteudo = <Mensagem icone={m.icone} titulo={m.titulo} texto={m.texto} />
  } else if (fase === 'inicio') {
    conteudo = (
      <div className="flex flex-col items-center text-center">
        <span className="text-[11px] font-bold uppercase tracking-[0.18em] mb-3" style={{ color: 'var(--marca)' }}>Pesquisa</span>
        <h1 className="text-2xl sm:text-3xl font-extrabold leading-tight mb-3" style={{ fontFamily: 'Manrope', color: '#111827' }}>{survey.titulo}</h1>
        {survey.descricao && <p className="text-sm leading-relaxed max-w-md mb-6 whitespace-pre-line" style={{ color: '#4B5563' }}>{survey.descricao}</p>}
        <div className="flex flex-wrap justify-center gap-2 mb-6">
          {[
            ['alarm', `Cerca de ${minutos(perguntas.length)} min`],
            ['file', `${perguntas.length} ${perguntas.length === 1 ? 'pergunta' : 'perguntas'}`],
            ['lock', 'Anônima'],
          ].map(([icone, texto]) => (
            <span key={texto} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium" style={{ backgroundColor: 'var(--marca-claro)', color: '#374151' }}>
              <span style={{ color: 'var(--marca)' }}><Icon name={icone as IconName} size={14} /></span>{texto}
            </span>
          ))}
        </div>
        <Botao onClick={() => trocar(() => { setFase('perguntas'); setIndice(0) })}>Começar</Botao>
        <p className="text-xs mt-5 max-w-sm leading-relaxed" style={{ color: '#9CA3AF' }}>
          Suas respostas não são ligadas ao seu nome. A empresa vê só os resultados de todos juntos.
        </p>
      </div>
    )
  } else if (fase === 'obrigado') {
    conteudo = (
      <Mensagem icone="check" titulo="Obrigado por responder!" texto={`Você respondeu ${respondidas} de ${perguntas.length} ${perguntas.length === 1 ? 'pergunta' : 'perguntas'}. Sua opinião foi enviada de forma anônima e ajuda a melhorar o dia a dia de todos.`} destaque>
        {logado && <a href="/dashboard" className="inline-flex items-center h-11 px-6 rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: 'var(--marca)' }}>Voltar ao sistema</a>}
      </Mensagem>
    )
  } else if (atual) {
    const respondida = respostas[atual.id] !== undefined
    conteudo = (
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] mb-2" style={{ color: 'var(--marca)' }}>Pergunta {indice + 1} de {perguntas.length}</p>
        <h2 className="text-xl sm:text-2xl font-extrabold leading-snug mb-6" style={{ fontFamily: 'Manrope', color: '#111827' }}>{atual.texto || 'Sem texto'}</h2>

        {atual.tipo === 'escolha' && <Opcoes pergunta={atual} marcadas={respostas[atual.id] !== undefined ? [respostas[atual.id] as string] : []} onEscolher={(o) => responder(o, true)} />}
        {atual.tipo === 'multipla' && (
          <>
            <p className="text-xs mb-2" style={{ color: '#6B7280' }}>Marque todas que se aplicam.</p>
            <Opcoes
              pergunta={atual}
              multipla
              marcadas={(respostas[atual.id] as string[] | undefined) ?? []}
              onEscolher={(o) => {
                const marcadas = (respostas[atual.id] as string[] | undefined) ?? []
                const novas = marcadas.includes(o) ? marcadas.filter((m) => m !== o) : [...marcadas, o]
                if (novas.length) responder(novas, false)
                else { const r = { ...respostas }; delete r[atual.id]; setRespostas(r) }
              }}
            />
          </>
        )}
        {atual.tipo === 'escala' && <Escala valor={respostas[atual.id] as number | undefined} onEscolher={(n) => responder(n, true)} />}
        {atual.tipo === 'texto' && <Texto key={atual.id} valor={(respostas[atual.id] as string | undefined) ?? ''} onMudar={(t) => {
          const r = { ...respostas }
          if (t.trim()) r[atual.id] = t
          else delete r[atual.id]
          setRespostas(r)
        }} onEnter={() => respondida && avancar()} />}

        {erro && (
          <p role="alert" className="mt-5 text-sm rounded-lg px-3 py-2.5" style={{ backgroundColor: '#FEE2E2', color: '#B91C1C' }}>{erro}</p>
        )}

        <div className="mt-8 flex items-center justify-between gap-3">
          <button type="button" onClick={voltar} disabled={enviando} className="inline-flex items-center gap-1 text-sm font-medium px-2 h-10 rounded-lg hover:bg-gray-100 disabled:opacity-40 cursor-pointer" style={{ color: '#6B7280' }}>
            <Icon name="chevron-left" size={16} /> Voltar
          </button>
          <div className="flex items-center gap-2">
            {!respondida && !ultima && (
              <button type="button" onClick={pular} className="text-sm font-medium px-3 h-10 rounded-lg hover:bg-gray-100 cursor-pointer" style={{ color: '#6B7280' }}>Pular</button>
            )}
            {ultima
              ? <Botao onClick={() => avancar()} carregando={enviando} disabled={respondidas === 0}>{erro ? 'Tentar de novo' : 'Enviar respostas'}</Botao>
              : <Botao onClick={() => avancar()} disabled={!respondida}>Continuar</Botao>}
          </div>
        </div>
        {ultima && respondidas === 0 && <p className="text-xs mt-3 text-right" style={{ color: '#9CA3AF' }}>Responda pelo menos uma pergunta para enviar.</p>}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 flex flex-col" style={estilo}>
      <header className="shrink-0 bg-white/80 backdrop-blur border-b" style={{ borderColor: '#EEF0F3' }}>
        <div className="max-w-2xl mx-auto px-5 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {marca.logo ? <img src={marca.logo} alt={marca.nome ?? 'Empresa'} className="h-9 w-auto max-w-[140px] object-contain" /> : null}
            {!marca.logo && marca.nome && <span className="text-sm font-bold truncate" style={{ fontFamily: 'Manrope', color: '#111827' }}>{marca.nome}</span>}
          </div>
          {fase === 'perguntas' && !motivo && !jaRespondeu && (
            <span className="text-xs font-semibold tabular-nums shrink-0" style={{ color: '#6B7280' }}>{indice + 1} / {perguntas.length}</span>
          )}
        </div>
        <div className="h-1" style={{ backgroundColor: '#EEF0F3' }}>
          <div className="h-full transition-[width] duration-500 ease-out" style={{ width: `${progresso}%`, backgroundColor: 'var(--marca)' }} />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto flex items-start sm:items-center justify-center px-4 py-8">
        <div key={chave} className={`${animacao} w-full max-w-xl bg-white rounded-3xl border p-6 sm:p-10 shadow-[0_10px_40px_rgba(17,24,39,0.08)]`} style={{ borderColor: '#EEF0F3' }}>
          {conteudo}
        </div>
      </main>

      {fase === 'perguntas' && !motivo && !jaRespondeu && (
        <p className="shrink-0 text-center text-[11px] pb-4 hidden sm:block" style={{ color: '#9CA3AF' }}>
          Atalhos: {atual?.tipo === 'escala' ? 'teclas 1 a 5' : atual?.tipo === 'texto' ? 'Enter para continuar, Shift+Enter para nova linha' : 'letras das opções'} · Enter continua
        </p>
      )}
    </div>
  )
}

// ── Tipos de pergunta ─────────────────────────────────────────────────────────

function Opcoes({ pergunta, marcadas, onEscolher, multipla }: { pergunta: SurveyQuestion; marcadas: string[]; onEscolher: (o: string) => void; multipla?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      {opcoesDe(pergunta).map((o, i) => {
        const marcada = marcadas.includes(o)
        return (
          <button
            key={o}
            type="button"
            role={multipla ? 'checkbox' : 'radio'}
            aria-checked={marcada}
            onClick={() => onEscolher(o)}
            className="flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl border-2 transition-colors cursor-pointer hover:border-[var(--marca)]"
            style={marcada ? { borderColor: 'var(--marca)', backgroundColor: 'var(--marca-claro)' } : { borderColor: '#E5E7EB', backgroundColor: '#fff' }}
          >
            <span
              className={`w-7 h-7 shrink-0 flex items-center justify-center text-xs font-bold ${multipla ? 'rounded-md' : 'rounded-full'}`}
              style={marcada ? { backgroundColor: 'var(--marca)', color: '#fff' } : { border: '1px solid #D1D5DB', color: '#6B7280' }}
            >
              {marcada ? <Icon name="check" size={14} /> : LETRAS[i]}
            </span>
            <span className="flex-1 text-sm font-medium" style={{ color: '#111827' }}>{o}</span>
          </button>
        )
      })}
    </div>
  )
}

function Escala({ valor, onEscolher }: { valor: number | undefined; onEscolher: (n: number) => void }) {
  const [sobre, setSobre] = useState<number | null>(null)
  const mostrar = sobre ?? valor
  return (
    <div>
      <div className="grid grid-cols-5 gap-2" role="radiogroup">
        {[1, 2, 3, 4, 5].map((n) => {
          const marcada = valor === n
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={marcada}
              aria-label={`${n}: ${ESCALA[n - 1]}`}
              onClick={() => onEscolher(n)}
              onMouseEnter={() => setSobre(n)}
              onMouseLeave={() => setSobre(null)}
              className="h-14 sm:h-16 rounded-xl border-2 text-lg font-extrabold transition-all cursor-pointer hover:border-[var(--marca)] hover:-translate-y-0.5"
              style={marcada ? { borderColor: 'var(--marca)', backgroundColor: 'var(--marca)', color: '#fff', fontFamily: 'Manrope' } : { borderColor: '#E5E7EB', backgroundColor: '#fff', color: '#374151', fontFamily: 'Manrope' }}
            >
              {n}
            </button>
          )
        })}
      </div>
      <div className="flex justify-between text-[11px] mt-2" style={{ color: '#9CA3AF' }}>
        <span>Discordo totalmente</span>
        <span>Concordo totalmente</span>
      </div>
      <p className="text-center text-sm font-semibold mt-3 h-5" style={{ color: 'var(--marca)' }}>{mostrar ? ESCALA[mostrar - 1] : ''}</p>
    </div>
  )
}

function Texto({ valor, onMudar, onEnter }: { valor: string; onMudar: (t: string) => void; onEnter: () => void }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { const t = setTimeout(() => ref.current?.focus(), 320); return () => clearTimeout(t) }, [])
  return (
    <div>
      <textarea
        ref={ref}
        rows={5}
        maxLength={2000}
        value={valor}
        onChange={(e) => onMudar(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onEnter() } }}
        placeholder="Escreva com suas palavras..."
        className="w-full rounded-xl border-2 px-4 py-3 text-sm leading-relaxed resize-none outline-none transition-colors focus:border-[var(--marca)]"
        style={{ borderColor: '#E5E7EB', color: '#111827' }}
      />
      <p className="text-[11px] text-right mt-1 tabular-nums" style={{ color: '#9CA3AF' }}>{valor.length}/2000</p>
    </div>
  )
}
