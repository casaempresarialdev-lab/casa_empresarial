'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Icon } from '@/components/ui/icon'
import { toast } from '@/lib/toast'
import { ASO_MAX_BYTES, GUIA_TIPOS, isoParaCampos, resultadoExameSchema, type ResultadoExameInput } from '@/lib/validations/admissao'
import { registrarResultadoExameAction } from '../../actions'
import type { ConfigAdmissao, Exame } from '../../queries'
import { quandoExame } from './exame-admissao'

type Erros = Partial<Record<keyof ResultadoExameInput | 'aso', string>>

/** Escolha em cartão (resultado e decisão) */
function Opcao({ nome, valor, atual, titulo, texto, tom, onEscolher }: {
  nome: string
  valor: string
  atual: string | undefined
  titulo: string
  texto: string
  tom: 'verde' | 'vermelho' | 'marca'
  onEscolher: (v: string) => void
}) {
  const marcado = atual === valor
  const cor = { verde: '#15803D', vermelho: '#B91C1C', marca: 'var(--color-brand)' }[tom]
  return (
    <label
      className="flex-1 min-w-[180px] flex items-start gap-2.5 rounded-xl border-2 px-4 py-3 cursor-pointer transition-colors"
      style={{ borderColor: marcado ? cor : 'var(--color-card-border)', backgroundColor: marcado ? `color-mix(in srgb, ${cor} 8%, white)` : '#fff' }}
    >
      <input type="radio" name={nome} value={valor} checked={marcado} onChange={() => onEscolher(valor)} className="mt-1 w-4 h-4 shrink-0" style={{ accentColor: cor }} />
      <span>
        <span className="block text-sm font-semibold" style={{ color: marcado ? cor : 'var(--color-text-primary)' }}>{titulo}</span>
        <span className="block text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{texto}</span>
      </span>
    </label>
  )
}

