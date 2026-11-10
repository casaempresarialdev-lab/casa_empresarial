'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Select } from '@/components/ui/select'
import { toast } from '@/lib/toast'
import { RESULTADO_ASO, ROTULO_TIPO_SS_LONGO, TIPOS_SS, type TipoSS } from '@/lib/seguranca'
import { createHealthSafetyAction, updateHealthSafetyAction } from '../actions'
import type { HealthSafetyRecord, EmployeeForSS } from '../queries'

const iniciais = (nome: string) => nome.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()

// Para quem é o registro: várias pessoas de uma vez (um registro para cada) ou a empresa
function ParaQuem({ employees, selecionados, onChange, empresa, onEmpresa }: {
  employees: EmployeeForSS[]
  selecionados: string[]
  onChange: (ids: string[]) => void
  empresa: boolean
  onEmpresa: (v: boolean) => void
}) {
  const [busca, setBusca] = useState('')
  const q = busca.trim().toLowerCase()
  const visiveis = employees.filter((e) => !q || e.nome.toLowerCase().includes(q) || (e.cargo ?? '').toLowerCase().includes(q))
  const marcado = (id: string) => selecionados.includes(id)
  const alternar = (id: string) => onChange(marcado(id) ? selecionados.filter((s) => s !== id) : [...selecionados, id])
  const todosVisiveis = visiveis.length > 0 && visiveis.every((e) => marcado(e.id))

  return (
    <section className="rounded-xl border-2 p-3 flex flex-col gap-2.5" style={{ borderColor: 'var(--color-brand)', backgroundColor: 'var(--color-brand-light)' }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
          Para quem *
          {!empresa && selecionados.length > 0 && <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: 'var(--color-brand)' }}>{selecionados.length} {selecionados.length === 1 ? 'pessoa' : 'pessoas'}</span>}
        </p>
        {!empresa && (
          <div className="flex items-center gap-3 text-xs font-semibold">
            <button type="button" className="hover:underline" style={{ color: 'var(--color-brand)' }} onClick={() => onChange(todosVisiveis ? selecionados.filter((s) => !visiveis.some((e) => e.id === s)) : [...new Set([...selecionados, ...visiveis.map((e) => e.id)])])}>
              {todosVisiveis ? 'Desmarcar todos' : q ? 'Marcar os encontrados' : 'Marcar todos'}
            </button>
            {selecionados.length > 0 && <button type="button" className="hover:underline" style={{ color: 'var(--color-text-muted)' }} onClick={() => onChange([])}>Limpar</button>}
          </div>
        )}
      </div>

      {!empresa && (
        <>
          <div className="flex items-center gap-2 h-9 px-3 rounded-lg border bg-white" style={{ borderColor: 'var(--color-card-border)' }}>
            <span style={{ color: 'var(--color-text-muted)' }}><Icon name="users" size={16} /></span>
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou cargo..." className="flex-1 min-w-0 text-sm outline-none bg-transparent" style={{ color: 'var(--color-text-primary)' }} />
          </div>
          <ul className="max-h-48 overflow-y-auto rounded-lg border bg-white divide-y" style={{ borderColor: 'var(--color-card-border)' }}>
            {visiveis.length === 0 && <li className="px-3 py-4 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>Ninguém encontrado.</li>}
            {visiveis.map((e) => (
              <li key={e.id}>
                <label className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50">
                  <input type="checkbox" checked={marcado(e.id)} onChange={() => alternar(e.id)} className="w-4 h-4 shrink-0" style={{ accentColor: 'var(--color-brand)' }} />
                  <span className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold" style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}>{iniciais(e.nome)}</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{e.nome}</span>
                    {e.cargo && <span className="block text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>{e.cargo}</span>}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </>
      )}

      <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--color-text-secondary)' }}>
        <input type="checkbox" checked={empresa} onChange={(e) => onEmpresa(e.target.checked)} className="w-4 h-4" style={{ accentColor: 'var(--color-brand)' }} />
        Registro da empresa, sem funcionário (ex.: incidente geral, treinamento coletivo sem lista)
      </label>
      {!empresa && selecionados.length > 1 && (
        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Cria um registro para cada pessoa, e cada uma é avisada.</p>
      )}
    </section>
  )
}

export function ModalSeguranca({ open, onClose, companyId, record, employees }: {
  open: boolean
  onClose: () => void
  companyId: string
  record: HealthSafetyRecord | null
  employees: EmployeeForSS[]
}) {
  const router = useRouter()
  const editando = !!record

  const [selecionados, setSelecionados] = useState<string[]>([])
  const [empresa, setEmpresa] = useState(false)
  const [employeeId, setEmployeeId] = useState('')
  const [tipo, setTipo] = useState<TipoSS>('aso')
  const [titulo, setTitulo] = useState('')
  const [data, setData] = useState('')
  const [vencimento, setVencimento] = useState('')
  const [resultado, setResultado] = useState('')
  const [observacao, setObservacao] = useState('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!open) return
    setSelecionados([]); setEmpresa(false)
    setEmployeeId(record?.employee_id ?? '')
    setTipo((record?.tipo as TipoSS) ?? 'aso')
    setTitulo(record?.titulo ?? '')
    setData(record?.data ?? '')
    setVencimento(record?.data_vencimento ?? '')
    setResultado(record?.resultado ?? '')
    setObservacao(record?.observacao ?? '')
  }, [open, record])

  // Na edição, o funcionário deste registro pode sair da lista (desligado): continua como opção
  const opcoesFuncionario = [
    ...employees.map((e) => ({ value: e.id, label: e.nome })),
    ...(record?.employee_id && !employees.some((e) => e.id === record.employee_id) ? [{ value: record.employee_id, label: record.employee?.nome ?? 'Funcionário' }] : []),
  ]

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!editando && !empresa && selecionados.length === 0) { toast.error('Escolha para quem é o registro.'); return }
    const fd = new FormData()
    fd.set('tipo', tipo)
    fd.set('titulo', titulo)
    fd.set('data', data)
    fd.set('data_vencimento', vencimento)
    fd.set('resultado', resultado)
    fd.set('observacao', observacao)
    if (editando) fd.set('employee_id', employeeId)
    else fd.set('employee_ids', JSON.stringify(empresa ? [] : selecionados))

    setSalvando(true)
    try {
      const n = empresa ? 1 : selecionados.length
      await toast.promise(editando ? updateHealthSafetyAction(record!.id, fd) : createHealthSafetyAction(companyId, fd), {
        loading: 'Salvando…',
        success: editando ? 'Registro salvo.' : n > 1 ? `${n} registros criados. Cada pessoa foi avisada.` : empresa ? 'Registro criado.' : 'Registro criado. A pessoa foi avisada.',
        error: 'Não foi possível salvar.',
      })
      router.refresh()
      onClose()
    } catch {
      // A mensagem de erro já apareceu
    }
    setSalvando(false)
  }

  return (
    <Modal open={open} onClose={() => { if (!salvando) onClose() }} title={editando ? 'Editar registro' : 'Novo registro'} description="Segurança e saúde do trabalho" className="sm:max-w-xl">
      <form onSubmit={salvar} noValidate className="flex flex-col gap-4">
        {editando
          ? <Select label="Funcionário" placeholder="Empresa (sem funcionário)" options={opcoesFuncionario} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} />
          : <ParaQuem employees={employees} selecionados={selecionados} onChange={setSelecionados} empresa={empresa} onEmpresa={setEmpresa} />}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select label="Tipo *" options={TIPOS_SS.map((t) => ({ value: t, label: ROTULO_TIPO_SS_LONGO[t] }))} value={tipo} onChange={(e) => setTipo(e.target.value as TipoSS)} />
          <Input label="Título *" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: ASO periódico, NR-35" maxLength={200} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
          <Input label="Vencimento" type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} hint="Avisamos quando estiver perto de vencer." />
        </div>

        {tipo === 'aso' && (
          <Select label="Resultado do ASO" placeholder="Sem resultado" options={Object.entries(RESULTADO_ASO).map(([value, label]) => ({ value, label }))} value={resultado} onChange={(e) => setResultado(e.target.value)} />
        )}

        <div className="flex flex-col gap-1">
          <label htmlFor="ss-obs" className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Observação</label>
          <textarea
            id="ss-obs"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="Detalhes adicionais..."
            className="w-full rounded-lg border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
            style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', backgroundColor: '#fff' }}
          />
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>O funcionário vê este registro, com a observação, em Minha saúde e segurança.</span>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose} disabled={salvando}>Cancelar</Button>
          <Button type="submit" loading={salvando}>
            {editando ? 'Salvar' : !empresa && selecionados.length > 1 ? `Criar ${selecionados.length} registros` : 'Criar registro'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
