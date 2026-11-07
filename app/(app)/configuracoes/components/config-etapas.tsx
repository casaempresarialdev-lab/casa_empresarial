'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Accordion } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { toast } from '@/lib/toast'
import { ETAPA_LABEL_MAX, PREFIXO_PERSONALIZADA, posicoesValidas as posicoesDe, temEtapaAtiva, type DefProcesso, type Etapa } from '@/lib/etapas-processo'
import { DEF_ADMISSAO } from '../../pessoas/admissao/etapas'
import { DEF_RESCISAO } from '../../pessoas/rescisao/etapas'
import { salvarEtapasAdmissaoAction, salvarEtapasRescisaoAction } from '../actions'

const inserir = (lista: Etapa[], i: number, e: Etapa) => [...lista.slice(0, i), e, ...lista.slice(i)]

const PROCESSOS: Record<'admissao' | 'rescisao', {
  def: DefProcesso
  salvar: typeof salvarEtapasAdmissaoAction
  sucesso: string
  quem: string
  exemplo: string
}> = {
  admissao: { def: DEF_ADMISSAO, salvar: salvarEtapasAdmissaoAction, sucesso: 'Etapas da admissão salvas.', quem: 'candidatos', exemplo: 'Ex.: Integração com a equipe' },
  rescisao: { def: DEF_RESCISAO, salvar: salvarEtapasRescisaoAction, sucesso: 'Etapas da rescisão salvas.', quem: 'pessoas', exemplo: 'Ex.: Devolução de equipamentos' },
}

