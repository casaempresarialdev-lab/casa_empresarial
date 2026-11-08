'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ListItem, ListEmpty } from '@/components/ui/list-item'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { FileViewer, triggerDownload } from '@/components/ui/file-viewer'
import { MultiSelectFilter } from '@/components/ui/multi-select-filter'
import { FilterResult, SearchField } from '@/components/ui/filter-select'
import { toast } from '@/lib/toast'
import { avaliarCandidaturaAction, excluirCandidaturaAction, getAnexoCandidaturaUrlAction, getHistoricoCandidaturaAction, iniciarAdmissaoAction } from '../actions'
import { ListaAnotacoes, ListaEntrevistas } from '../../admissao/components/historico-admissao'
import type { Historico } from '../../admissao/queries'
import type { Candidatura } from '../queries'
import { fmtDate, iniciais, maskCpf, maskTelefone } from '../../funcionarios/components/ficha/ficha-config'
import { CANDIDATURA_STATUS, Selo } from './vaga-config'

interface Props {
  candidaturas: Candidatura[]
  companyId: string
  /** Vaga encerrada: só consulta, baixar e excluir dados */
  encerrada?: boolean
  /** Configurações: a reprovação avisa o candidato por e-mail */
  avisaReprovacao?: boolean
}

export function CandidaturasLista({ candidaturas, companyId, encerrada = false, avisaReprovacao = false }: Props) {
  const router = useRouter()
  const [filtro, setFiltro] = useState<string[]>([])
  const [busca, setBusca] = useState('')
  const [ver, setVer] = useState<Candidatura | null>(null)
  const [baixando, setBaixando] = useState<string | null>(null)
  const [iniciar, setIniciar] = useState<Candidatura | null>(null)
  const [historico, setHistorico] = useState<(Historico & { nome: string; motivo: string | null }) | null>(null)
  const [reprovar, setReprovar] = useState<Candidatura | null>(null)
  const [motivo, setMotivo] = useState('')
  const [excluir, setExcluir] = useState<Candidatura | null>(null)
  const [processando, setProcessando] = useState(false)

  const contar = (s: string) => candidaturas.filter((c) => c.status === s).length
  const opcoesStatus = Object.entries(CANDIDATURA_STATUS).map(([value, cfg]) => ({ value, label: cfg.label, count: contar(value) }))
  const resumoStatus =
    filtro.length === 0 || filtro.length === opcoesStatus.length ? 'Todos os status'
    : filtro.length === 1 ? CANDIDATURA_STATUS[filtro[0]].label
    : `${filtro.length} status`
  const filtrando = filtro.length > 0 || !!busca
  const subtitulo = [
    contar('nova') ? `${contar('nova')} para avaliar` : null,
    contar('selecionada') ? `${contar('selecionada')} em admissão` : null,
    contar('reprovada') ? `${contar('reprovada')} ${contar('reprovada') === 1 ? 'reprovada' : 'reprovadas'}` : null,
  ].filter(Boolean).join(' · ')

  const q = busca.toLowerCase()
  const digitos = q.replace(/\D/g, '')
  const linhas = candidaturas
    .filter((c) => filtro.length === 0 || filtro.includes(c.status))
    .filter((c) => !q || c.nome.toLowerCase().includes(q) || c.email.includes(q) || (!!digitos && ((c.cpf ?? '').includes(digitos) || c.telefone.replace(/\D/g, '').includes(digitos))))

  async function baixar(id: string, nome: string) {
    setBaixando(id)
    const r = await getAnexoCandidaturaUrlAction(id, companyId, true)
    setBaixando(null)
    if (r.error || !r.url) { toast.error(r.error ?? 'Não foi possível baixar o anexo.'); return }
    triggerDownload(r.url, nome)
  }

  async function abrirHistorico(c: Candidatura) {
    const r = await getHistoricoCandidaturaAction(c.id, companyId)
    if ('error' in r) { toast.error(r.error ?? 'Não foi possível abrir o histórico.'); return }
    setHistorico({ nome: c.nome, motivo: c.motivo, ...r.historico })
  }

  async function confirmarIniciar() {
    const c = iniciar
    if (!c) return
    setProcessando(true)
    const r = await toast.promise(iniciarAdmissaoAction(c.id, companyId), {
      loading: `Iniciando a admissão de ${c.nome}…`,
      success: `${c.nome} entrou no kanban de admissão.`,
      error: 'Não foi possível iniciar a admissão.',
    })
    setProcessando(false)
    setIniciar(null)
    if (!('error' in r)) router.refresh()
  }

  async function confirmarReprovar() {
    const c = reprovar
    if (!c) return
    setProcessando(true)
    const r = await toast.promise(avaliarCandidaturaAction(c.id, companyId, 'reprovada', motivo), {
      loading: `Reprovando ${c.nome}…`,
      success: `${c.nome} foi reprovado nesta vaga.`,
      error: 'Não foi possível reprovar.',
    })
    setProcessando(false)
    setReprovar(null)
    setMotivo('')
    if ('error' in r) return
    if (r.avisoFalhou) toast.error('O e-mail de reprovação não foi enviado. Avise o candidato por outro meio.')
    router.refresh()
  }

  async function voltarParaNovas(c: Candidatura) {
    const r = await toast.promise(avaliarCandidaturaAction(c.id, companyId, 'nova'), {
      loading: 'Atualizando…',
      success: `${c.nome} voltou para as candidaturas novas.`,
      error: 'Não foi possível atualizar.',
    })
    if (!('error' in r)) router.refresh()
  }

  async function confirmarExcluir() {
    const c = excluir
    if (!c) return
    setProcessando(true)
    const r = await toast.promise(excluirCandidaturaAction(c.id, companyId), {
      loading: `Excluindo os dados de ${c.nome}…`,
      success: 'Candidatura e anexo excluídos.',
      error: 'Não foi possível excluir.',
    })
    setProcessando(false)
    setExcluir(null)
    if (!('error' in r)) router.refresh()
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
          {candidaturas.length === 0 ? 'Nenhuma candidatura' : `${candidaturas.length} ${candidaturas.length === 1 ? 'candidatura' : 'candidaturas'}`}
        </h2>
        <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
          {encerrada
            ? 'Vaga encerrada: os dados ficam disponíveis até o prazo de guarda de 12 meses.'
            : subtitulo || (candidaturas.length === 0 ? 'Compartilhe o link da vaga para receber candidaturas.' : 'Nada para avaliar no momento.')}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <MultiSelectFilter
          label="Filtrar por status"
          options={opcoesStatus}
          value={filtro}
          onChange={setFiltro}
          summary={resumoStatus}
          highlighted={filtro.length > 0}
        />
        <SearchField value={busca} onChange={setBusca} placeholder="Pesquisar por nome, CPF, e-mail ou telefone..." />
        {filtrando && <FilterResult total={linhas.length} onClear={() => { setFiltro([]); setBusca('') }} />}
      </div>

      <ul className="flex flex-col gap-3">
        {linhas.length === 0 && (
          <ListEmpty>{candidaturas.length === 0 ? 'Nenhuma candidatura recebida ainda. Compartilhe o link da vaga.' : 'Nenhuma candidatura encontrada para esse filtro.'}</ListEmpty>
        )}
        {linhas.map((c) => (
          <ListItem
            key={c.id}
            media={
              <span
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}
              >
                {iniciais(c.nome)}
              </span>
            }
            title={c.nome}
            subtitle={[c.cpf ? `CPF ${maskCpf(c.cpf)}` : null, c.email, maskTelefone(c.telefone), `Recebida em ${fmtDate(c.created_at)}`].filter(Boolean).join(' · ')}
            onClick={c.anexo_nome ? () => setVer(c) : undefined}
            aside={
              <>
                {!encerrada && c.status === 'nova' && (
                  <Button type="button" variant="secondary" size="sm" onClick={() => setIniciar(c)}>Iniciar admissão</Button>
                )}
                <Selo cfg={CANDIDATURA_STATUS[c.status]} />
              </>
            }
            actionsLabel={c.nome}
            actions={[
              ...(c.status === 'selecionada' ? [{ icon: 'users' as const, label: 'Ver no kanban', onClick: () => router.push('/pessoas/admissao') }] : []),
              ...(c.status !== 'nova' ? [{ icon: 'info' as const, label: 'Ver histórico', onClick: () => abrirHistorico(c) }] : []),
              ...(c.anexo_nome ? [
                { icon: 'eye' as const, label: 'Ver currículo', onClick: () => setVer(c) },
                { icon: 'download' as const, label: 'Baixar currículo', onClick: () => baixar(c.id, c.anexo_nome ?? ''), disabled: baixando === c.id },
              ] : []),
              { icon: 'mail', label: 'Enviar e-mail', onClick: () => { window.location.href = `mailto:${c.email}` } },
              ...(!encerrada && c.status === 'nova' ? [{ icon: 'trash' as const, label: 'Reprovar', onClick: () => setReprovar(c) }] : []),
              ...(!encerrada && c.status === 'reprovada' ? [{ icon: 'check' as const, label: 'Voltar para novas', onClick: () => voltarParaNovas(c) }] : []),
              { icon: 'trash', label: c.status === 'selecionada' ? 'Excluir (em admissão)' : 'Excluir dados', tone: 'danger', onClick: () => setExcluir(c), disabled: c.status === 'selecionada' },
            ]}
          />
        ))}
      </ul>

      <FileViewer
        file={ver && { id: ver.id, titulo: ver.nome, nome: ver.anexo_nome ?? '', tipo: ver.anexo_tipo }}
        getUrl={(id) => getAnexoCandidaturaUrlAction(id, companyId)}
        onClose={() => setVer(null)}
        onDownload={(f) => baixar(f.id, f.nome)}
        downloading={!!ver && baixando === ver.id}
      />

      <Modal open={!!reprovar} onClose={() => { if (!processando) { setReprovar(null); setMotivo('') } }} title={`Reprovar ${reprovar?.nome ?? ''}`}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="motivo" className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Motivo (opcional)</label>
            <textarea
              id="motivo"
              rows={3}
              maxLength={1000}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Fica registrado na candidatura, só para a empresa."
              className="w-full rounded-lg border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
              style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', backgroundColor: '#fff' }}
            />
            {avisaReprovacao && (
              <p className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>O candidato recebe o e-mail de reprovação das Configurações.</p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => { setReprovar(null); setMotivo('') }} disabled={processando}>Cancelar</Button>
            <Button type="button" variant="danger" onClick={confirmarReprovar} loading={processando}>Reprovar</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!historico} onClose={() => setHistorico(null)} title={`Histórico de ${historico?.nome ?? ''}`} className="sm:max-w-2xl">
        <div className="flex flex-col gap-5">
          {historico?.motivo && (
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}><strong>Motivo:</strong> {historico.motivo}</p>
          )}
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>Entrevistas</h3>
            <ListaEntrevistas entrevistas={historico?.entrevistas ?? []} />
          </section>
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>Anotações</h3>
            <ListaAnotacoes anotacoes={historico?.anotacoes ?? []} />
          </section>
          <div className="flex justify-end">
            <Button type="button" onClick={() => setHistorico(null)}>Fechar</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!iniciar} onClose={() => { if (!processando) setIniciar(null) }} title={`Iniciar admissão de ${iniciar?.nome ?? ''}`}>
        <div className="flex flex-col gap-4">
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            O candidato entra no kanban de admissão, em &quot;Realizar entrevista&quot;, com os dados da candidatura e da vaga.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setIniciar(null)} disabled={processando}>Cancelar</Button>
            <Button type="button" onClick={confirmarIniciar} loading={processando}>Iniciar admissão</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!excluir}
        onClose={() => { if (!processando) setExcluir(null) }}
        onConfirm={confirmarExcluir}
        loading={processando}
        confirmLabel="Excluir dados"
        title="Excluir dados do candidato"
        message={<p>Excluir a candidatura e o anexo de <strong>{excluir?.nome}</strong>? Esta ação não pode ser desfeita.</p>}
      />
    </div>
  )
}
