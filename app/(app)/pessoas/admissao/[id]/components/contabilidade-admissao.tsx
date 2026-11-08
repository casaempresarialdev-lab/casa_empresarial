'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Icon } from '@/components/ui/icon'
import { toast } from '@/lib/toast'
import { CONTRATO_MAX_BYTES, GUIA_TIPOS, fmtDataHora } from '@/lib/validations/admissao'
import { finalizarAdmissaoAction, registrarEnvioContabilidadeAction, registrarRetornoContabilidadeAction } from '../../actions'
import { getEmployeeDocUrlAction } from '../../../funcionarios/actions'
import { ARQUIVOS } from '../../../funcionarios/components/ficha/ficha-config'
import { baixarFichaPdf } from '../../../funcionarios/components/ficha/baixar-ficha-pdf'
import type { Employee } from '../../../funcionarios/queries'
import type { CompanyBenefit } from '../../../beneficios/queries'
import type { Company } from '../../../../empresa/queries'

const hojeIso = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())

// Contabilidade externa: a ficha e os documentos são baixados aqui e enviados por fora; o sistema registra o envio e o retorno
export function ContabilidadeAdmissao({ employee, company, benefits, fotoUrl, etapa, companyId }: {
  /** Cadastro completo (com os benefícios), para a ficha em PDF */
  employee: Employee
  company: Company | null
  benefits: CompanyBenefit[]
  fotoUrl: string | null
  /** envio: falta enviar; aguardando: enviada, sem retorno; concluida: já passou desta fase */
  etapa: 'envio' | 'aguardando' | 'concluida'
  companyId: string
}) {
  const router = useRouter()
  const [gerando, setGerando] = useState(false)
  const [baixando, setBaixando] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const documentos = ARQUIVOS.filter((a) => a.key !== 'contrato' && employee[a.col])
  const faltando = ARQUIVOS.filter((a) => !['contrato', 'pis', 'titulo_eleitor', 'certidao', 'rg_verso'].includes(a.key) && !employee[a.col])

  async function baixarFicha() {
    setGerando(true)
    try {
      await baixarFichaPdf({ employee, company, benefits, fotoUrl })
    } catch {
      toast.error('Não foi possível gerar o PDF da ficha.')
    } finally {
      setGerando(false)
    }
  }

  async function baixarDoc(a: (typeof ARQUIVOS)[number]) {
    const path = employee[a.col] as string
    setBaixando(a.key)
    const r = await getEmployeeDocUrlAction(employee.id, a.key, `${a.label} - ${employee.nome}.${path.split('.').pop() ?? 'pdf'}`)
    setBaixando(null)
    if (r.error || !r.url) { toast.error(r.error ?? 'Não foi possível baixar o arquivo.'); return }
    window.location.href = r.url
  }

  async function registrar(acao: 'envio' | 'retorno') {
    setEnviando(true)
    const r = await toast.promise(
      acao === 'envio' ? registrarEnvioContabilidadeAction(companyId, employee.id) : registrarRetornoContabilidadeAction(companyId, employee.id),
      acao === 'envio'
        ? { loading: 'Registrando o envio…', success: 'Envio registrado. O card seguiu para "Aguardando contabilidade".', error: 'Não foi possível registrar.' }
        : {
            loading: 'Registrando o retorno…',
            success: (res) => 'finalizado' in res && res.finalizado
              ? `Retorno registrado. Admissão concluída: a pessoa entrou na Equipe.${'acesso' in res && res.acesso ? ` ${res.acesso}` : ''}`
              : `Retorno registrado. O card seguiu para "${'proxima' in res ? res.proxima : ''}".`,
            error: 'Não foi possível registrar.',
          },
    )
    setEnviando(false)
    if (!('error' in r)) router.refresh()
  }

  return (
    <div className="flex flex-col gap-4">
      {etapa === 'envio' && (
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Baixe a ficha e os documentos e envie para a contabilidade. Depois, registre o envio aqui.
        </p>
      )}
      {employee.admissao_contabilidade_enviada_em && (
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Enviada em {fmtDataHora(employee.admissao_contabilidade_enviada_em)}
          {employee.admissao_contabilidade_enviada_por ? ` por ${employee.admissao_contabilidade_enviada_por}` : ''}
          {employee.admissao_contabilidade_retorno_em ? ` · retorno em ${fmtDataHora(employee.admissao_contabilidade_retorno_em)}` : ' · aguardando o retorno'}
        </p>
      )}

      {/* Ficha */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3" style={{ borderColor: 'var(--color-card-border)' }}>
        <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}>
          <Icon name="file" size={18} />
        </span>
        <div className="flex-1 min-w-[180px]">
          <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Ficha de admissão (PDF)</p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Dados pessoais, contratação, benefícios e banco.</p>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={baixarFicha} loading={gerando}>
          <Icon name="download" size={15} /> Baixar ficha
        </Button>
      </div>

      {/* Documentos */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Documentos</span>
        {documentos.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Nenhum documento anexado.</p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {documentos.map((a) => (
              <li key={a.key} className="flex items-center gap-2 rounded-lg border px-3 py-2" style={{ borderColor: 'var(--color-card-border)' }}>
                <span style={{ color: '#15803D' }}><Icon name="check" size={16} /></span>
                <span className="text-sm flex-1 min-w-0 truncate" style={{ color: 'var(--color-text-primary)' }}>{a.label}</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => baixarDoc(a)} loading={baixando === a.key}>Baixar</Button>
              </li>
            ))}
          </ul>
        )}
        {etapa === 'envio' && faltando.length > 0 && (
          <p className="text-xs" style={{ color: '#B45309' }}>
            Sem anexo: {faltando.map((a) => a.label).join(', ')}. Se a contabilidade precisar, anexe em &quot;Dados cadastrais&quot;.
          </p>
        )}
      </div>

      {etapa !== 'concluida' && (
        <div className="flex justify-end border-t pt-4" style={{ borderColor: 'var(--color-card-border)' }}>
          {etapa === 'envio'
            ? <Button type="button" onClick={() => registrar('envio')} loading={enviando}>Registrar envio à contabilidade</Button>
            : <Button type="button" onClick={() => registrar('retorno')} loading={enviando}>Registrar retorno da contabilidade</Button>}
        </div>
      )}
    </div>
  )
}

