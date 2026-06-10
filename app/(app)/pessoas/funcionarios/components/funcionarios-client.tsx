'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ModalFuncionario } from './modal-funcionario'
import { deleteEmployeeAction } from '../actions'
import type { Employee } from '../queries'
import type { CompanyBenefit } from '../../beneficios/queries'

interface Props {
  employees: Employee[]
  companyId: string
  companyBenefits: CompanyBenefit[]
}

const STATUS_LABELS: Record<string, string> = {
  admissao: 'Admissão',
  experiencia: 'Experiência',
  ativo: 'Ativo',
  inativo: 'Inativo',
  demitido: 'Demitido',
}

const STATUS_COLORS: Record<string, string> = {
  admissao: '#E9F5FE',
  experiencia: '#FEF9E7',
  ativo: '#E9F7EF',
  inativo: '#F2F3F4',
  demitido: '#FDEDEC',
}

const STATUS_TEXT: Record<string, string> = {
  admissao: '#2980B9',
  experiencia: '#D4AC0D',
  ativo: '#1E8449',
  inativo: '#717D7E',
  demitido: '#C0392B',
}

const CONTRATO_LABELS: Record<string, string> = {
  clt: 'CLT',
  pj: 'PJ',
  estagio: 'Estágio',
  menor_aprendiz: 'Menor Aprendiz',
}

function cpfMask(cpf: string | null) {
  if (!cpf) return '—'
  const d = cpf.replace(/\D/g, '')
  if (d.length !== 11) return cpf
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

export function FuncionariosClient({ employees, companyId, companyBenefits }: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [search, setSearch] = useState('')

  const q = search.toLowerCase()
  const filtered = employees.filter(e =>
    e.nome.toLowerCase().includes(q) ||
    (e.cargo ?? '').toLowerCase().includes(q) ||
    (e.departamento ?? '').toLowerCase().includes(q) ||
    (e.cpf ?? '').includes(q)
  )

  function openAdd() { setEditingEmployee(null); setModalOpen(true) }
  function openEdit(e: Employee) { setEditingEmployee(e); setModalOpen(true) }

  async function handleDelete(e: Employee) {
    if (!confirm(`Excluir ${e.nome}? Esta ação não pode ser desfeita.`)) return
    setDeletingId(e.id)
    setDeleteError('')
    const result = await deleteEmployeeAction(e.id)
    setDeletingId(null)
    if ('error' in result) setDeleteError(result.error ?? 'Erro ao excluir.')
    else router.refresh()
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
            Funcionários
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Colaboradores da empresa
          </p>
        </div>
        <Button onClick={openAdd}>+ Novo funcionário</Button>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Buscar por nome, cargo, departamento ou CPF..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full px-4 py-2 rounded-lg border text-sm"
          style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white', color: 'var(--color-text-primary)' }}
        />
      </div>

      {deleteError && (
        <p className="text-sm mb-4 p-3 rounded-lg bg-red-50" style={{ color: 'var(--color-error)' }}>
          {deleteError}
        </p>
      )}

      <div className="rounded-xl border overflow-x-auto" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}>
        <table className="w-full min-w-[700px] text-sm">
          <thead style={{ backgroundColor: 'var(--color-bg-surface)' }}>
            <tr>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Nome</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>CPF</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Cargo</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Contrato</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--color-text-secondary)' }}>Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-10" style={{ color: 'var(--color-text-muted)' }}>
                  {search ? 'Nenhum resultado para a busca.' : 'Nenhum funcionário cadastrado.'}
                </td>
              </tr>
            )}
            {filtered.map((e) => (
              <tr key={e.id} className="border-t" style={{ borderColor: 'var(--color-bg-surface)' }}>
                <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  <div>{e.nome}</div>
                  {e.departamento && (
                    <div className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{e.departamento}</div>
                  )}
                </td>
                <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>{cpfMask(e.cpf)}</td>
                <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>{e.cargo ?? '—'}</td>
                <td className="px-4 py-3" style={{ color: 'var(--color-text-secondary)' }}>
                  {e.tipo_contrato ? CONTRATO_LABELS[e.tipo_contrato] ?? e.tipo_contrato : '—'}
                </td>
                <td className="px-4 py-3">
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: STATUS_COLORS[e.status] ?? '#F2F3F4',
                      color: STATUS_TEXT[e.status] ?? '#717D7E',
                    }}
                  >
                    {STATUS_LABELS[e.status] ?? e.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(e)}>Editar</Button>
                    <Button
                      variant="danger"
                      size="sm"
                      loading={deletingId === e.id}
                      onClick={() => handleDelete(e)}
                    >
                      Excluir
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ModalFuncionario
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        companyId={companyId}
        employee={editingEmployee}
        companyBenefits={companyBenefits}
      />
    </>
  )
}