// Etapa "Registrar resultado do exame": apto segue para a contabilidade; inapto, novo exame ou reprovação
export function ResultadoExame({ exame, config, temEmail, temVaga, companyId, employeeId, onReprovado }: {
  exame: Exame | undefined
  config: ConfigAdmissao
  temEmail: boolean
  temVaga: boolean
  companyId: string
  employeeId: string
  onReprovado: () => void
}) {
  const router = useRouter()
  const arquivoRef = useRef<HTMLInputElement>(null)
  const [resultado, setResultado] = useState<'apto' | 'inapto' | undefined>()
  const [decisao, setDecisao] = useState<'novo_exame' | 'reprovar' | undefined>()
  const [data, setData] = useState(() => exame?.data_hora ? isoParaCampos(exame.data_hora).data : isoParaCampos(new Date().toISOString()).data)
  const [observacoes, setObservacoes] = useState('')
  const [aso, setAso] = useState<File | null>(null)
  const [erros, setErros] = useState<Erros>({})
  const [enviando, setEnviando] = useState(false)

  if (!exame) {
    return (
      <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
        Não há encaminhamento aguardando resultado. Volte o card para &quot;Encaminhar para exame&quot; e encaminhe o candidato.
      </p>
    )
  }

  function escolherAso(f: File | undefined) {
    if (!f) return
    if (!GUIA_TIPOS.includes(f.type)) { toast.error('O ASO precisa ser PDF, JPG ou PNG.'); return }
    if (f.size > ASO_MAX_BYTES) { toast.error('O ASO pode ter até 10 MB.'); return }
    setAso(f)
    setErros((e) => ({ ...e, aso: undefined }))
  }

  async function registrar() {
    const parsed = resultadoExameSchema.safeParse({ resultado, data, observacoes, decisao: resultado === 'inapto' ? decisao : undefined })
    const novos: Erros = parsed.success ? {} : Object.fromEntries(parsed.error.issues.map((i) => [i.path[0], i.message]))
    if (resultado === 'apto' && !aso) novos.aso = 'Anexe o ASO'
    setErros(novos)
    if (!parsed.success || novos.aso) return

    const fd = new FormData()
    fd.append('resultado', parsed.data.resultado)
    fd.append('data', parsed.data.data)
    fd.append('observacoes', parsed.data.observacoes)
    if (parsed.data.decisao) fd.append('decisao', parsed.data.decisao)
    if (aso) fd.append('aso', aso)

    setEnviando(true)
    const r = await toast.promise(registrarResultadoExameAction(companyId, employeeId, fd), {
      loading: 'Registrando o resultado…',
      success: (res) => {
        if (!('resultado' in res)) return 'Resultado registrado.'
        if (res.resultado === 'apto') return 'finalizado' in res && res.finalizado ? `Apto. Admissão concluída: a pessoa entrou na Equipe.${res.acesso ? ` ${res.acesso}` : ''}` : `Apto. O card seguiu para "${'proxima' in res ? res.proxima : ''}".`
        if (res.resultado === 'novo_exame') return 'Inapto. O card voltou para "Encaminhar para exame".'
        return temVaga ? 'Candidato reprovado. A candidatura voltou para a vaga.' : 'Candidato reprovado e retirado do processo.'
      },
      error: 'Não foi possível registrar o resultado.',
    })
    setEnviando(false)
    if ('error' in r) return
    if (r.resultado === 'reprovado') {
      if (r.avisoFalhou) toast.error('O e-mail de reprovação não foi enviado. Avise o candidato por outro meio.')
      onReprovado()
      return
    }
    router.refresh()
  }

  const reprovando = resultado === 'inapto' && decisao === 'reprovar'
  const rotulo = resultado === 'inapto'
    ? decisao === 'reprovar' ? 'Registrar e reprovar' : decisao === 'novo_exame' ? 'Registrar e pedir novo exame' : 'Registrar resultado'
    : 'Registrar resultado'

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        Exame na <strong>{exame.clinica_nome}</strong> · {quandoExame(exame)}
      </p>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Resultado *</span>
        <div className="flex flex-wrap gap-3">
          <Opcao nome="resultado" valor="apto" atual={resultado} tom="verde" titulo="Apto" texto="Segue para o envio à contabilidade." onEscolher={(v) => { setResultado(v as 'apto'); setErros({}) }} />
          <Opcao nome="resultado" valor="inapto" atual={resultado} tom="vermelho" titulo="Inapto" texto="Novo exame ou reprovação." onEscolher={(v) => { setResultado(v as 'inapto'); setErros({}) }} />
        </div>
        {erros.resultado && <p className="text-xs" style={{ color: 'var(--color-error)' }}>{erros.resultado}</p>}
      </div>

      {resultado && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
            <Input label="Data do exame *" type="date" value={data} onChange={(e) => setData(e.target.value)} error={erros.data} />
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>ASO {resultado === 'apto' ? '*' : '(opcional)'}</span>
              {aso ? (
                <div className="h-10 flex items-center gap-2 rounded-lg border px-3 text-sm min-w-0" style={{ borderColor: 'var(--color-card-border)', backgroundColor: '#fff' }}>
                  <span style={{ color: 'var(--color-brand)' }}><Icon name="file" size={16} /></span>
                  <span className="truncate flex-1 min-w-0" style={{ color: 'var(--color-text-primary)' }}>{aso.name}</span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setAso(null)} style={{ color: '#B91C1C' }}>Remover</Button>
                </div>
              ) : (
                <div>
                  <Button type="button" variant="secondary" onClick={() => arquivoRef.current?.click()}>Anexar ASO</Button>
                </div>
              )}
              <input ref={arquivoRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => { escolherAso(e.target.files?.[0]); e.target.value = '' }} />
              {erros.aso
                ? <p className="text-xs" style={{ color: 'var(--color-error)' }}>{erros.aso}</p>
                : <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>PDF, JPG ou PNG, até 10 MB.{resultado === 'apto' ? ' Vai para os documentos do funcionário.' : ''}</p>}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="resultado-obs" className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Observações</label>
            <textarea
              id="resultado-obs"
              rows={2}
              maxLength={1000}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder={resultado === 'apto' ? 'Ex.: apto com restrição para trabalho em altura.' : 'Ex.: motivo informado pela clínica.'}
              className="w-full rounded-lg border px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
              style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', backgroundColor: '#fff' }}
            />
          </div>
        </>
      )}

      {resultado === 'inapto' && (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>O que fazer *</span>
          <div className="flex flex-wrap gap-3">
            <Opcao nome="decisao" valor="novo_exame" atual={decisao} tom="marca" titulo="Fazer novo exame" texto='O card volta para "Encaminhar para exame".' onEscolher={(v) => setDecisao(v as 'novo_exame')} />
            <Opcao
              nome="decisao"
              valor="reprovar"
              atual={decisao}
              tom="vermelho"
              titulo="Reprovar candidato"
              texto={temVaga ? 'A candidatura volta para a vaga como reprovada.' : 'O cadastro e os arquivos são excluídos.'}
              onEscolher={(v) => setDecisao(v as 'reprovar')}
            />
          </div>
          {erros.decisao && <p className="text-xs" style={{ color: 'var(--color-error)' }}>{erros.decisao}</p>}
          {reprovando && (
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {config.exame_reprovacao_notificar && temEmail
                ? <strong>O candidato recebe o e-mail de reprovação no exame das Configurações.</strong>
                : 'O candidato não é avisado por e-mail (veja Configurações → Admissão → Reprovação no exame).'}
            </p>
          )}
        </div>
      )}

      {resultado && (
        <div className="flex justify-end border-t pt-4" style={{ borderColor: 'var(--color-card-border)' }}>
          <Button type="button" variant={reprovando ? 'danger' : 'primary'} onClick={registrar} loading={enviando}>{rotulo}</Button>
        </div>
      )}
    </div>
  )
}
