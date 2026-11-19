'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { SummaryCard } from '@/components/modules/dashboard/summary-card'
import { AddButton } from '@/components/ui/add-button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { FilterResult, FilterSelect, SearchField } from '@/components/ui/filter-select'
import { ListEmpty, ListItem } from '@/components/ui/list-item'
import { toast } from '@/lib/toast'
import { deleteContactAction } from '../actions'
import type { Contact } from '../queries'
import { ModalContato } from './modal-contato'

function docMask(doc: string | null, tipo: 'PF' | 'PJ') {
  if (!doc) return null
  const d = doc.replace(/\D/g, '')
  if (tipo === 'PF') return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : doc
  return d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : doc
}

function Selo({ texto, fundo, cor }: { texto: string; fundo: string; cor: string }) {
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap" style={{ backgroundColor: fundo, color: cor }}>{texto}</span>
}

const PAPEL_SELO: Record<Contact['papel'], { texto: string; fundo: string; cor: string }> = {
  cliente: { texto: 'Cliente', fundo: '#DBEAFE', cor: '#1D4ED8' },
  fornecedor: { texto: 'Fornecedor', fundo: '#FEF3C7', cor: '#B45309' },
  ambos: { texto: 'Cliente e Fornecedor', fundo: '#F3F4F6', cor: '#6B7280' },
}

const FILTRO_TIPO = [
  { value: 'todos', label: 'Todos' },
  { value: 'PF', label: 'Pessoa Física' },
  { value: 'PJ', label: 'Pessoa Jurídica' },
]
const FILTRO_PAPEL = [
  { value: 'todos', label: 'Clientes e Fornecedores' },
  { value: 'cliente', label: 'Clientes' },
  { value: 'fornecedor', label: 'Fornecedores' },
  { value: 'ambos', label: 'Cliente e Fornecedor' },
]

interface Props {
  contacts: Contact[]
  companyId: string
}

// Clientes e fornecedores, usados nos Pedidos de Compra/Venda e nos lançamentos do Fluxo de Caixa
export function ContatosClient({ contacts, companyId }: Props) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Contact | null>(null)
  const [excluir, setExcluir] = useState<Contact | null>(null)
  const [excluindo, setExcluindo] = useState(false)
  const [busca, setBusca] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [filtroPapel, setFiltroPapel] = useState('todos')

  const pf = contacts.filter((c) => c.tipo === 'PF')
  const pj = contacts.filter((c) => c.tipo === 'PJ')

  const q = busca.trim().toLowerCase()
  const visiveis = contacts
    .filter((c) => filtroTipo === 'todos' || c.tipo === filtroTipo)
    .filter((c) => filtroPapel === 'todos' || c.papel === filtroPapel)
    .filter((c) => !q || c.nome.toLowerCase().includes(q) || (c.cpf_cnpj ?? '').includes(q) || (c.email ?? '').toLowerCase().includes(q) || (c.telefone ?? '').includes(q))

  function abrirNovo() { setEditing(null); setModalOpen(true) }
  function abrirEdicao(c: Contact) { setEditing(c); setModalOpen(true) }

  async function confirmarExclusao() {
    if (!excluir) return
    setExcluindo(true)
    const r = await toast.promise(deleteContactAction(excluir.id), {
      loading: `Excluindo ${excluir.nome}…`,
      success: `${excluir.nome} excluído.`,
      error: 'Não foi possível excluir o contato.',
    })
    setExcluindo(false)
    setExcluir(null)
    if (!('error' in r)) router.refresh()
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>Contatos</h1>
        <Breadcrumb />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <SummaryCard icon="users" title="Contatos" value={contacts.length} caption={contacts.length === 1 ? 'cadastrado' : 'cadastrados'} />
        <SummaryCard icon="user" title="Pessoas Físicas" value={pf.length} caption="clientes e fornecedores PF" delay={60} />
        <SummaryCard icon="briefcase" title="Pessoas Jurídicas" value={pj.length} caption="clientes e fornecedores PJ" delay={120} />
      </div>

      <div className="app-card p-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {contacts.length} {contacts.length === 1 ? 'contato' : 'contatos'}
          </p>
          <AddButton onClick={abrirNovo} label="Novo contato" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SearchField value={busca} onChange={setBusca} placeholder="Pesquisar por nome, CPF/CNPJ, e-mail ou telefone..." />
          <FilterSelect value={filtroTipo} onChange={setFiltroTipo} label="Filtrar por tipo" options={FILTRO_TIPO} />
          <FilterSelect value={filtroPapel} onChange={setFiltroPapel} label="Filtrar por papel" options={FILTRO_PAPEL} />
          {(busca || filtroTipo !== 'todos' || filtroPapel !== 'todos') && (
            <FilterResult total={visiveis.length} onClear={() => { setBusca(''); setFiltroTipo('todos'); setFiltroPapel('todos') }} />
          )}
        </div>

        <ul className="flex flex-col gap-3">
          {visiveis.length === 0 && (
            <ListEmpty>{contacts.length === 0 ? 'Cadastre o primeiro cliente ou fornecedor.' : 'Nenhum contato encontrado.'}</ListEmpty>
          )}
          {visiveis.map((c) => {
            const doc = docMask(c.cpf_cnpj, c.tipo)
            return (
              <ListItem
                key={c.id}
                media={c.foto_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.foto_url} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                ) : undefined}
                icon={c.foto_url ? undefined : (c.tipo === 'PJ' ? 'briefcase' : 'user')}
                title={c.nome}
                subtitle={[doc, c.email, c.telefone].filter(Boolean).join(' · ') || undefined}
                aside={<Selo {...PAPEL_SELO[c.papel]} />}
                onClick={() => abrirEdicao(c)}
                actionsLabel={c.nome}
                actions={[
                  { icon: 'eye', label: 'Visualizar', onClick: () => router.push(`/operacional/contatos/${c.id}`) },
                  { icon: 'pencil', label: 'Editar', onClick: () => abrirEdicao(c) },
                  { icon: 'trash', label: 'Excluir', tone: 'danger', onClick: () => setExcluir(c) },
                ]}
              />
            )
          })}
        </ul>
      </div>

      <ModalContato open={modalOpen} onClose={() => setModalOpen(false)} companyId={companyId} contact={editing} />

      <ConfirmDialog
        open={!!excluir}
        onClose={() => { if (!excluindo) setExcluir(null) }}
        onConfirm={confirmarExclusao}
        loading={excluindo}
        title="Excluir contato"
        confirmLabel="Excluir"
        message={<p>Excluir <strong>{excluir?.nome}</strong>? Pedidos e lançamentos que já usam este contato não são apagados.</p>}
      />
    </>
  )
}
