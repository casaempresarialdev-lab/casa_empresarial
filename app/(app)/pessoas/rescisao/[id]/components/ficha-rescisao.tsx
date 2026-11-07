'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { Accordion } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/toast'
import { fmtDataHora } from '@/lib/validations/admissao'
import { iniciais, isPjOuAutonomo, maskCpf, tipoLabel } from '../../../funcionarios/components/ficha/ficha-config'
import { TimelineAdmissao } from '../../../admissao/[id]/components/timeline-admissao'
import { EtapaPersonalizada } from '../../../admissao/[id]/components/etapa-personalizada'
import { adicionarAnotacaoRescisaoAction, avancarEtapaPersonalizadaRescisaoAction, cancelarRescisaoAction } from '../../actions'
import {
  R_AGUARDAR_CONTABILIDADE, R_AVISO, R_CONTABILIDADE, R_EXAME, R_FINAL, R_RETORNO_EXAME, R_TRCT,
  indiceEtapa, isPersonalizada, labelEtapa, modalidadeAvisoLabel, proximaEtapaRescisao, tipoDesligamentoLabel,
} from '../../etapas'
import { AvisoPrevio, ContabilidadeRescisao, ExameRescisao, RetornoExame, TrctRescisao } from './etapas-rescisao'
import type { ConfigRescisao, Rescisao } from '../../queries'
import type { Anotacao, Clinica, Exame } from '../../../admissao/queries'
import type { Employee } from '../../../funcionarios/queries'
import type { CompanyBenefit } from '../../../beneficios/queries'
import type { Company } from '../../../../empresa/queries'

const fmtData = (d: string) => d.split('-').reverse().join('/')

interface Props {
  rescisao: Rescisao
  config: ConfigRescisao
  anotacoes: Anotacao[]
  exames: Exame[]
  clinicas: Clinica[]
  ficha: Employee
  company: Company | null
  benefits: CompanyBenefit[]
  fotoUrl: string | null
  companyId: string
}

