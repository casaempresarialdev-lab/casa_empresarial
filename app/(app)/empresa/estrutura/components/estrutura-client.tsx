'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AddButton } from '@/components/ui/add-button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { FilterResult, FilterSelect, SearchField } from '@/components/ui/filter-select'
import { Tabs } from '@/components/ui/form-steps'
import { ListEmpty, ListItem } from '@/components/ui/list-item'
import { toast } from '@/lib/toast'
import { excluirCargoAction, excluirDepartamentoAction } from '../actions'
import { corDepartamento, faixaSalarial, type Cargo, type Departamento } from '../tipos'
import { ModalCargo, ModalDepartamento, type AberturaCargo } from './modais-estrutura'
import { Organograma } from './organograma'

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

type Exclusao = { tipo: 'cargo'; item: Cargo } | { tipo: 'departamento'; item: Departamento }

function Bolinha({ id }: { id: string }) {
  return <span className="w-3 h-3 rounded-full shrink-0 mx-1" style={{ backgroundColor: corDepartamento(id) }} />
}

// Aba Estrutura de Minha Empresa: organograma, departamentos e cargos, que alimentam Vagas e a ficha da Equipe
export function EstruturaClient({ companyId, departamentos, cargos, ativa }: { companyId: string; departamentos: Departamento[]; cargos: Cargo[]; ativa: boolean }) {
  const router = useRouter()
  const [aba, setAba] = useState(0)

  const [modalCargo, setModalCargo] = useState<AberturaCargo | null>(null)
  // undefined = fechado; null = novo
  const [modalDepartamento, setModalDepartamento] = useState<Departamento | null | undefined>(undefined)
  const [excluir, setExcluir] = useState<Exclusao | null>(null)
  const [excluindo, setExcluindo] = useState(false)

  const [buscaDepartamento, setBuscaDepartamento] = useState('')
  const [buscaCargo, setBuscaCargo] = useState('')
  const [departamentoFiltro, setDepartamentoFiltro] = useState('todos')

  const departamentosVisiveis = departamentos.filter((d) => !buscaDepartamento || d.nome.toLowerCase().includes(buscaDepartamento.toLowerCase()))
  const cargosVisiveis = cargos
    .filter((c) => departamentoFiltro === 'todos' || c.department_id === departamentoFiltro)
    .filter((c) => !buscaCargo || c.nome.toLowerCase().includes(buscaCargo.toLowerCase()))

  const editarCargo = (c: Cargo) => setModalCargo({ cargo: c })

  async function confirmarExclusao() {
    const alvo = excluir
    if (!alvo) return
    setExcluindo(true)
    const r = await toast.promise(
      alvo.tipo === 'cargo' ? excluirCargoAction(companyId, alvo.item.id) : excluirDepartamentoAction(companyId, alvo.item.id),
      { loading: `Excluindo ${alvo.item.nome}…`, success: `${alvo.item.nome} excluído.`, error: 'Não foi possível excluir.' },
    )
    setExcluindo(false)
    setExcluir(null)
    if (!('error' in r)) router.refresh()
  }

  return (
    <>
      <div className="app-card p-5">
      <Tabs labels={['Organograma', 'Departamentos', 'Cargos']} step={aba} onSelect={setAba} />

      <div className={aba === 0 ? undefined : 'hidden'}>
        <Organograma
          companyId={companyId}
          departamentos={departamentos}
          cargos={cargos}
          visivel={ativa && aba === 0}
          onEditar={editarCargo}
          onNovo={(superior) => setModalCargo({ cargo: null, superior })}
        />
      </div>

      {/* Departamentos */}
      <div className={aba === 1 ? 'flex flex-col gap-4' : 'hidden'}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold" style={{ color: 'var(--color-sidebar-text)' }}>{plural(departamentos.length, 'departamento', 'departamentos')}</p>
          <AddButton onClick={() => setModalDepartamento(null)} label="Novo departamento" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SearchField value={buscaDepartamento} onChange={setBuscaDepartamento} placeholder="Pesquisar departamento..." />
          {buscaDepartamento && <FilterResult total={departamentosVisiveis.length} onClear={() => setBuscaDepartamento('')} />}
        </div>
        <ul className="flex flex-col gap-3">
          {departamentosVisiveis.length === 0 && <ListEmpty>{departamentos.length === 0 ? 'Nenhum departamento cadastrado.' : 'Nenhum departamento encontrado.'}</ListEmpty>}
          {departamentosVisiveis.map((d) => {
            const dele = cargos.filter((c) => c.department_id === d.id)
            const pessoas = dele.reduce((s, c) => s + c.ocupantes.length, 0)
            return (
              <ListItem
                key={d.id}
                media={<Bolinha id={d.id} />}
                title={d.nome}
                subtitle={`${plural(dele.length, 'cargo', 'cargos')} · ${plural(pessoas, 'pessoa', 'pessoas')}`}
                onClick={() => setModalDepartamento(d)}
                actionsLabel={d.nome}
                actions={[
                  { icon: 'pencil', label: 'Editar', onClick: () => setModalDepartamento(d) },
                  { icon: 'trash', label: 'Excluir', tone: 'danger', onClick: () => setExcluir({ tipo: 'departamento', item: d }) },
                ]}
              />
            )
          })}
        </ul>
      </div>

      {/* Cargos */}
      <div className={aba === 2 ? 'flex flex-col gap-4' : 'hidden'}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold" style={{ color: 'var(--color-sidebar-text)' }}>{plural(cargos.length, 'cargo', 'cargos')}</p>
          <AddButton onClick={() => setModalCargo({ cargo: null })} label="Novo cargo" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect
            value={departamentoFiltro}
            onChange={setDepartamentoFiltro}
            label="Filtrar por departamento"
            options={[{ value: 'todos', label: 'Todos os departamentos' }, ...departamentos.map((d) => ({ value: d.id, label: d.nome }))]}
          />
          <SearchField value={buscaCargo} onChange={setBuscaCargo} placeholder="Pesquisar cargo..." />
          {(departamentoFiltro !== 'todos' || buscaCargo) && <FilterResult total={cargosVisiveis.length} onClear={() => { setDepartamentoFiltro('todos'); setBuscaCargo('') }} />}
        </div>
        <ul className="flex flex-col gap-3">
          {cargosVisiveis.length === 0 && <ListEmpty>{cargos.length === 0 ? 'Nenhum cargo cadastrado.' : 'Nenhum cargo encontrado.'}</ListEmpty>}
          {cargosVisiveis.map((c) => {
            const superior = cargos.find((x) => x.id === c.superior_id)
            return (
              <ListItem
                key={c.id}
                media={<Bolinha id={c.department_id} />}
                title={c.nome}
                subtitle={[c.departamento, superior ? `Responde a ${superior.nome}` : 'Topo da hierarquia', faixaSalarial(c)].filter(Boolean).join(' · ')}
                aside={<span className="hidden sm:inline text-xs font-medium whitespace-nowrap" style={{ color: c.ocupantes.length ? 'var(--color-text-muted)' : '#B45309' }}>{c.ocupantes.length ? plural(c.ocupantes.length, 'pessoa', 'pessoas') : 'Vago'}</span>}
                onClick={() => editarCargo(c)}
                actionsLabel={c.nome}
                actions={[
                  { icon: 'pencil', label: 'Editar', onClick: () => editarCargo(c) },
                  { icon: 'trash', label: 'Excluir', tone: 'danger', onClick: () => setExcluir({ tipo: 'cargo', item: c }) },
                ]}
              />
            )
          })}
        </ul>
      </div>
      </div>

      {modalCargo && (
        <ModalCargo
          key={modalCargo.cargo?.id ?? `novo-${modalCargo.superior?.id ?? ''}`}
          abertura={modalCargo}
          departamentos={departamentos}
          cargos={cargos}
          companyId={companyId}
          onClose={() => setModalCargo(null)}
          onNovoDepartamento={() => { setModalCargo(null); setModalDepartamento(null) }}
        />
      )}
      {modalDepartamento !== undefined && (
        <ModalDepartamento key={modalDepartamento?.id ?? 'novo'} departamento={modalDepartamento} companyId={companyId} onClose={() => setModalDepartamento(undefined)} />
      )}

      <ConfirmDialog
        open={!!excluir}
        onClose={() => { if (!excluindo) setExcluir(null) }}
        onConfirm={confirmarExclusao}
        loading={excluindo}
        title={excluir?.tipo === 'cargo' ? 'Excluir cargo' : 'Excluir departamento'}
        message={<p>Excluir <strong>{excluir?.item.nome}</strong>?{excluir?.tipo === 'cargo' && ' Os cargos abaixo dele passam a responder ao superior dele.'}</p>}
      />
    </>
  )
}
