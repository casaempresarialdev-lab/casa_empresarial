'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { FileDropZone } from '@/components/ui/file-drop-zone'
import { ListItem } from '@/components/ui/list-item'
import { Modal } from '@/components/ui/modal'
import { Select } from '@/components/ui/select'
import { ROTULO_DOCUMENTO, TIPOS_DOCUMENTO, type HoleriteEnviado, type TipoDocumento } from '@/lib/folha/documentos'
import { toast } from '@/lib/toast'
import { enviarHoleriteAction, removerHoleriteAction, urlHoleriteEnviadoAction } from '../actions-holerites'

const MAX_BYTES = 10 * 1024 * 1024
const quando = (iso: string) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(iso))

// Holerites que a contabilidade fechou: o PDF enviado aqui é o que o colaborador vê em Meu holerite
export function ModalHoleritesEnviados({ companyId, employee, competencia, rotuloMes, enviados, onClose }: {
  companyId: string
  employee: { id: string; nome: string }
  competencia: string
  rotuloMes: string
  enviados: HoleriteEnviado[]
  onClose: () => void
}) {
  const router = useRouter()
  const [tipo, setTipo] = useState<TipoDocumento>('mensal')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [removendo, setRemovendo] = useState<HoleriteEnviado | null>(null)

  async function enviar() {
    if (!arquivo) { toast.error('Escolha o PDF do holerite.'); return }
    const fd = new FormData()
    fd.set('employee_id', employee.id)
    fd.set('competencia', competencia)
    fd.set('tipo', tipo)
    fd.set('arquivo', arquivo)
    setSalvando(true)
    try {
      await toast.promise(enviarHoleriteAction(companyId, fd), { loading: 'Enviando…', success: 'Holerite enviado ao colaborador.', error: 'Não foi possível enviar.' })
      setArquivo(null)
      router.refresh()
    } catch {
      // A mensagem de erro já apareceu
    }
    setSalvando(false)
  }

  async function abrir(d: HoleriteEnviado) {
    const r = await urlHoleriteEnviadoAction(companyId, d.id)
    if ('error' in r) { toast.error(r.error ?? 'Não foi possível abrir.'); return }
    window.open(r.url, '_blank', 'noopener')
  }

  async function remover() {
    if (!removendo) return
    try {
      await toast.promise(removerHoleriteAction(companyId, removendo.id), { loading: 'Removendo…', success: 'Holerite removido.', error: 'Não foi possível remover.' })
      router.refresh()
    } catch {
      // A mensagem de erro já apareceu
    }
    setRemovendo(null)
  }

  return (
    <Modal open onClose={() => { if (!salvando) onClose() }} title="Holerite da contabilidade" description={`${employee.nome} · ${rotuloMes}`}>
      <div className="flex flex-col gap-4">
        {enviados.length > 0 && (
          <ul className="flex flex-col gap-2">
            {enviados.map((d) => (
              <ListItem
                key={d.id}
                icon="file"
                title={ROTULO_DOCUMENTO[d.tipo]}
                subtitle={`${d.arquivo_nome} · enviado ${quando(d.created_at)}${d.enviado_por_nome ? ` por ${d.enviado_por_nome}` : ''}`}
                onClick={() => abrir(d)}
                actionsLabel={d.arquivo_nome}
                actions={[
                  { icon: 'eye', label: 'Abrir', onClick: () => abrir(d) },
                  { icon: 'trash', label: 'Remover', onClick: () => setRemovendo(d) },
                ]}
              />
            ))}
          </ul>
        )}

        <Select
          label="Tipo"
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoDocumento)}
          options={TIPOS_DOCUMENTO.map((t) => ({ value: t, label: ROTULO_DOCUMENTO[t] }))}
        />
        <FileDropZone file={arquivo} onFile={setArquivo} maxBytes={MAX_BYTES} accept=".pdf" hint="PDF do holerite" />
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>O colaborador é avisado e encontra o arquivo em Meu holerite.</p>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={salvando}>Fechar</Button>
          <Button type="button" loading={salvando} onClick={enviar}>Enviar</Button>
        </div>
      </div>

      <ConfirmDialog
        open={!!removendo}
        title="Remover holerite"
        message={removendo ? `O arquivo "${removendo.arquivo_nome}" deixa de aparecer para ${employee.nome}.` : ''}
        confirmLabel="Remover"
        onConfirm={remover}
        onClose={() => setRemovendo(null)}
      />
    </Modal>
  )
}
