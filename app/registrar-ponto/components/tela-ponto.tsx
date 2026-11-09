'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { Modal } from '@/components/ui/modal'
import { ModalPinConfirmacao, ModalSemPin } from '@/components/ui/modal-pin'
import { aguardarLocal, lerLocal, minutosDeEspera, rotuloBatida, type LocalBatida } from '@/lib/ponto'
import { baterPontoAction } from '../actions'

const FUSO = 'America/Sao_Paulo'
const RELOGIO = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: FUSO })
const DATA = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: FUSO })
const DATA_RECIBO = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: FUSO })

const GRADIENTE = 'linear-gradient(145deg, var(--color-brand), color-mix(in srgb, var(--color-brand) 68%, #000))'

function Digital({ tamanho }: { tamanho: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" />
      <path d="M14 13.12c0 2.38 0 6.38-1 8.88" />
      <path d="M17.29 21.02c.12-.6.43-2.3.5-3.02" />
      <path d="M2 12a10 10 0 0 1 18-6" />
      <path d="M2 16h.01" />
      <path d="M21.8 16c.2-2 .131-5.354 0-6" />
      <path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2" />
      <path d="M8.65 22c.21-.66.45-1.32.57-2" />
      <path d="M9 6.8a6 6 0 0 1 9 5.2v2" />
    </svg>
  )
}

interface Props {
  empresa: { nome: string; logoUrl: string | null; cor: string }
  funcionario: string | null
  /** Motivo de não poder bater o ponto; sem motivo, está liberado */
  bloqueio: string | null
  /** Batidas de hoje */
  horarios: string[]
  temPin: boolean
}

