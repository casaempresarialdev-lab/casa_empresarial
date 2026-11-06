'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Icon } from '@/components/ui/icon'
import { toast } from '@/lib/toast'
import { GUIA_MAX_BYTES, GUIA_TIPOS, clinicaSchema } from '@/lib/validations/admissao'
import { excluirClinicaAction, getGuiaUrlAction, salvarClinicaAction, salvarGuiaGeralAction } from '../actions'
import type { Clinica } from '../../pessoas/admissao/queries'

const ACEITA = '.pdf,.jpg,.jpeg,.png'

/** Arquivo inválido: avisa e devolve null */
function conferirGuia(file: File | undefined) {
  if (!file) return null
  if (!GUIA_TIPOS.includes(file.type)) { toast.error('A guia precisa ser PDF, JPG ou PNG.'); return null }
  if (file.size > GUIA_MAX_BYTES) { toast.error('A guia pode ter até 4 MB.'); return null }
  return file
}

// Estes campos ficam dentro do formulário das configurações: Enter não pode salvar a página toda
const semEnter = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !(e.target instanceof HTMLTextAreaElement)) e.preventDefault() }

function useAbrirGuia(companyId: string) {
  return async (path: string) => {
    const r = await getGuiaUrlAction(companyId, path)
    if (!('url' in r) || !r.url) { toast.error(('error' in r && r.error) || 'Não foi possível abrir a guia.'); return }
    window.open(r.url, '_blank', 'noopener')
  }
}

/** Nome do arquivo com "Abrir" (quando já enviado) */
function ArquivoGuia({ nome, onAbrir, onRemover }: { nome: string; onAbrir?: () => void; onRemover?: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm min-w-0" style={{ borderColor: 'var(--color-card-border)', backgroundColor: '#fff' }}>
      <span style={{ color: 'var(--color-brand)' }}><Icon name="file" size={16} /></span>
      <span className="truncate flex-1 min-w-0" style={{ color: 'var(--color-text-primary)' }}>{nome}</span>
      {onAbrir && <Button type="button" variant="ghost" size="sm" onClick={onAbrir}>Abrir</Button>}
      {onRemover && <Button type="button" variant="ghost" size="sm" onClick={onRemover} style={{ color: '#B91C1C' }}>Remover</Button>}
    </div>
  )
}

type Campos = { nome: string; endereco: string; telefone: string; orientacoes: string }

