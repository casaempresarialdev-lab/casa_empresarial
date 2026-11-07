'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/lib/toast'
import { avancarEtapaPersonalizadaAction } from '../../actions'

const hojeIso = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())

// Etapa criada pela empresa: sem integração, só a anotação (vai para o histórico) e o avanço.
// Sendo a última antes de "Finalizado", o avanço conclui a admissão, com a data de admissão.
export function EtapaPersonalizada({ companyId, employeeId, proxima, ultima, dataSugerida, acao, rotuloData = 'Data de admissão', rotuloConcluir = 'Concluir admissão', dicaUltima = 'Última etapa: ao concluir, a pessoa entra na Equipe.', concluida = 'Admissão concluída: a pessoa entrou na Equipe.' }: {
  companyId: string
  employeeId: string
  proxima: string
  ultima: boolean
  dataSugerida: string | null
  /** Outro processo (ex.: rescisão): como avançar e os textos da conclusão */
  acao?: (anotacao: string, data?: string) => Promise<{ error?: string } | { finalizado: boolean; proxima: string; vagaEncerrada?: string | null }>
  rotuloData?: string
  rotuloConcluir?: string
  dicaUltima?: string
  concluida?: string
}) {
  const router = useRouter()
  const [anotacao, setAnotacao] = useState('')
  const [data, setData] = useState(dataSugerida ?? hojeIso())
  const [enviando, setEnviando] = useState(false)

  async function avancar() {
    if (ultima && !data) { toast.error(`Informe a ${rotuloData.toLowerCase()}.`); return }
    setEnviando(true)
    const dataFinal = ultima ? data : undefined
    const r = await toast.promise(acao ? acao(anotacao, dataFinal) : avancarEtapaPersonalizadaAction(companyId, employeeId, anotacao, dataFinal), {
      loading: ultima ? 'Concluindo…' : 'Avançando…',
      success: (res) => !('finalizado' in res) ? 'Etapa concluída.'
        : res.finalizado ? `${concluida}${'vagaEncerrada' in res && res.vagaEncerrada ? ` Vaga "${res.vagaEncerrada}" encerrada.` : ''}`
        : `Seguiu para "${res.proxima}".`,
      error: 'Não foi possível avançar.',
    })
    setEnviando(false)
    if ('error' in r) return
    setAnotacao('')
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="anotacao-etapa" className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Anotações</label>
        <textarea
          id="anotacao-etapa"
          rows={4}
          maxLength={5000}
          value={anotacao}
          onChange={(e) => setAnotacao(e.target.value)}
          placeholder="O que foi feito nesta etapa (opcional)"
          className="w-full rounded-lg border px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
          style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', backgroundColor: '#fff' }}
        />
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>A anotação entra no histórico ao avançar.</p>
      </div>
      {ultima && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label={`${rotuloData} *`} type="date" value={data} onChange={(e) => setData(e.target.value)} hint={dicaUltima} />
        </div>
      )}
      <div className="flex justify-end border-t pt-4" style={{ borderColor: 'var(--color-card-border)' }}>
        <Button type="button" onClick={avancar} loading={enviando}>{ultima ? rotuloConcluir : <>Avançar para &quot;{proxima}&quot;</>}</Button>
      </div>
    </div>
  )
}