// Bater ponto: marca da empresa, relógio e o botão de digital; ao tocar, confirma com o PIN de segurança da conta
export function TelaPonto({ empresa, funcionario, bloqueio, horarios, temPin }: Props) {
  const router = useRouter()
  const [agora, setAgora] = useState<Date | null>(null)
  // Localização lida no toque da digital, enquanto a pessoa digita o PIN
  const localRef = useRef<Promise<LocalBatida> | null>(null)
  // Batida aguardando o PIN
  const [pendente, setPendente] = useState(false)
  const [semPin, setSemPin] = useState(false)
  const [recibo, setRecibo] = useState<{ id: string; hora: string; data: string } | null>(null)
  const [baixando, setBaixando] = useState(false)
  const [erroPdf, setErroPdf] = useState(false)

  useEffect(() => {
    setAgora(new Date())
    const t = setInterval(() => setAgora(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    // Só para o navegador já pedir a permissão ao abrir; a posição que vale é lida no toque da digital
    if (!bloqueio) navigator.geolocation?.getCurrentPosition(() => {}, () => {})
  }, [bloqueio])

  const espera = agora ? minutosDeEspera(horarios, agora) : 0
  const liberado = espera === 0

  function pedirBatida() {
    if (!temPin) { setSemPin(true); return }
    localRef.current = lerLocal()
    setPendente(true)
  }

  async function confirmar(pin: string) {
    if (!pendente) return
    const local = await aguardarLocal(localRef.current)
    const r = await baterPontoAction(pin, local)
    if ('error' in r) return { error: r.error }
    setPendente(false)
    const momento = new Date(r.em)
    setRecibo({ id: r.id, hora: RELOGIO.format(momento), data: DATA_RECIBO.format(momento) })
  }

  function fecharRecibo() {
    setRecibo(null)
    setErroPdf(false)
    router.refresh()
  }

  async function baixarRecibo() {
    if (!recibo) return
    setBaixando(true)
    setErroPdf(false)
    try {
      const [{ pdf }, { ReciboPontoPdf }] = await Promise.all([import('@react-pdf/renderer'), import('./recibo-ponto-pdf')])
      const blob = await pdf(
        <ReciboPontoPdf empresa={empresa.nome} funcionario={funcionario ?? ''} data={recibo.data} hora={recibo.hora} corMarca={empresa.cor} id={recibo.id} />,
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `comprovante-ponto-${recibo.data.replaceAll('/', '-')}-${recibo.hora.replaceAll(':', 'h').slice(0, 5)}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setErroPdf(true)
    }
    setBaixando(false)
  }

  return (
    <div className="flex-1 flex flex-col items-center px-4 py-6">
      <div className="w-full max-w-md flex-1 flex flex-col">
        <Link href="/dashboard" className="self-start inline-flex items-center gap-1 text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>
          <Icon name="chevron-left" size={16} /> Voltar
        </Link>

        {/* Marca da empresa */}
        <header className="flex flex-col items-center text-center mt-4 animate-enter">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={empresa.logoUrl || '/logo-casa-empresarial-completa.svg'} alt={empresa.nome} className="object-contain" style={{ maxWidth: 200, maxHeight: 72 }} />
          {funcionario && <p className="text-sm mt-3" style={{ color: 'var(--color-text-muted)' }}>{funcionario}</p>}
        </header>

        {/* Relógio */}
        <div className="text-center mt-8 animate-enter" style={{ animationDelay: '80ms' }}>
          <p className="text-6xl font-extrabold tabular-nums tracking-tight" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
            {agora ? RELOGIO.format(agora) : '--:--:--'}
          </p>
          <p className="text-sm mt-1 first-letter:uppercase" style={{ color: 'var(--color-text-muted)' }}>{agora ? DATA.format(agora) : ' '}</p>
        </div>

        {bloqueio ? (
          <div className="mt-10 flex flex-col items-center text-center gap-3 animate-enter" style={{ animationDelay: '160ms' }}>
            <span className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}>
              <Icon name="info" size={26} />
            </span>
            <p className="text-sm max-w-xs" style={{ color: 'var(--color-text-secondary)' }}>{bloqueio}</p>
          </div>
        ) : (
          <>
            {/* Botão de digital */}
            <div className="flex flex-col items-center mt-10 animate-enter" style={{ animationDelay: '160ms' }}>
              <button
                type="button"
                disabled={!liberado}
                onClick={pedirBatida}
                aria-label="Bater ponto"
                className={`group relative w-48 h-48 rounded-full ${liberado ? 'cursor-pointer' : 'cursor-default'}`}
              >
                {liberado && (
                  <>
                    <span aria-hidden className="ponto-onda absolute inset-0 rounded-full" style={{ backgroundColor: 'var(--color-brand)' }} />
                    <span aria-hidden className="ponto-onda ponto-onda-2 absolute inset-0 rounded-full" style={{ backgroundColor: 'var(--color-brand)' }} />
                  </>
                )}
                <span
                  className="absolute inset-0 rounded-full overflow-hidden flex items-center justify-center text-white transition-transform duration-200 group-hover:scale-105 group-active:scale-95"
                  style={{ background: liberado ? GRADIENTE : 'var(--color-brand-light)', color: liberado ? '#fff' : 'var(--color-brand)', boxShadow: liberado ? '0 18px 40px color-mix(in srgb, var(--color-brand) 45%, transparent)' : undefined }}
                >
                  <Digital tamanho={104} />
                  {liberado && <span aria-hidden className="ponto-scan absolute left-6 right-6 h-0.5 rounded-full bg-white" />}
                </span>
              </button>
              <p className="text-lg font-bold mt-6" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
                Bater ponto
              </p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {espera > 0
                  ? `Próximo registro liberado em ${espera} ${espera === 1 ? 'minuto' : 'minutos'}`
                  : `Toque na digital para registrar a ${rotuloBatida(horarios.length).toLowerCase()}`}
              </p>
            </div>
          </>
        )}
      </div>

      <ModalPinConfirmacao
        open={pendente}
        titulo="Confirme com seu PIN"
        descricao="Digite o PIN de segurança para bater o ponto."
        acaoLabel="Confirmar"
        onClose={() => setPendente(false)}
        onConfirmar={confirmar}
      />
      <ModalSemPin open={semPin} onClose={() => setSemPin(false)} motivo="bater o ponto" />

      <Modal open={!!recibo} onClose={fecharRecibo} title="Comprovante de ponto" description={empresa.nome} className="sm:max-w-sm">
        {recibo && (
          <div className="flex flex-col items-center text-center">
            <span className="w-16 h-16 rounded-full flex items-center justify-center text-white" style={{ background: GRADIENTE }}>
              <Icon name="check" size={32} />
            </span>
            <p className="text-4xl font-extrabold tabular-nums mt-4" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>{recibo.hora}</p>
            <dl className="w-full border-t mt-5 pt-4 flex flex-col gap-2 text-sm" style={{ borderColor: 'var(--color-card-border)' }}>
              <div className="flex justify-between gap-3">
                <dt style={{ color: 'var(--color-text-muted)' }}>Funcionário</dt>
                <dd className="font-medium text-right min-w-0 break-words" style={{ color: 'var(--color-text-primary)' }}>{funcionario}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt style={{ color: 'var(--color-text-muted)' }}>Data</dt>
                <dd className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{recibo.data}</dd>
              </div>
              <div className="flex flex-col gap-0.5 text-left">
                <dt style={{ color: 'var(--color-text-muted)' }}>Id do registro</dt>
                <dd className="text-xs font-mono break-all" style={{ color: 'var(--color-text-primary)' }}>{recibo.id}</dd>
              </div>
            </dl>
            {erroPdf && <p className="text-xs mt-3" style={{ color: 'var(--color-error)' }}>Não foi possível gerar o PDF. Tente de novo.</p>}
            <div className="w-full flex gap-2 mt-5">
              <Button type="button" variant="secondary" className="flex-1" onClick={fecharRecibo}>Fechar</Button>
              <Button type="button" className="flex-1" onClick={baixarRecibo} loading={baixando}>
                {!baixando && <Icon name="download" size={16} />}
                Baixar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
