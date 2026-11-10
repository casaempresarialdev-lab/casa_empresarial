'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Select } from '@/components/ui/select'
import { toast } from '@/lib/toast'
import { ROTULO_ADICIONAL, type AdicionalCargo } from '@/lib/folha/config'
import { ADICIONAIS_CARGO } from '@/lib/validations/folha'
import { maskMoeda } from '../../../pessoas/funcionarios/components/ficha/ficha-config'
import { salvarCargoAction, salvarDepartamentoAction } from '../actions'
import { descendentesDe, type Cargo, type Departamento } from '../tipos'

const comDecimais = (v: number | null) => (v == null ? '' : v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))

function Rodape({ salvando, onCancelar, rotulo }: { salvando: boolean; onCancelar: () => void; rotulo: string }) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <Button type="button" variant="secondary" onClick={onCancelar} disabled={salvando}>Cancelar</Button>
      <Button type="submit" loading={salvando}>{rotulo}</Button>
    </div>
  )
}

export function ModalDepartamento({ departamento, companyId, onClose }: { departamento: Departamento | null; companyId: string; onClose: () => void }) {
  const router = useRouter()
  const [nome, setNome] = useState(departamento?.nome ?? '')
  const [salvando, setSalvando] = useState(false)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    const r = await toast.promise(salvarDepartamentoAction(companyId, departamento?.id ?? null, { nome }), {
      loading: 'Salvando o departamento…',
      success: departamento ? 'Departamento salvo.' : 'Departamento criado.',
      error: 'Não foi possível salvar o departamento.',
    })
    setSalvando(false)
    if ('error' in r) return
    router.refresh()
    onClose()
  }

  return (
    <Modal open onClose={() => { if (!salvando) onClose() }} title={departamento ? 'Editar departamento' : 'Novo departamento'}>
      <form onSubmit={salvar} className="flex flex-col gap-4">
        <Input label="Nome do departamento *" placeholder="Ex.: Financeiro" maxLength={120} value={nome} onChange={(e) => setNome(e.target.value)} autoFocus required />
        <Rodape salvando={salvando} onCancelar={onClose} rotulo={departamento ? 'Salvar' : 'Criar departamento'} />
      </form>
    </Modal>
  )
}

/** Abertura do modal de cargo: edição, ou novo já abaixo de um superior */
export type AberturaCargo = { cargo: Cargo | null; superior?: Cargo | null }

export function ModalCargo({ abertura, departamentos, cargos, companyId, onClose, onNovoDepartamento }: {
  abertura: AberturaCargo
  departamentos: Departamento[]
  cargos: Cargo[]
  companyId: string
  onClose: () => void
  onNovoDepartamento: () => void
}) {
  const router = useRouter()
  const { cargo, superior } = abertura
  const [nome, setNome] = useState(cargo?.nome ?? '')
  const [departamentoId, setDepartamentoId] = useState(cargo?.department_id ?? superior?.department_id ?? '')
  const [superiorId, setSuperiorId] = useState(cargo?.superior_id ?? superior?.id ?? '')
  const [salarioMin, setSalarioMin] = useState(comDecimais(cargo?.salario_min ?? null))
  const [salarioMax, setSalarioMax] = useState(comDecimais(cargo?.salario_max ?? null))
  const [adicional, setAdicional] = useState<AdicionalCargo>(cargo?.adicional ?? 'nenhum')
  const [batePonto, setBatePonto] = useState(cargo?.bate_ponto ?? true)
  const [salvando, setSalvando] = useState(false)

  // Superior possível: qualquer cargo, menos ele mesmo e os que estão abaixo dele
  const abaixo = cargo ? descendentesDe(cargos, cargo.id) : new Set<string>()
  const superiores = cargos.filter((c) => c.id !== cargo?.id && !abaixo.has(c.id))

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    setSalvando(true)
    const r = await toast.promise(
      salvarCargoAction(companyId, cargo?.id ?? null, { nome, department_id: departamentoId, superior_id: superiorId, salario_min: salarioMin, salario_max: salarioMax, adicional, bate_ponto: batePonto }),
      { loading: 'Salvando o cargo…', success: cargo ? 'Cargo salvo.' : 'Cargo criado.', error: 'Não foi possível salvar o cargo.' },
    )
    setSalvando(false)
    if ('error' in r) return
    router.refresh()
    onClose()
  }

  return (
    <Modal
      open
      onClose={() => { if (!salvando) onClose() }}
      title={cargo ? 'Editar cargo' : 'Novo cargo'}
      description={!cargo && superior ? `Abaixo de ${superior.nome}` : undefined}
    >
      {departamentos.length === 0 ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Todo cargo pertence a um departamento. Crie o primeiro para continuar.</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button type="button" onClick={onNovoDepartamento}>Criar departamento</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={salvar} className="flex flex-col gap-4">
          <Input label="Nome do cargo *" placeholder="Ex.: Analista financeiro" maxLength={120} value={nome} onChange={(e) => setNome(e.target.value)} autoFocus required />
          <Select label="Departamento *" placeholder="Selecionar..." options={departamentos.map((d) => ({ value: d.id, label: d.nome }))} value={departamentoId} onChange={(e) => setDepartamentoId(e.target.value)} required />
          <Select
            label="Responde a"
            placeholder="Ninguém (topo da hierarquia)"
            options={superiores.map((c) => ({ value: c.id, label: `${c.nome} (${c.departamento})` }))}
            value={superiorId}
            onChange={(e) => setSuperiorId(e.target.value)}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Salário mínimo (R$)" placeholder="0,00" inputMode="numeric" value={salarioMin} onChange={(e) => setSalarioMin(maskMoeda(e.target.value))} hint="Sugerido ao abrir uma vaga." />
            <Input label="Salário máximo (R$)" placeholder="0,00" inputMode="numeric" value={salarioMax} onChange={(e) => setSalarioMax(maskMoeda(e.target.value))} />
          </div>
          <Select
            label="Adicional de risco"
            options={ADICIONAIS_CARGO.map((a) => ({ value: a, label: ROTULO_ADICIONAL[a] }))}
            value={adicional}
            onChange={(e) => setAdicional(e.target.value as AdicionalCargo)}
          />
          <p className="text-xs -mt-2" style={{ color: 'var(--color-text-muted)' }}>Vale para todos neste cargo, conforme o laudo técnico. Exceções vão na ficha da pessoa.</p>
          <label className="flex items-start gap-2.5 text-sm cursor-pointer" style={{ color: 'var(--color-text-secondary)' }}>
            <input type="checkbox" checked={batePonto} onChange={(e) => setBatePonto(e.target.checked)} className="mt-0.5 w-4 h-4 shrink-0" style={{ accentColor: 'var(--color-brand)' }} />
            <span>
              <span className="font-medium">Registra ponto</span>
              <span className="block text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Quem ocupa o cargo vê Bater ponto e Meu ponto na página inicial. Desmarque para cargos de gestão sem controle de jornada (art. 62 da CLT).</span>
            </span>
          </label>
          <Rodape salvando={salvando} onCancelar={onClose} rotulo={cargo ? 'Salvar' : 'Criar cargo'} />
        </form>
      )}
    </Modal>
  )
}
