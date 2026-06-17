'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createProviderAction, updateProviderAction } from '../actions'
import type { ServiceProvider, ProviderDoc } from '../queries'

function formatCnpj(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 14)
  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

interface Props {
  open: boolean
  onClose: () => void
  companyId: string
  provider: ServiceProvider | null
}

const EMPTY3 = <T,>(v: T): [T, T, T] => [v, v, v]

export function ModalPrestador({ open, onClose, companyId, provider }: Props) {
  const router = useRouter()
  const isEdit = !!provider

  const [nome, setNome] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [servico, setServico] = useState('')
  const [valor, setValor] = useState('')
  const [dataInicio, setDataInicio] = useState('')

  // 3 slots de documentos
  const [existingDocs, setExistingDocs] = useState<(ProviderDoc | null)[]>(EMPTY3(null))
  const [files, setFiles] = useState<(File | null)[]>(EMPTY3(null))
  const [labels, setLabels] = useState<string[]>(EMPTY3(''))
  const [removeFlags, setRemoveFlags] = useState<boolean[]>(EMPTY3(false))
  const fileRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)]

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    setFiles(EMPTY3(null))
    setRemoveFlags(EMPTY3(false))
    fileRefs.forEach(r => { if (r.current) r.current.value = '' })
    if (provider) {
      setNome(provider.nome)
      setCnpj(formatCnpj(provider.cpf_cnpj ?? ''))
      setEmail(provider.email ?? '')
      setTelefone(provider.telefone ?? '')
      setServico(provider.servico ?? '')
      setValor(provider.valor !== null ? String(provider.valor) : '')
      setDataInicio(provider.data_inicio ?? '')
      setExistingDocs(provider.documentos ?? EMPTY3(null))
      setLabels([
        provider.documentos?.[0]?.label ?? '',
        provider.documentos?.[1]?.label ?? '',
        provider.documentos?.[2]?.label ?? '',
      ])
    } else {
      setNome(''); setCnpj(''); setEmail(''); setTelefone(''); setServico(''); setValor(''); setDataInicio('')
      setExistingDocs(EMPTY3(null)); setLabels(EMPTY3(''))
    }
  }, [open, provider]) // eslint-disable-line react-hooks/exhaustive-deps

  function setAt<T>(setter: React.Dispatch<React.SetStateAction<T[]>>, i: number, value: T) {
    setter(prev => { const next = [...prev]; next[i] = value; return next })
  }

  function handleFilePick(i: number, e: React.ChangeEvent<HTMLInputElement>) {
    const f: File | null = e.target.files?.[0] ?? null
    setAt(setFiles, i, f)
    if (f) setAt<boolean>(setRemoveFlags, i, false)
  }

  function clearSlot(i: number) {
    setAt<File | null>(setFiles, i, null)
    setAt<boolean>(setRemoveFlags, i, true)
    if (fileRefs[i].current) fileRefs[i].current!.value = ''
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const fd = new FormData()
    fd.set('nome', nome)
    fd.set('cpf_cnpj', cnpj)
    fd.set('email', email)
    fd.set('telefone', telefone)
    fd.set('servico', servico)
    fd.set('valor', valor)
    fd.set('data_inicio', dataInicio)

    for (let i = 0; i < 3; i++) {
      if (files[i]) fd.set(`file_${i}`, files[i]!)
      if (removeFlags[i]) fd.set(`remove_${i}`, 'true')
      if (labels[i].trim()) fd.set(`label_${i}`, labels[i].trim())
    }

    const result = isEdit
      ? await updateProviderAction(provider!.id, fd)
      : await createProviderAction(companyId, fd)

    setLoading(false)
    if ('error' in result) { setError(result.error ?? 'Erro ao salvar.'); return }
    router.refresh()
    onClose()
  }

  const labelStyle = { color: 'var(--color-text-secondary)', fontSize: '0.75rem', fontWeight: 500, marginBottom: 4, display: 'block' }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Editar Prestador' : 'Novo Prestador'} className="sm:max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-4">

        <div>
          <label style={labelStyle}>Razão Social *</label>
          <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Razão social da empresa" required />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label style={labelStyle}>CNPJ</label>
            <Input value={cnpj} onChange={e => setCnpj(formatCnpj(e.target.value))} placeholder="00.000.000/0000-00" />
          </div>
          <div>
            <label style={labelStyle}>Telefone</label>
            <Input value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(00) 00000-0000" />
          </div>
        </div>

        <div>
          <label style={labelStyle}>E-mail</label>
          <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemplo.com" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label style={labelStyle}>Serviço / Especialidade</label>
            <Input value={servico} onChange={e => setServico(e.target.value)} placeholder="Ex: Contabilidade, TI..." />
          </div>
          <div>
            <label style={labelStyle}>Data de início</label>
            <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Valor por hora (R$)</label>
          <Input value={valor} onChange={e => setValor(e.target.value)} placeholder="0,00" inputMode="decimal" />
        </div>

        {/* Documentos — 3 slots */}
        <div className="pt-2 border-t" style={{ borderColor: 'var(--color-bg-surface)' }}>
          <p className="text-xs font-semibold mb-3 mt-3" style={{ color: 'var(--color-text-secondary)' }}>
            Documentos (até 3 arquivos · máx. 20 MB cada)
          </p>
          <div className="space-y-3">
            {[0, 1, 2].map(i => {
              const existing = existingDocs[i]
              const newFile = files[i]
              const showExisting = existing && !newFile && !removeFlags[i]
              return (
                <div key={i} className="p-3 rounded-lg border" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: '#FAFAFA' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium shrink-0" style={{ color: 'var(--color-text-muted)' }}>Arquivo {i + 1}</span>
                    {showExisting && (
                      <span className="text-xs truncate" style={{ color: 'var(--color-text-secondary)' }} title={existing!.nome}>
                        📎 {existing!.nome}
                      </span>
                    )}
                    {newFile && (
                      <span className="text-xs truncate" style={{ color: '#1E8449' }} title={newFile.name}>
                        ↑ {newFile.name}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      ref={fileRefs[i]}
                      type="file"
                      onChange={e => handleFilePick(i, e)}
                      className="text-xs flex-1"
                      style={{ color: 'var(--color-text-muted)' }}
                    />
                    {(showExisting || newFile) && (
                      <button type="button" onClick={() => clearSlot(i)}
                        className="text-xs px-2 py-1 rounded shrink-0" style={{ color: '#C0392B', backgroundColor: '#FDEDEC' }}>
                        Remover
                      </button>
                    )}
                  </div>

                  <Input
                    value={labels[i]}
                    onChange={e => setAt(setLabels, i, e.target.value)}
                    placeholder="Descrição do documento (opcional)"
                    className="mt-2 text-xs"
                  />
                </div>
              )
            })}
          </div>
        </div>

        {error && (
          <p className="text-sm p-3 rounded-lg bg-red-50" style={{ color: 'var(--color-error)' }}>{error}</p>
        )}

        <div className="flex gap-3 justify-end pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading}>{isEdit ? 'Salvar alterações' : 'Cadastrar'}</Button>
        </div>
      </form>
    </Modal>
  )
}
