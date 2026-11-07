'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { FileDropZone } from '@/components/ui/file-drop-zone'
import { toast } from '@/lib/toast'
import { ASO_MAX_BYTES, CONTRATO_MAX_BYTES, exameSchema, fmtDataHora, isoParaCampos, type ExameInput } from '@/lib/validations/admissao'
import { addDays } from '../../../funcionarios/components/ficha/ficha-config'
import { baixarFichaPdf } from '../../../funcionarios/components/ficha/baixar-ficha-pdf'
import {
  assinarTrctAction, encaminharExameRescisaoAction, getAsoRescisaoUrlAction, registrarAvisoPrevioAction,
  registrarEnvioContabilidadeRescisaoAction, registrarRetornoContabilidadeRescisaoAction, registrarRetornoExameRescisaoAction,
} from '../../actions'
import { MODALIDADES_AVISO, diasAvisoPrevio } from '../../etapas'
import type { Clinica, Exame } from '../../../admissao/queries'
import type { Employee } from '../../../funcionarios/queries'
import type { CompanyBenefit } from '../../../beneficios/queries'
import type { Company } from '../../../../empresa/queries'

const hojeIso = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
const fmtData = (d: string) => d.split('-').reverse().join('/')
const ARQUIVOS_ACEITOS = '.pdf,.jpg,.jpeg,.png'

type Resultado = { error?: string } | { finalizado: boolean; proxima: string }

/** Mensagem de quando a etapa termina: a próxima etapa ou a saída da Equipe */
const aposEtapa = (inicio: string) => (res: Resultado) =>
  !('finalizado' in res) ? inicio : res.finalizado ? `${inicio} Rescisão finalizada: a pessoa saiu da Equipe.` : `${inicio} Seguiu para "${res.proxima}".`