// Etapas de um processo (admissão ou rescisão): as padrão com cadeado (só ativam ou inativam), as personalizadas livres
export function ConfigEtapas({ companyId, inicial, processo = 'admissao' }: { companyId: string; inicial: Etapa[]; processo?: 'admissao' | 'rescisao' }) {
  const { def, salvar: salvarAction, sucesso, quem, exemplo } = PROCESSOS[processo]
  const ETAPA_FINAL = def.final
  const posicoesValidas = (lista: Etapa[]) => posicoesDe(def, lista)
  const router = useRouter()
  const [aberta, setAberta] = useState(false)
  const [etapas, setEtapas] = useState(inicial)
  const [salvando, setSalvando] = useState(false)

  // Nova etapa: nome e posição (índice do item antes do qual ela entra)
  const [novaNome, setNovaNome] = useState('')
  const [novaPosicao, setNovaPosicao] = useState(() => String(inicial.findIndex((e) => e.key === ETAPA_FINAL)))

  const alterado = JSON.stringify(etapas) !== JSON.stringify(inicial)
  const ativas = etapas.filter((e) => e.ativo && e.key !== ETAPA_FINAL)
  const personalizadas = etapas.filter((e) => !e.padrao).length

  function alternarAtivo(key: string) {
    setEtapas((lista) => {
      const ativo = !lista.find((e) => e.key === key)!.ativo
      // A etapa do par acompanha a dona
      return lista.map((e) => (e.key === key || def.vinculadaA[e.key] === key ? { ...e, ativo } : e))
    })
  }

  function renomear(key: string, label: string) {
    setEtapas((lista) => lista.map((e) => (e.key === key ? { ...e, label: label.slice(0, ETAPA_LABEL_MAX) } : e)))
  }

  function excluir(key: string) {
    setEtapas((lista) => lista.filter((e) => e.key !== key))
  }

  /** Sobe ou desce uma posição válida (pula os pares, que não se separam) */
  function mover(key: string, direcao: -1 | 1) {
    setEtapas((lista) => {
      const i = lista.findIndex((e) => e.key === key)
      const sem = lista.filter((e) => e.key !== key)
      const validas = posicoesValidas(sem)
      const atual = validas.indexOf(i)
      const destino = validas[atual + direcao]
      return destino === undefined ? lista : inserir(sem, destino, lista[i])
    })
  }

  function adicionar() {
    const label = novaNome.trim()
    if (!label) { toast.error('Dê um nome à etapa.'); return }
    if (etapas.some((e) => e.label.toLocaleLowerCase('pt-BR') === label.toLocaleLowerCase('pt-BR'))) { toast.error('Já existe uma etapa com esse nome.'); return }
    const nova: Etapa = { key: `${PREFIXO_PERSONALIZADA}${crypto.randomUUID().slice(0, 8)}`, label, padrao: false, ativo: true }
    setEtapas((lista) => inserir(lista, Number(posicao), nova))
    setNovaNome('')
    // A próxima entra logo depois desta, na mesma região
    setNovaPosicao(String(Number(posicao) + 1))
  }

  async function salvar() {
    if (etapas.some((e) => !e.padrao && !e.label.trim())) { toast.error('Dê um nome a cada etapa personalizada.'); return }
    if (!temEtapaAtiva(def, etapas)) { toast.error('Deixe pelo menos uma etapa ativa antes de "Finalizado".'); return }
    setSalvando(true)
    const r = await toast.promise(salvarAction(companyId, etapas.map(({ key, label, ativo }) => ({ key, label, ativo }))), {
      loading: 'Salvando as etapas…',
      success: sucesso,
      error: 'Não foi possível salvar.',
    })
    setSalvando(false)
    if ('error' in r) return
    setEtapas((lista) => lista.map((e) => ({ ...e, label: e.label.trim() })))
    router.refresh()
  }

  const opcoesPosicao = posicoesValidas(etapas).map((i) => ({ value: String(i), label: `Antes de "${etapas[i].label}"` }))
  // Lista mudou (ex.: etapa excluída) e a posição escolhida deixou de valer: volta para antes de "Finalizado"
  const posicao = opcoesPosicao.some((o) => o.value === novaPosicao) ? novaPosicao : opcoesPosicao.at(-1)!.value

  return (
    <Accordion
      titulo="Etapas do processo"
      icone="grid"
      resumo={`${ativas.length} ${ativas.length === 1 ? 'etapa ativa' : 'etapas ativas'}${personalizadas ? ` · ${personalizadas} ${personalizadas === 1 ? 'personalizada' : 'personalizadas'}` : ''}`}
      aberto={aberta}
      onAlternar={() => setAberta((a) => !a)}
    >
      <div className="flex flex-col gap-5">
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          As etapas padrão (com cadeado) têm ordem fixa e podem só ser ativadas ou inativadas. Etapas personalizadas são de controle
          interno: não têm integração, só um campo de anotações e o botão para avançar. Uma etapa inativa deixa de receber {quem};
          quem já está nela continua aparecendo no kanban até sair.
        </p>

        <ol className="flex flex-col gap-2">
          {etapas.map((e, i) => {
            const vinculada = def.vinculadaA[e.key]
            const obrigatoria = e.key === ETAPA_FINAL
            const validas = e.padrao ? [] : posicoesValidas(etapas.filter((x) => x.key !== e.key))
            const pos = validas.indexOf(i)
            return (
              <li
                key={e.key}
                className="flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3"
                style={{
                  borderColor: e.padrao ? 'var(--color-card-border)' : 'var(--color-brand)',
                  backgroundColor: e.padrao ? (e.ativo ? '#fff' : '#F9FAFB') : 'var(--color-brand-light)',
                }}
              >
                <span className="w-6 text-xs font-semibold text-center shrink-0" style={{ color: 'var(--color-text-muted)' }}>{i + 1}</span>
                {e.padrao ? (
                  <>
                    <span className="shrink-0" style={{ color: 'var(--color-text-muted)' }} title="Etapa padrão: não pode ser alterada">
                      <Icon name="lock" size={16} />
                    </span>
                    <div className="flex-1 min-w-[180px]">
                      <p className="text-sm font-semibold" style={{ color: e.ativo ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>{e.label}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                        {def.descricao[e.key]}
                      </p>
                    </div>
                    {obrigatoria ? (
                      <span className="text-xs font-medium shrink-0" style={{ color: 'var(--color-text-muted)' }}>Sempre ativa</span>
                    ) : (
                      // Sem <label> em volta: o clique no botão contaria duas vezes e o estado não mudaria
                      <span className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={e.ativo}
                          aria-label={`${e.ativo ? 'Inativar' : 'Ativar'} "${e.label}"`}
                          // Etapa de um par: o interruptor vale para as duas
                          onClick={() => alternarAtivo(vinculada ?? e.key)}
                          className="relative inline-block w-10 h-6 p-0 rounded-full transition-colors shrink-0 cursor-pointer"
                          style={{ backgroundColor: e.ativo ? 'var(--color-brand)' : '#D1D5DB' }}
                        >
                          <span className={`absolute left-0 top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${e.ativo ? 'translate-x-5' : 'translate-x-1'}`} />
                        </button>
                        <span className="text-xs font-medium w-12" style={{ color: 'var(--color-text-secondary)' }}>{e.ativo ? 'Ativa' : 'Inativa'}</span>
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: '#fff', color: 'var(--color-brand)' }}>Personalizada</span>
                    <div className="flex-1 min-w-[180px]">
                      <Input aria-label="Nome da etapa" value={e.label} maxLength={ETAPA_LABEL_MAX} onChange={(ev) => renomear(e.key, ev.target.value)} />
                    </div>
                    <span className="flex items-center gap-0.5 shrink-0">
                      <button type="button" onClick={() => mover(e.key, -1)} disabled={pos <= 0} aria-label={`Subir "${e.label}"`} title="Subir"
                        className="p-2 rounded-lg text-sm leading-none hover:bg-white disabled:opacity-30" style={{ color: 'var(--color-sidebar-text)' }}>↑</button>
                      <button type="button" onClick={() => mover(e.key, 1)} disabled={pos < 0 || pos >= validas.length - 1} aria-label={`Descer "${e.label}"`} title="Descer"
                        className="p-2 rounded-lg text-sm leading-none hover:bg-white disabled:opacity-30" style={{ color: 'var(--color-sidebar-text)' }}>↓</button>
                      <IconButton icon="trash" label={`Excluir "${e.label}"`} tone="danger" onClick={() => excluir(e.key)} />
                    </span>
                  </>
                )}
              </li>
            )
          })}
        </ol>

        {/* Nova etapa personalizada */}
        <div className="flex flex-col gap-3 rounded-xl border border-dashed p-4" style={{ borderColor: 'var(--color-card-border)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Adicionar etapa personalizada</p>
          <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-3 items-end">
            <Input
              label="Nome da etapa"
              placeholder={exemplo}
              value={novaNome}
              maxLength={ETAPA_LABEL_MAX}
              onChange={(ev) => setNovaNome(ev.target.value)}
              onKeyDown={(ev) => { if (ev.key === 'Enter') { ev.preventDefault(); adicionar() } }}
            />
            <Select label="Posição" options={opcoesPosicao} value={posicao} onChange={(ev) => setNovaPosicao(ev.target.value)} />
            <Button type="button" variant="secondary" onClick={adicionar}>Adicionar</Button>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          {alterado && <Button type="button" variant="secondary" onClick={() => setEtapas(inicial)} disabled={salvando}>Desfazer alterações</Button>}
          <Button type="button" onClick={salvar} loading={salvando} disabled={!alterado}>Salvar etapas</Button>
        </div>
      </div>
    </Accordion>
  )
}
