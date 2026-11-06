'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/toast'
import { fmtDataHora } from '@/lib/validations/admissao'
import { adicionarAnotacaoAction } from '../../actions'
import { iniciais } from '../../../funcionarios/components/ficha/ficha-config'
import type { Anotacao } from '../../queries'

interface Props {
  anotacoes: Anotacao[]
  /** Início da admissão: primeiro item da linha do tempo */
  iniciadaEm: string
  employeeId: string
  companyId: string
}

// Lado direito da ficha: registro de anotações, com os eventos do processo na mesma linha do tempo
export function TimelineAdmissao({ anotacoes, iniciadaEm, employeeId, companyId }: Props) {
  const router = useRouter()
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const listaRef = useRef<HTMLOListElement>(null)

  // Do mais antigo para o mais recente
  const itens = [...anotacoes].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))

  // O mais recente sempre visível
  useEffect(() => {
    const el = listaRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [itens.length])

  async function enviar() {
    if (!texto.trim() || enviando) return
    setEnviando(true)
    const r = await adicionarAnotacaoAction(companyId, employeeId, texto)
    setEnviando(false)
    if ('error' in r) { toast.error(r.error ?? 'Não foi possível salvar a anotação.'); return }
    setTexto('')
    router.refresh()
  }

  return (
    // Altura: a janela menos o cabeçalho da página, para o campo de anotação aparecer sem rolar
    <aside className="app-card flex flex-col lg:sticky lg:top-6 lg:h-[calc(100dvh-11rem)] h-[32rem] lg:min-h-[420px]" aria-label="Anotações e linha do tempo">
      <header className="px-5 pt-4 pb-3 border-b" style={{ borderColor: 'var(--color-card-border)' }}>
        <h2 className="text-sm font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>Anotações e linha do tempo</h2>
      </header>

      <ol ref={listaRef} className="flex-1 min-h-0 overflow-y-auto px-5 pt-5 pb-1">
        <Evento texto="Admissão iniciada" em={iniciadaEm} />
        {itens.map((a) => (a.tipo === 'evento'
          ? <Evento key={a.id} texto={a.texto} em={a.created_at} autor={a.autor_nome} />
          : <Registro key={a.id} anotacao={a} />
        ))}
      </ol>

      <div className="p-3 border-t flex flex-col gap-2" style={{ borderColor: 'var(--color-card-border)' }}>
        <textarea
          aria-label="Nova anotação"
          rows={2}
          maxLength={5000}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            // Enter envia; Shift+Enter quebra a linha
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void enviar() }
          }}
          placeholder="Escreva uma anotação…"
          className="w-full rounded-lg border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
          style={{ borderColor: 'var(--color-card-border)', color: 'var(--color-text-primary)', backgroundColor: '#fff' }}
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Enter envia · Shift+Enter quebra a linha</span>
          <Button type="button" size="sm" onClick={enviar} loading={enviando} disabled={!texto.trim()}>Enviar</Button>
        </div>
      </div>
    </aside>
  )
}

// Traço vertical que liga um item ao seguinte (some no último)
function Traco() {
  return <span aria-hidden className="absolute left-[15px] top-8 -bottom-1 w-px group-last:hidden" style={{ backgroundColor: 'var(--color-card-border)' }} />
}

// Evento do processo: um marco discreto na linha do tempo
function Evento({ texto, em, autor }: { texto: string; em: string; autor?: string }) {
  return (
    <li className="group relative flex items-start gap-3 pb-5">
      <Traco />
      <span className="w-8 shrink-0 flex justify-center pt-1">
        <span className="w-2.5 h-2.5 rounded-full ring-4 ring-white" style={{ backgroundColor: 'var(--color-brand)' }} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] leading-5" style={{ color: 'var(--color-sidebar-text)' }}>{texto}</p>
        <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{[autor, fmtDataHora(em)].filter(Boolean).join(' · ')}</p>
      </div>
    </li>
  )
}

// Anotação: um registro, com a foto e o nome de quem escreveu
function Registro({ anotacao: a }: { anotacao: Anotacao }) {
  return (
    <li className="group relative flex items-start gap-3 pb-5">
      <Traco />
      <span
        className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center shrink-0 text-[11px] font-bold ring-4 ring-white relative"
        style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}
      >
        {a.autor?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={a.autor.avatar_url} alt={a.autor_nome} className="w-full h-full object-cover" />
        ) : iniciais(a.autor_nome)}
      </span>
      <div className="flex-1 min-w-0 rounded-xl border px-3.5 py-2.5" style={{ borderColor: 'var(--color-card-border)', backgroundColor: '#FAFAFA' }}>
        <p className="text-[13px] font-semibold truncate" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>{a.autor_nome}</p>
        <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{fmtDataHora(a.created_at)}</p>
        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words mt-1.5" style={{ color: 'var(--color-text-secondary)' }}>{a.texto}</p>
      </div>
    </li>
  )
}