// Última etapa: o contrato assinado é anexado e a pessoa entra na Equipe
export function ContratoAdmissao({ employee, dataInicio, companyId, onFinalizado }: {
  employee: Employee
  /** Data de início da carta proposta, quando houver */
  dataInicio: string | null
  companyId: string
  onFinalizado: () => void
}) {
  const arquivoRef = useRef<HTMLInputElement>(null)
  const [data, setData] = useState(employee.data_admissao ?? dataInicio ?? hojeIso())
  const [contrato, setContrato] = useState<File | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  function escolher(f: File | undefined) {
    if (!f) return
    if (!GUIA_TIPOS.includes(f.type)) { toast.error('O contrato precisa ser PDF, JPG ou PNG.'); return }
    if (f.size > CONTRATO_MAX_BYTES) { toast.error('O contrato pode ter até 20 MB.'); return }
    setContrato(f)
    setErro(null)
  }

  async function finalizar() {
    if (!contrato) { setErro('Anexe o contrato assinado'); return }
    if (!data) { toast.error('Informe a data de admissão.'); return }
    const fd = new FormData()
    fd.append('contrato', contrato)
    fd.append('data_admissao', data)
    setEnviando(true)
    const r = await toast.promise(finalizarAdmissaoAction(companyId, employee.id, fd), {
      loading: 'Registrando o contrato…',
      success: (res) => !('finalizado' in res) ? 'Contrato registrado.'
        : res.finalizado ? `${employee.nome} entrou na Equipe.${res.vagaEncerrada ? ` Vaga "${res.vagaEncerrada}" encerrada.` : ''}${res.acesso ? ` ${res.acesso}` : ''}`
        : `Contrato registrado. O card seguiu para "${res.proxima}".`,
      error: 'Não foi possível registrar o contrato.',
    })
    setEnviando(false)
    if (!('error' in r)) onFinalizado()
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
        Anexe o contrato assinado e confirme a data de admissão. O contrato fica nos documentos do funcionário.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
        <Input label="Data de admissão *" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Contrato assinado *</span>
          {contrato ? (
            <div className="h-10 flex items-center gap-2 rounded-lg border px-3 text-sm min-w-0" style={{ borderColor: 'var(--color-card-border)', backgroundColor: '#fff' }}>
              <span style={{ color: 'var(--color-brand)' }}><Icon name="file" size={16} /></span>
              <span className="truncate flex-1 min-w-0" style={{ color: 'var(--color-text-primary)' }}>{contrato.name}</span>
              <Button type="button" variant="ghost" size="sm" onClick={() => setContrato(null)} style={{ color: '#B91C1C' }}>Remover</Button>
            </div>
          ) : (
            <div>
              <Button type="button" variant="secondary" onClick={() => arquivoRef.current?.click()}>Anexar contrato</Button>
            </div>
          )}
          <input ref={arquivoRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => { escolher(e.target.files?.[0]); e.target.value = '' }} />
          {erro
            ? <p className="text-xs" style={{ color: 'var(--color-error)' }}>{erro}</p>
            : <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>PDF, JPG ou PNG, até 20 MB.</p>}
        </div>
      </div>
      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
        {employee.tipo_contrato === 'clt'
          ? 'A pessoa entra na Equipe em experiência, com o período e as férias calculados a partir desta data.'
          : 'A pessoa entra na Equipe como ativa.'}
      </p>
      <div className="flex justify-end border-t pt-4" style={{ borderColor: 'var(--color-card-border)' }}>
        <Button type="button" onClick={finalizar} loading={enviando}>Anexar contrato e finalizar</Button>
      </div>
    </div>
  )
}
