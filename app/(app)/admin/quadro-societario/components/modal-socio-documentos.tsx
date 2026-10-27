'use client'

import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { SocioDocumentos } from './socio-documentos'
import type { Socio } from '../queries'

interface Props {
  open: boolean
  onClose: () => void
  companyId: string
  socio: Socio | null
}

// Documentos do sócio: envio imediato, por isso só o botão Fechar
export function ModalSocioDocumentos({ open, onClose, companyId, socio }: Props) {
  return (
    <Modal open={open} onClose={onClose} title="Documentos do sócio" description={socio?.nome} className="sm:max-w-2xl">
      {socio && <SocioDocumentos socioId={socio.id} socioNome={socio.nome} companyId={companyId} />}
      <div className="flex justify-end pt-6">
        <Button type="button" variant="secondary" onClick={onClose}>Fechar</Button>
      </div>
    </Modal>
  )
}