const areaTexto = 'w-full rounded-lg border px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]'
const estiloTexto = { borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', backgroundColor: '#fff' }

function Rodape({ children }: { children: React.ReactNode }) {
  return <div className="flex justify-end gap-2 border-t pt-4" style={{ borderColor: 'var(--color-card-border)' }}>{children}</div>
}

// ── Aviso prévio ─────────────────────────────────────────────────────────────

export function AvisoPrevio({ companyId, rescisaoId, dataAdmissao }: { companyId: string; rescisaoId: string; dataAdmissao: string | null }) {
  const router = useRouter()
  const [modalidade, setModalidade] = useState('')
  const [comunicacao, setComunicacao] = useState(hojeIso())
  const [dias, setDias] = useState(String(diasAvisoPrevio(dataAdmissao, hojeIso())))
  const [ultimoDia, setUltimoDia] = useState('')
  const [enviando, setEnviando] = useState(false)

  // Último dia sugerido: trabalhado, a comunicação mais os dias do aviso; indenizado ou dispensado, a própria comunicação
  const sugerir = (m: string, c: string, d: string) => setUltimoDia(c ? (m === 'trabalhado' ? addDays(c, Number(d) || 0) : c) : '')

  async function registrar() {
    if (!modalidade) { toast.error('Escolha a modalidade do aviso.'); return }
    setEnviando(true)
    const r = await toast.promise(registrarAvisoPrevioAction(companyId, rescisaoId, { modalidade, comunicacao, dias, ultimo_dia: ultimoDia }), {
      loading: 'Registrando o aviso prévio…',
      success: aposEtapa('Aviso prévio registrado.'),
      error: 'Não foi possível registrar o aviso.',
    })
    setEnviando(false)
    if (!('error' in r)) router.refresh()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Select
          label="Modalidade *"
          placeholder="Selecionar..."
          options={[...MODALIDADES_AVISO]}
          value={modalidade}
          onChange={(e) => { setModalidade(e.target.value); sugerir(e.target.value, comunicacao, dias) }}
        />
        <Input
          label="Data da comunicação *"
          type="date"
          value={comunicacao}
          onChange={(e) => {
            const c = e.target.value
            setComunicacao(c)
            const d = c ? String(diasAvisoPrevio(dataAdmissao, c)) : dias
            setDias(d)
            sugerir(modalidade, c, d)
          }}
        />
        <Input
          label="Dias de aviso *"
          type="number"
          min={0}
          max={120}
          value={dias}
          hint="30 dias mais 3 por ano completo de casa, até 90."
          onChange={(e) => { setDias(e.target.value); sugerir(modalidade, comunicacao, e.target.value) }}
        />
        <Input
          label="Último dia de trabalho *"
          type="date"
          value={ultimoDia}
          onChange={(e) => setUltimoDia(e.target.value)}
          hint={modalidade === 'trabalhado' ? 'Calculado pelos dias do aviso; ajuste se precisar.' : 'Sem cumprir o aviso, costuma ser o dia da comunicação.'}
        />
      </div>
      <Rodape><Button type="button" onClick={registrar} loading={enviando}>Registrar aviso prévio</Button></Rodape>
    </div>
  )
}

// ── Exame demissional ────────────────────────────────────────────────────────

const STATUS_EXAME: Record<Exame['status'], { texto: string; fundo: string; cor: string }> = {
  encaminhado: { texto: 'Encaminhado', fundo: '#DBEAFE', cor: '#1D4ED8' },
  realizado: { texto: 'Realizado', fundo: '#DCFCE7', cor: '#15803D' },
  substituido: { texto: 'Substituído', fundo: '#F3F4F6', cor: '#6B7280' },
}

function FormExame({ clinicas, atual, enviando, aviso, onSalvar, onCancelar }: {
  clinicas: Clinica[]
  atual: Exame | null
  enviando: boolean
  aviso: string
  onSalvar: (d: ExameInput) => void
  onCancelar: () => void
}) {
  const inicial = clinicas.find((c) => c.id === atual?.clinic_id) ?? (clinicas.length === 1 ? clinicas[0] : null)
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<ExameInput>({
    resolver: zodResolver(exameSchema),
    defaultValues: {
      clinic_id: inicial?.id ?? '',
      ...(atual?.data_hora ? isoParaCampos(atual.data_hora) : { data: '', hora: '' }),
      orientacoes: atual?.orientacoes ?? inicial?.orientacoes ?? '',
    },
  })
  const clinica = register('clinic_id')

  return (
    <form onSubmit={handleSubmit(onSalvar)} noValidate className="flex flex-col gap-3 rounded-xl border p-4" style={{ borderColor: 'var(--color-card-border)', backgroundColor: '#FAFAFA' }}>
      <Select
        label="Clínica *"
        placeholder="Selecionar..."
        options={clinicas.map((c) => ({ value: c.id, label: c.nome }))}
        error={errors.clinic_id?.message}
        {...clinica}
        onChange={(e) => { clinica.onChange(e); setValue('orientacoes', clinicas.find((c) => c.id === e.target.value)?.orientacoes ?? '') }}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label="Data" type="date" error={errors.data?.message} {...register('data')} />
        <Input label="Hora" type="time" error={errors.hora?.message} {...register('hora')} />
      </div>
      <p className="text-xs -mt-1" style={{ color: 'var(--color-text-muted)' }}>Sem data e hora, a orientação é ir por ordem de chegada.</p>
      <div className="flex flex-col gap-1">
        <label htmlFor="rescisao-exame-orientacoes" className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Orientações</label>
        <textarea id="rescisao-exame-orientacoes" rows={3} {...register('orientacoes')} className={areaTexto} style={estiloTexto} />
      </div>
      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{aviso}</p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={onCancelar} disabled={enviando}>Cancelar</Button>
        <Button type="submit" size="sm" loading={enviando}>{atual ? 'Reencaminhar' : 'Encaminhar'}</Button>
      </div>
    </form>
  )
}

export function ExameRescisao({ exames, clinicas, emailLigado, temEmail, naEtapa, companyId, rescisaoId }: {
  exames: Exame[]
  clinicas: Clinica[]
  emailLigado: boolean
  temEmail: boolean
  naEtapa: boolean
  companyId: string
  rescisaoId: string
}) {
  const router = useRouter()
  const [formAberto, setFormAberto] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const atual = exames.find((e) => e.status === 'encaminhado') ?? null

  async function verAso(exameId: string) {
    const r = await getAsoRescisaoUrlAction(companyId, exameId)
    if (!('url' in r) || !r.url) { toast.error(('error' in r && r.error) || 'Não foi possível abrir o ASO.'); return }
    window.open(r.url, '_blank', 'noopener')
  }

  async function encaminhar(d: ExameInput) {
    setEnviando(true)
    const r = await toast.promise(encaminharExameRescisaoAction(companyId, rescisaoId, d), {
      loading: 'Encaminhando…',
      success: (res) => {
        const avisado = 'email' in res && res.email === 'enviado' ? ' e avisado por e-mail' : ''
        return 'reencaminhando' in res && res.reencaminhando ? `Reencaminhado${avisado}.` : `Encaminhado${avisado}. Seguiu para "Registrar retorno do exame".`
      },
      error: 'Não foi possível encaminhar.',
    })
    setEnviando(false)
    if ('error' in r) return
    if (r.email === 'falhou') toast.error('O e-mail não foi enviado. Avise por outro meio.')
    setFormAberto(false)
    router.refresh()
  }

  if (naEtapa && clinicas.length === 0 && !atual) {
    return (
      <p className="text-sm rounded-lg border border-dashed px-4 py-5 text-center" style={{ borderColor: 'var(--color-card-border)', color: 'var(--color-text-muted)' }}>
        Nenhuma clínica cadastrada. Cadastre em{' '}
        <Link href="/configuracoes" className="font-semibold hover:underline" style={{ color: 'var(--color-brand)' }}>Configurações → Admissão → Exame admissional</Link>
        {' '}(as clínicas valem também para o exame demissional).
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {naEtapa && !formAberto && (
        <div className="flex justify-end">
          <Button type="button" variant="secondary" size="sm" onClick={() => setFormAberto(true)}>{atual ? 'Reencaminhar' : 'Encaminhar para exame'}</Button>
        </div>
      )}
      {formAberto && (
        <FormExame
          clinicas={clinicas}
          atual={atual}
          enviando={enviando}
          aviso={!emailLigado
            ? 'O envio de e-mail está desligado em Configurações → Rescisão: combine o exame por outro meio.'
            : temEmail ? 'A pessoa recebe a clínica, a data e as orientações por e-mail, com a guia em anexo.' : 'A pessoa não tem e-mail cadastrado: combine o exame por outro meio.'}
          onSalvar={encaminhar}
          onCancelar={() => setFormAberto(false)}
        />
      )}
      {exames.length > 0 && (
        <ul className="flex flex-col gap-2">
          {exames.map((e) => {
            const s = e.resultado ? { texto: e.resultado === 'apto' ? 'Apto' : 'Inapto', fundo: e.resultado === 'apto' ? '#DCFCE7' : '#FEE2E2', cor: e.resultado === 'apto' ? '#15803D' : '#B91C1C' } : STATUS_EXAME[e.status]
            return (
              <li key={e.id} className="rounded-lg border px-4 py-3 flex flex-col gap-1" style={{ borderColor: 'var(--color-card-border)', opacity: e.status === 'substituido' ? 0.6 : 1 }}>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold flex-1 min-w-0" style={{ color: 'var(--color-text-primary)' }}>{e.clinica_nome}</p>
                  {e.aso_path && <Button type="button" variant="ghost" size="sm" onClick={() => verAso(e.id)}>Ver ASO</Button>}
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: s.fundo, color: s.cor }}>{s.texto}</span>
                </div>
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  {e.resultado_data
                    ? `Exame em ${fmtData(e.resultado_data)}${e.resultado_por ? ` · registrado por ${e.resultado_por}` : ''}`
                    : e.data_hora ? `Marcado para ${fmtDataHora(e.data_hora)}` : 'Por ordem de chegada'}
                </p>
                {e.resultado_observacoes && <p className="text-xs whitespace-pre-line" style={{ color: 'var(--color-text-secondary)' }}>Observações: {e.resultado_observacoes}</p>}
                {e.orientacoes && <p className="text-xs whitespace-pre-line" style={{ color: 'var(--color-text-muted)' }}>{e.orientacoes}</p>}
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Encaminhado em {fmtDataHora(e.created_at)}{e.email_enviado ? ' · avisado por e-mail' : ''}</p>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export function RetornoExame({ companyId, rescisaoId, temEncaminhamento }: { companyId: string; rescisaoId: string; temEncaminhamento: boolean }) {
  const router = useRouter()
  const [resultado, setResultado] = useState<'apto' | 'inapto' | ''>('')
  const [data, setData] = useState(hojeIso())
  const [observacoes, setObservacoes] = useState('')
  const [aso, setAso] = useState<File | null>(null)
  const [enviando, setEnviando] = useState(false)

  if (!temEncaminhamento) {
    return <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Não há encaminhamento aguardando retorno. Use &quot;Reencaminhar&quot; no exame demissional, acima.</p>
  }

  async function registrar() {
    if (!resultado) { toast.error('Escolha o resultado.'); return }
    if (!aso) { toast.error('Anexe o ASO demissional.'); return }
    const fd = new FormData()
    fd.set('resultado', resultado)
    fd.set('data', data)
    fd.set('observacoes', observacoes)
    fd.set('aso', aso)
    setEnviando(true)
    const r = await toast.promise(registrarRetornoExameRescisaoAction(companyId, rescisaoId, fd), {
      loading: 'Registrando o retorno…',
      success: aposEtapa('Retorno do exame registrado.'),
      error: 'Não foi possível registrar o retorno.',
    })
    setEnviando(false)
    if (!('error' in r)) router.refresh()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Select label="Resultado *" placeholder="Selecionar..." options={[{ value: 'apto', label: 'Apto' }, { value: 'inapto', label: 'Inapto' }]} value={resultado} onChange={(e) => setResultado(e.target.value as 'apto' | 'inapto')} />
        <Input label="Data do exame *" type="date" value={data} onChange={(e) => setData(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>ASO demissional *</span>
        <FileDropZone file={aso} onFile={setAso} maxBytes={ASO_MAX_BYTES} accept={ARQUIVOS_ACEITOS} hint="PDF, JPG ou PNG" />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="rescisao-retorno-obs" className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Observações</label>
        <textarea id="rescisao-retorno-obs" rows={2} maxLength={1000} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} className={areaTexto} style={estiloTexto} />
      </div>
      {resultado === 'inapto' && (
        <p className="text-xs rounded-lg px-3 py-2" style={{ backgroundColor: '#FEF3C7', color: '#B45309' }}>
          Inapto no demissional: confirme com a contabilidade e o médico do trabalho antes de seguir com o desligamento.
        </p>
      )}
      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>O ASO fica nos arquivos do funcionário, como &quot;Exame Demissional&quot;.</p>
      <Rodape><Button type="button" onClick={registrar} loading={enviando}>Registrar retorno</Button></Rodape>
    </div>
  )
}

// ── Contabilidade ────────────────────────────────────────────────────────────

export function ContabilidadeRescisao({ etapa, ficha, company, benefits, fotoUrl, enviadaEm, enviadaPor, retornoEm, companyId, rescisaoId }: {
  etapa: 'envio' | 'aguardando' | 'concluida'
  ficha: Employee
  company: Company | null
  benefits: CompanyBenefit[]
  fotoUrl: string | null
  enviadaEm: string | null
  enviadaPor: string | null
  retornoEm: string | null
  companyId: string
  rescisaoId: string
}) {
  const router = useRouter()
  const [gerando, setGerando] = useState(false)
  const [enviando, setEnviando] = useState(false)

  async function baixarFicha() {
    setGerando(true)
    try { await baixarFichaPdf({ employee: ficha, company, benefits, fotoUrl }) } catch { toast.error('Não foi possível gerar o PDF da ficha.') }
    setGerando(false)
  }

  async function registrar(acao: 'envio' | 'retorno') {
    setEnviando(true)
    const r = acao === 'envio'
      ? await toast.promise(registrarEnvioContabilidadeRescisaoAction(companyId, rescisaoId), {
        loading: 'Registrando o envio…', success: 'Envio registrado. Seguiu para "Aguardando contabilidade".', error: 'Não foi possível registrar.',
      })
      : await toast.promise(registrarRetornoContabilidadeRescisaoAction(companyId, rescisaoId), {
        loading: 'Registrando o retorno…', success: aposEtapa('Retorno registrado.'), error: 'Não foi possível registrar.',
      })
    setEnviando(false)
    if (!('error' in r)) router.refresh()
  }

  return (
    <div className="flex flex-col gap-4">
      {etapa === 'envio' && (
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Envie para a contabilidade a ficha do funcionário e os dados da rescisão (tipo, aviso prévio e último dia, ao lado na linha do tempo). Depois, registre o envio aqui.
        </p>
      )}
      {enviadaEm && (
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Enviada em {fmtDataHora(enviadaEm)}{enviadaPor ? ` por ${enviadaPor}` : ''}.{retornoEm ? ` Retorno em ${fmtDataHora(retornoEm)}.` : ''}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={baixarFicha} loading={gerando}>Baixar ficha em PDF</Button>
      </div>
      {etapa !== 'concluida' && (
        <Rodape>
          {etapa === 'envio'
            ? <Button type="button" onClick={() => registrar('envio')} loading={enviando}>Registrar envio</Button>
            : <Button type="button" onClick={() => registrar('retorno')} loading={enviando}>Registrar retorno da contabilidade</Button>}
        </Rodape>
      )}
    </div>
  )
}

// ── TRCT ─────────────────────────────────────────────────────────────────────

export function TrctRescisao({ companyId, rescisaoId, ultimoDia }: { companyId: string; rescisaoId: string; ultimoDia: string | null }) {
  const router = useRouter()
  const [data, setData] = useState(ultimoDia ?? hojeIso())
  const [trct, setTrct] = useState<File | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function registrar() {
    if (!data) { toast.error('Informe a data do desligamento.'); return }
    if (!trct) { toast.error('Anexe o TRCT assinado.'); return }
    const fd = new FormData()
    fd.set('data_desligamento', data)
    fd.set('trct', trct)
    setEnviando(true)
    const r = await toast.promise(assinarTrctAction(companyId, rescisaoId, fd), {
      loading: 'Registrando o TRCT…',
      success: aposEtapa('TRCT registrado.'),
      error: 'Não foi possível registrar o TRCT.',
    })
    setEnviando(false)
    if (!('error' in r)) router.refresh()
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Anexe o TRCT assinado e confirme a data do desligamento. O TRCT fica nos arquivos do funcionário.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
        <Input label="Data do desligamento *" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>TRCT assinado *</span>
          <FileDropZone file={trct} onFile={setTrct} maxBytes={CONTRATO_MAX_BYTES} accept={ARQUIVOS_ACEITOS} hint="PDF, JPG ou PNG" />
        </div>
      </div>
      <Rodape><Button type="button" onClick={registrar} loading={enviando}>Anexar TRCT</Button></Rodape>
    </div>
  )
}