/** Cadastro ou edição de uma clínica (sem <form>: fica dentro do formulário das configurações) */
function FormClinica({ companyId, clinica, onFechar }: { companyId: string; clinica: Clinica | null; onFechar: () => void }) {
  const router = useRouter()
  const abrirGuia = useAbrirGuia(companyId)
  const arquivoRef = useRef<HTMLInputElement>(null)
  const [campos, setCampos] = useState<Campos>({
    nome: clinica?.nome ?? '',
    endereco: clinica?.endereco ?? '',
    telefone: clinica?.telefone ?? '',
    orientacoes: clinica?.orientacoes ?? '',
  })
  const [erros, setErros] = useState<Partial<Record<keyof Campos, string>>>({})
  const [guia, setGuia] = useState<File | null>(null)
  const [removerGuia, setRemoverGuia] = useState(false)
  const [salvando, setSalvando] = useState(false)

  const mudar = (c: keyof Campos) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setCampos((v) => ({ ...v, [c]: e.target.value }))
  const guiaAtual = !removerGuia && clinica?.guia_path ? { path: clinica.guia_path, nome: clinica.guia_nome ?? 'Guia de encaminhamento' } : null

  async function salvar() {
    const parsed = clinicaSchema.safeParse(campos)
    if (!parsed.success) {
      setErros(Object.fromEntries(parsed.error.issues.map((i) => [i.path[0], i.message])))
      return
    }
    setErros({})
    const fd = new FormData()
    for (const [k, v] of Object.entries(parsed.data)) fd.append(k, v)
    if (guia) fd.append('guia', guia)
    if (removerGuia) fd.append('remover_guia', 'true')

    setSalvando(true)
    const r = await toast.promise(salvarClinicaAction(companyId, clinica?.id ?? null, fd), {
      loading: 'Salvando a clínica…',
      success: clinica ? 'Clínica atualizada.' : 'Clínica cadastrada.',
      error: 'Não foi possível salvar a clínica.',
    })
    setSalvando(false)
    if ('error' in r) return
    router.refresh()
    onFechar()
  }

  return (
    <div onKeyDown={semEnter} className="flex flex-col gap-3 rounded-xl border p-4" style={{ borderColor: 'var(--color-card-border)', backgroundColor: '#FAFAFA' }}>
      <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{clinica ? `Editar ${clinica.nome}` : 'Nova clínica'}</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <Input label="Nome da clínica *" value={campos.nome} onChange={mudar('nome')} error={erros.nome} />
        </div>
        <Input label="Telefone" value={campos.telefone} onChange={mudar('telefone')} error={erros.telefone} placeholder="(71) 3333-3333" />
      </div>
      <Input label="Endereço" value={campos.endereco} onChange={mudar('endereco')} error={erros.endereco} placeholder="Rua, número, bairro, cidade" />
      <div className="flex flex-col gap-1">
        <label htmlFor="clinica-orientacoes" className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Orientações ao candidato</label>
        <textarea
          id="clinica-orientacoes"
          rows={3}
          value={campos.orientacoes}
          onChange={mudar('orientacoes')}
          placeholder="Ex.: levar documento com foto e a carteira de trabalho; jejum de 8 horas."
          className="w-full rounded-lg border px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
          style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', backgroundColor: '#fff' }}
        />
        {erros.orientacoes
          ? <p className="text-xs" style={{ color: 'var(--color-error)' }}>{erros.orientacoes}</p>
          : <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Vêm preenchidas no encaminhamento e podem ser ajustadas para cada candidato.</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Guia de encaminhamento da clínica</span>
        {guia ? (
          <ArquivoGuia nome={guia.name} onRemover={() => setGuia(null)} />
        ) : guiaAtual ? (
          <ArquivoGuia nome={guiaAtual.nome} onAbrir={() => abrirGuia(guiaAtual.path)} onRemover={() => setRemoverGuia(true)} />
        ) : (
          <div>
            <Button type="button" variant="secondary" size="sm" onClick={() => arquivoRef.current?.click()}>Escolher arquivo</Button>
          </div>
        )}
        <input
          ref={arquivoRef}
          type="file"
          accept={ACEITA}
          className="hidden"
          onChange={(e) => { const f = conferirGuia(e.target.files?.[0]); if (f) { setGuia(f); setRemoverGuia(false) } e.target.value = '' }}
        />
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>PDF, JPG ou PNG, até 4 MB. Sem guia própria, o candidato recebe a guia geral.</p>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={onFechar} disabled={salvando}>Cancelar</Button>
        <Button type="button" size="sm" onClick={salvar} loading={salvando}>{clinica ? 'Salvar clínica' : 'Cadastrar clínica'}</Button>
      </div>
    </div>
  )
}

// Clínicas e guia geral do exame admissional: gravam na hora, à parte do "Salvar" das configurações
export function ConfigExame({ companyId, clinicas, guiaGeral }: {
  companyId: string
  clinicas: Clinica[]
  guiaGeral: { path: string; nome: string } | null
}) {
  const router = useRouter()
  const abrirGuia = useAbrirGuia(companyId)
  const geralRef = useRef<HTMLInputElement>(null)
  // null = fechado; 'nova' = cadastrar; Clinica = editar
  const [editando, setEditando] = useState<'nova' | Clinica | null>(null)
  const [excluir, setExcluir] = useState<Clinica | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function enviarGuiaGeral(file: File | null) {
    const fd = new FormData()
    if (file) fd.append('guia', file)
    setOcupado(true)
    const r = await toast.promise(salvarGuiaGeralAction(companyId, fd), {
      loading: file ? 'Enviando a guia…' : 'Removendo a guia…',
      success: file ? 'Guia geral salva.' : 'Guia geral removida.',
      error: 'Não foi possível salvar a guia.',
    })
    setOcupado(false)
    if (!('error' in r)) router.refresh()
  }

  async function confirmarExclusao() {
    if (!excluir) return
    setOcupado(true)
    const r = await toast.promise(excluirClinicaAction(companyId, excluir.id), {
      loading: 'Removendo a clínica…',
      success: 'Clínica removida.',
      error: 'Não foi possível remover.',
    })
    setOcupado(false)
    setExcluir(null)
    if (!('error' in r)) router.refresh()
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Clínicas */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Clínicas</span>
          {!editando && <Button type="button" variant="secondary" size="sm" onClick={() => setEditando('nova')}>Adicionar clínica</Button>}
        </div>
        {editando === 'nova' && <FormClinica companyId={companyId} clinica={null} onFechar={() => setEditando(null)} />}
        {clinicas.length === 0 && editando !== 'nova' && (
          <p className="text-sm rounded-lg border border-dashed px-4 py-5 text-center" style={{ borderColor: 'var(--color-card-border)', color: 'var(--color-text-muted)' }}>
            Nenhuma clínica cadastrada. Cadastre ao menos uma para encaminhar candidatos ao exame.
          </p>
        )}
        {clinicas.length > 0 && (
          <ul className="flex flex-col gap-2">
            {clinicas.map((c) =>
              editando !== 'nova' && editando?.id === c.id ? (
                <li key={c.id}><FormClinica companyId={companyId} clinica={c} onFechar={() => setEditando(null)} /></li>
              ) : (
                <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3" style={{ borderColor: 'var(--color-card-border)' }}>
                  <div className="flex-1 min-w-[200px]">
                    <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{c.nome}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                      {[c.endereco, c.telefone].filter(Boolean).join(' · ') || 'Sem endereço e telefone'}
                    </p>
                    <p className="text-xs mt-1" style={{ color: c.guia_path ? '#15803D' : 'var(--color-text-muted)' }}>
                      {c.guia_path ? 'Guia própria' : guiaGeral ? 'Usa a guia geral' : 'Sem guia'}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {c.guia_path && <Button type="button" variant="ghost" size="sm" onClick={() => abrirGuia(c.guia_path!)}>Ver guia</Button>}
                    <Button type="button" variant="ghost" size="sm" onClick={() => setEditando(c)} disabled={!!editando}>Editar</Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setExcluir(c)} disabled={!!editando} style={{ color: '#B91C1C' }}>Remover</Button>
                  </div>
                </li>
              ),
            )}
          </ul>
        )}
      </div>

      {/* Guia geral */}
      <div className="flex flex-col gap-1.5 border-t pt-4" style={{ borderColor: 'var(--color-card-border)' }}>
        <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Guia geral de encaminhamento</span>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Vai anexada ao e-mail do candidato quando a clínica escolhida não tem guia própria. PDF, JPG ou PNG, até 4 MB.
        </p>
        {guiaGeral ? (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex-1 min-w-[220px]">
              <ArquivoGuia nome={guiaGeral.nome} onAbrir={() => abrirGuia(guiaGeral.path)} onRemover={() => enviarGuiaGeral(null)} />
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={() => geralRef.current?.click()} disabled={ocupado}>Trocar arquivo</Button>
          </div>
        ) : (
          <div>
            <Button type="button" variant="secondary" size="sm" onClick={() => geralRef.current?.click()} loading={ocupado}>Enviar guia geral</Button>
          </div>
        )}
        <input
          ref={geralRef}
          type="file"
          accept={ACEITA}
          className="hidden"
          onChange={(e) => { const f = conferirGuia(e.target.files?.[0]); e.target.value = ''; if (f) enviarGuiaGeral(f) }}
        />
      </div>

      <ConfirmDialog
        open={!!excluir}
        onClose={() => { if (!ocupado) setExcluir(null) }}
        onConfirm={confirmarExclusao}
        loading={ocupado}
        confirmLabel="Remover clínica"
        title="Remover clínica"
        message={<p>Remover {excluir?.nome}? Ela sai da lista de clínicas; os encaminhamentos já feitos continuam no histórico.</p>}
      />
    </div>
  )
}