// Ficha da rescisão. À esquerda, as etapas em sanfona: a atual e as que já têm dados. À direita, a linha do tempo.
export function FichaRescisao({ rescisao: r, config, anotacoes, exames, clinicas, ficha, company, benefits, fotoUrl, companyId }: Props) {
  const router = useRouter()
  const [cancelando, setCancelando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [processando, setProcessando] = useState(false)

  const etapas = config.etapas
  const pj = isPjOuAutonomo(r.employee.tipo_contrato)
  const andamento = r.status === 'em_andamento'
  // Fora de andamento (finalizada ou cancelada): só consulta
  const atual = andamento ? (indiceEtapa(etapas, r.etapa) >= 0 ? r.etapa : etapas[0].key) : R_FINAL
  const idxAtual = indiceEtapa(etapas, atual)
  const passou = (key: string) => idxAtual > indiceEtapa(etapas, key)
  const na = (key: string) => andamento && atual === key

  const [alternadas, setAlternadas] = useState<Record<string, boolean>>({})
  const secaoAtual = na(R_EXAME) ? 'exame' : na(R_CONTABILIDADE) || na(R_AGUARDAR_CONTABILIDADE) ? 'contabilidade' : atual
  const estaAberta = (id: string) => alternadas[id] ?? id === secaoAtual
  const alternar = (id: string) => setAlternadas((a) => ({ ...a, [id]: !estaAberta(id) }))
  const seloAtual = <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}>Etapa atual</span>

  const proxima = proximaEtapaRescisao(etapas, atual, pj)
  const exameAtual = exames.find((e) => e.status !== 'substituido')

  async function cancelar() {
    setProcessando(true)
    const res = await toast.promise(cancelarRescisaoAction(companyId, r.id, motivo), {
      loading: 'Cancelando a rescisão…',
      success: `Rescisão cancelada. ${r.employee.nome} continua na Equipe.`,
      error: 'Não foi possível cancelar.',
    })
    setProcessando(false)
    if ('error' in res) return
    router.push('/pessoas/rescisao')
  }

  const dados = [
    tipoDesligamentoLabel(r.tipo),
    r.employee.tipo_contrato ? tipoLabel(r.employee.tipo_contrato) : null,
    r.employee.cargo || r.employee.servico,
    ficha.cpf ? `CPF ${maskCpf(ficha.cpf)}` : null,
    r.employee.data_admissao ? `Admissão em ${fmtData(r.employee.data_admissao)}` : null,
  ].filter(Boolean)

  const situacao = r.status === 'finalizada'
    ? { texto: `Rescisão finalizada${r.data_desligamento ? `: desligamento em ${fmtData(r.data_desligamento)}` : ''}.`, fundo: '#DCFCE7', cor: '#15803D' }
    : r.status === 'cancelada' ? { texto: 'Rescisão cancelada. A pessoa continua na Equipe.', fundo: '#F3F4F6', cor: '#4B5563' } : null

  return (
    <div className="space-y-4">
      <button type="button" onClick={() => router.push('/pessoas/rescisao')} className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
        ← Rescisão
      </button>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>Ficha de rescisão</h1>
        <Breadcrumb current={r.employee.nome} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-4 items-start">
        <div className="flex flex-col gap-4 min-w-0">
          {/* Quem está saindo */}
          <div className="app-card p-5 flex flex-wrap items-center gap-4">
            <span className="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center shrink-0 text-base font-bold" style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {fotoUrl ? <img src={fotoUrl} alt={r.employee.nome} className="w-full h-full object-cover" /> : iniciais(r.employee.nome)}
            </span>
            <div className="flex-1 min-w-[220px]">
              <h2 className="text-lg font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>{r.employee.nome}</h2>
              <p className="text-sm mt-0.5 break-words" style={{ color: 'var(--color-text-muted)' }}>{dados.join(' · ')}</p>
              {r.motivo && <p className="text-sm mt-1 whitespace-pre-line" style={{ color: 'var(--color-text-secondary)' }}>Motivo: {r.motivo}</p>}
            </div>
            <Button type="button" variant="secondary" onClick={() => router.push(`/pessoas/funcionarios/${r.employee_id}`)}>Dados cadastrais</Button>
            {situacao && (
              <p className="basis-full text-sm font-medium rounded-lg px-3 py-2" style={{ backgroundColor: situacao.fundo, color: situacao.cor }}>{situacao.texto}</p>
            )}
            {andamento && (
              <div className="basis-full flex flex-wrap items-center gap-2 border-t pt-3" style={{ borderColor: 'var(--color-card-border)' }}>
                <Button type="button" variant="ghost" size="sm" onClick={() => setCancelando(true)} disabled={processando || cancelando} style={{ color: '#B91C1C' }}>Cancelar rescisão</Button>
              </div>
            )}
            {cancelando && (
              <div className="flex flex-col gap-3 rounded-xl border p-4 basis-full" style={{ borderColor: '#FCA5A5' }}>
                <div className="flex flex-col gap-1">
                  <label htmlFor="rescisao-cancelar-motivo" className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Motivo (opcional)</label>
                  <textarea id="rescisao-cancelar-motivo" rows={2} maxLength={1000} value={motivo} onChange={(e) => setMotivo(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
                    style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', backgroundColor: '#fff' }} />
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Ex.: pedido de demissão reconsiderado. O processo fica guardado como cancelado e a pessoa continua na Equipe.</p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="secondary" size="sm" onClick={() => setCancelando(false)} disabled={processando}>Voltar</Button>
                  <Button type="button" variant="danger" size="sm" onClick={cancelar} loading={processando}>Confirmar cancelamento</Button>
                </div>
              </div>
            )}
          </div>

          {/* Aviso prévio */}
          {(na(R_AVISO) || r.aviso_modalidade) && (
            <Accordion
              titulo="Aviso prévio"
              resumo={r.aviso_modalidade
                ? `${modalidadeAvisoLabel(r.aviso_modalidade)} · comunicado em ${fmtData(r.aviso_comunicacao!)} · último dia ${fmtData(r.ultimo_dia!)}`
                : 'Ainda não registrado'}
              selo={na(R_AVISO) && seloAtual}
              aberto={estaAberta(R_AVISO)}
              onAlternar={() => alternar(R_AVISO)}
            >
              {na(R_AVISO)
                ? <AvisoPrevio companyId={companyId} rescisaoId={r.id} dataAdmissao={r.employee.data_admissao} />
                : (
                  <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    {modalidadeAvisoLabel(r.aviso_modalidade)}, {r.aviso_dias} dias. Comunicado em {fmtData(r.aviso_comunicacao!)}; último dia de trabalho em {fmtData(r.ultimo_dia!)}.
                  </p>
                )}
            </Accordion>
          )}

          {/* Exame demissional: na etapa e, depois, como histórico */}
          {(na(R_EXAME) || na(R_RETORNO_EXAME) || exames.length > 0) && (
            <Accordion
              titulo="Exame demissional"
              resumo={!exameAtual ? 'Ainda não encaminhado' : exameAtual.status === 'realizado' ? `Realizado na ${exameAtual.clinica_nome}` : `Encaminhado à ${exameAtual.clinica_nome}`}
              selo={na(R_EXAME) && seloAtual}
              aberto={estaAberta('exame')}
              onAlternar={() => alternar('exame')}
            >
              <ExameRescisao exames={exames} clinicas={clinicas} emailLigado={config.exame_notificar} temEmail={!!r.employee.email} naEtapa={na(R_EXAME) || na(R_RETORNO_EXAME)} companyId={companyId} rescisaoId={r.id} />
            </Accordion>
          )}

          {na(R_RETORNO_EXAME) && (
            <Accordion titulo="Retorno do exame" selo={seloAtual} aberto={estaAberta(R_RETORNO_EXAME)} onAlternar={() => alternar(R_RETORNO_EXAME)}>
              <RetornoExame companyId={companyId} rescisaoId={r.id} temEncaminhamento={exames.some((e) => e.status === 'encaminhado')} />
            </Accordion>
          )}

          {/* Contabilidade (externa) */}
          {(na(R_CONTABILIDADE) || na(R_AGUARDAR_CONTABILIDADE) || !!r.contabilidade_enviada_em) && (
            <Accordion
              titulo="Contabilidade"
              resumo={r.contabilidade_retorno_em ? `Retorno em ${fmtDataHora(r.contabilidade_retorno_em)}` : r.contabilidade_enviada_em ? `Enviada em ${fmtDataHora(r.contabilidade_enviada_em)}` : 'Ainda não enviada'}
              selo={(na(R_CONTABILIDADE) || na(R_AGUARDAR_CONTABILIDADE)) && seloAtual}
              aberto={estaAberta('contabilidade')}
              onAlternar={() => alternar('contabilidade')}
            >
              <ContabilidadeRescisao
                etapa={na(R_CONTABILIDADE) ? 'envio' : na(R_AGUARDAR_CONTABILIDADE) ? 'aguardando' : 'concluida'}
                ficha={ficha}
                company={company}
                benefits={benefits}
                fotoUrl={fotoUrl}
                enviadaEm={r.contabilidade_enviada_em}
                enviadaPor={r.contabilidade_enviada_por}
                retornoEm={r.contabilidade_retorno_em}
                companyId={companyId}
                rescisaoId={r.id}
              />
            </Accordion>
          )}

          {/* TRCT */}
          {(na(R_TRCT) || (!!r.trct_path && passou(R_TRCT))) && (
            <Accordion
              titulo="Assinar TRCT"
              resumo={r.trct_path ? `Anexado · desligamento em ${fmtData(r.data_desligamento!)}` : undefined}
              selo={na(R_TRCT) && seloAtual}
              aberto={estaAberta(R_TRCT)}
              onAlternar={() => alternar(R_TRCT)}
            >
              {na(R_TRCT)
                ? <TrctRescisao companyId={companyId} rescisaoId={r.id} ultimoDia={r.ultimo_dia} />
                : <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>TRCT assinado nos arquivos do funcionário.</p>}
            </Accordion>
          )}

          {/* Etapa personalizada: controle interno, com anotação e o botão para avançar */}
          {andamento && isPersonalizada(atual) && (
            <Accordion titulo={labelEtapa(etapas, atual)} resumo="Etapa de controle interno" selo={seloAtual} aberto={estaAberta(atual)} onAlternar={() => alternar(atual)}>
              <EtapaPersonalizada
                companyId={companyId}
                employeeId={r.employee_id}
                proxima={labelEtapa(etapas, proxima)}
                ultima={proxima === R_FINAL}
                dataSugerida={r.data_desligamento ?? r.ultimo_dia}
                acao={(anotacao, data) => avancarEtapaPersonalizadaRescisaoAction(companyId, r.id, anotacao, data)}
                rotuloData="Data do desligamento"
                rotuloConcluir="Finalizar rescisão"
                dicaUltima="Última etapa: ao concluir, a pessoa sai da Equipe."
                concluida="Rescisão finalizada: a pessoa saiu da Equipe."
              />
            </Accordion>
          )}
        </div>

        <TimelineAdmissao
          anotacoes={anotacoes}
          iniciadaEm={r.created_at}
          employeeId={r.employee_id}
          companyId={companyId}
          inicioTexto="Processo de rescisão aberto"
          adicionar={(texto) => adicionarAnotacaoRescisaoAction(companyId, r.id, texto)}
        />
      </div>
    </div>
  )
}
