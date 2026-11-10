'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { toast } from '@/lib/toast'
import { removerEscalaAction } from '../actions'

const fmt = (d: string) => d.split('-').reverse().join('/')

/** Remove a escala de uma pessoa a partir de uma data; os dias anteriores ficam como estavam */
export function ModalRemoverEscala({ companyId, pessoa, inicioEscala, hoje, onClose, onRemovida }: {
  companyId: string
  pessoa: { id: string; nome: string }
  /** Primeiro dia da escala da pessoa */
  inicioEscala: string
  hoje: string
  onClose: () => void
  onRemovida: () => void
}) {
  const router = useRouter()
  const [aPartirDe, setAPartirDe] = useState(hoje)
  const [removendo, setRemovendo] = useState(false)

  async function remover() {
    setRemovendo(true)
    const r = await toast.promise(removerEscalaAction(companyId, { employee_id: pessoa.id, a_partir_de: aPartirDe }), {
      loading: 'Removendo a escala…',
      success: `${pessoa.nome} saiu do quadro.`,
      error: 'Não foi possível remover do quadro.',
    })
    setRemovendo(false)
    if ('error' in r) return
    onRemovida()
    router.refresh()
  }

  const desdeOInicio = aPartirDe <= inicioEscala

  return (
    <Modal open onClose={() => { if (!removendo) onClose() }} title="Remover do quadro" description={pessoa.nome}>
      <div className="flex flex-col gap-4">
        <Input label="Remover a partir de" type="date" value={aPartirDe} onChange={(e) => setAPartirDe(e.target.value)} />
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {desdeOInicio
            ? 'A escala inteira será apagada, com as trocas avulsas. Sem escala, os dias deixam de contar para faltas, atrasos e horas extras na folha.'
            : `Os dias antes de ${fmt(aPartirDe)} continuam como estão. Depois disso, as folgas e o horário deixam de existir.`}
        </p>
        {!desdeOInicio && (
          <button type="button" onClick={() => setAPartirDe(inicioEscala)} className="self-start text-sm font-semibold cursor-pointer hover:underline" style={{ color: 'var(--color-brand)' }}>
            Remover desde o início ({fmt(inicioEscala)})
          </button>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={removendo}>Cancelar</Button>
          <Button type="button" variant="danger" loading={removendo} disabled={!aPartirDe} onClick={remover}>Remover do quadro</Button>
        </div>
      </div>
    </Modal>
  )
}
