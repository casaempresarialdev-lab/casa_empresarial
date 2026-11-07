'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { SearchSelect } from '@/components/ui/search-select'
import { toast } from '@/lib/toast'
import { iniciarRescisaoAction } from '../actions'
import { TIPOS_DESLIGAMENTO } from '../etapas'

// "Iniciar rescisão": na ficha do funcionário (pessoa já escolhida) ou no kanban (escolhendo quem)
export function IniciarRescisao({ open, onClose, companyId, employee, funcionarios }: {
  open: boolean
  onClose: () => void
  companyId: string
  /** Na ficha do funcionário: a pessoa já está escolhida */
  employee?: { id: string; nome: string }
  /** No kanban: quem pode ter a rescisão iniciada */
  funcionarios?: { id: string; nome: string }[]
}) {
  const router = useRouter()
  const [pessoa, setPessoa] = useState(employee?.id ?? '')
  const [tipo, setTipo] = useState('')
  const [motivo, setMotivo] = useState('')
  const [erros, setErros] = useState<{ pessoa?: string; tipo?: string }>({})
  const [enviando, setEnviando] = useState(false)

  async function iniciar() {
    const e = { pessoa: pessoa ? undefined : 'Escolha a pessoa', tipo: tipo ? undefined : 'Escolha o tipo de desligamento' }
    setErros(e)
    if (e.pessoa || e.tipo) return
    setEnviando(true)
    const r = await toast.promise(iniciarRescisaoAction(companyId, pessoa, { tipo, motivo }), {
      loading: 'Iniciando a rescisão…',
      success: 'Rescisão iniciada.',
      error: 'Não foi possível iniciar a rescisão.',
    })
    setEnviando(false)
    if ('error' in r) return
    onClose()
    router.push(`/pessoas/rescisao/${r.id}`)
  }

  return (
    <Modal open={open} onClose={() => { if (!enviando) onClose() }} title="Iniciar rescisão" description={employee?.nome}>
      <div className="flex flex-col gap-4">
        {!employee && (
          <SearchSelect
            label="Funcionário *"
            options={(funcionarios ?? []).map((f) => ({ value: f.id, label: f.nome }))}
            value={pessoa}
            onChange={setPessoa}
            placeholder="Pesquisar pelo nome..."
            emptyText="Ninguém da Equipe com esse nome (ou já em rescisão)."
            error={erros.pessoa}
          />
        )}
        <Select label="Tipo de desligamento *" placeholder="Selecionar..." options={[...TIPOS_DESLIGAMENTO]} value={tipo} onChange={(e) => setTipo(e.target.value)} error={erros.tipo} />
        <div className="flex flex-col gap-1">
          <label htmlFor="rescisao-motivo" className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Motivo (opcional)</label>
          <textarea
            id="rescisao-motivo"
            rows={3}
            maxLength={1000}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
            style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', backgroundColor: '#fff' }}
          />
        </div>
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          A pessoa continua na Equipe durante o processo e sai ao finalizar a rescisão.
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={enviando}>Cancelar</Button>
          <Button type="button" onClick={iniciar} loading={enviando}>Iniciar rescisão</Button>
        </div>
      </div>
    </Modal>
  )
}
