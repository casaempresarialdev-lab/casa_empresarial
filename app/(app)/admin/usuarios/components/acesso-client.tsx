'use client'

import { useState } from 'react'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { Tabs } from '@/components/ui/form-steps'
import { PerfisAcesso } from './perfis-acesso'
import { UsuariosClient } from './usuarios-client'
import type { Invitation, MemberWithProfile, PerfilAcesso } from '../queries'
import type { CargoOpcao } from '../../../empresa/estrutura/tipos'

interface Props {
  abaInicial: number
  perfis: PerfilAcesso[]
  cargos: CargoOpcao[]
  members: MemberWithProfile[]
  invitations: Invitation[]
  companyId: string
  currentProfileId: string
  currentUserRole: string
  currentUserEmail: string
}

// Acessos: perfis (o que cada um libera) e usuários (quem tem qual perfil).
// As duas guias ficam montadas, para não perder o estado ao trocar.
export function AcessoClient({ abaInicial, perfis, ...usuarios }: Props) {
  const [aba, setAba] = useState(abaInicial)
  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>Acessos</h1>
        <Breadcrumb />
      </div>
      <Tabs labels={['Perfis de acesso', 'Usuários']} step={aba} onSelect={setAba} />
      <div className={aba === 0 ? undefined : 'hidden'}>
        <PerfisAcesso perfis={perfis} membros={usuarios.members} convites={usuarios.invitations} companyId={usuarios.companyId} />
      </div>
      <div className={aba === 1 ? undefined : 'hidden'}>
        <UsuariosClient perfis={perfis} {...usuarios} />
      </div>
    </>
  )
}
