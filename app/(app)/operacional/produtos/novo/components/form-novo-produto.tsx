'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createProductAction } from '../../actions'

const UNIDADES = ['un', 'kg', 'g', 'l', 'ml', 'm', 'cm', 'cx', 'pc', 'par', 'pct', 'h']

interface Props {
  companyId: string
}

export function FormNovoProduto({ companyId }: Props) {
  const router = useRouter()

  const [tipo, setTipo] = useState<'produto' | 'servico'>('produto')
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [sku, setSku] = useState('')
  const [codigoBarras, setCodigoBarras] = useState('')
  const [categoria, setCategoria] = useState('')
  const [precoVenda, setPrecoVenda] = useState('')
  const [precoCusto, setPrecoCusto] = useState('')
  const [estoqueAtual, setEstoqueAtual] = useState('0')
  const [estoqueMinimo, setEstoqueMinimo] = useState('0')
  const [unidadeMedida, setUnidadeMedida] = useState('un')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const margem = (() => {
    const pv = parseFloat(precoVenda.replace(',', '.'))
    const pc = parseFloat(precoCusto.replace(',', '.'))
    if (!isNaN(pv) && !isNaN(pc) && pc > 0) {
      return (((pv - pc) / pc) * 100).toFixed(1)
    }
    return null
  })()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const fd = new FormData()
    fd.set('nome', nome)
    fd.set('tipo', tipo)
    fd.set('descricao', descricao)
    fd.set('sku', sku)
    fd.set('codigo_barras', codigoBarras)
    fd.set('categoria', categoria)
    fd.set('preco_venda', precoVenda)
    fd.set('preco_custo', precoCusto)
    fd.set('estoque_atual', estoqueAtual)
    fd.set('estoque_minimo', estoqueMinimo)
    fd.set('unidade_medida', unidadeMedida)

    const result = await createProductAction(companyId, fd)
    setLoading(false)

    if ('error' in result) {
      setError(result.error ?? 'Erro ao salvar.')
      return
    }

    router.push('/operacional/produtos')
  }

  const labelStyle: React.CSSProperties = {
    color: 'var(--color-text-secondary)',
    fontSize: '0.75rem',
    fontWeight: 500,
    marginBottom: 4,
    display: 'block',
  }

  const sectionTitle: React.CSSProperties = {
    color: 'var(--color-primary-darker)',
    fontSize: '0.8rem',
    fontWeight: 600,
    marginBottom: 12,
    paddingBottom: 6,
    borderBottom: '1px solid var(--color-bg-surface)',
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Cabeçalho */}
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={() => router.push('/operacional/produtos')}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 14L6 9l5-5" />
          </svg>
        </button>
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
            Novo Item
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Cadastrar produto ou serviço no catálogo
          </p>
        </div>
      </div>

      <div
        className="rounded-xl border p-6 space-y-6"
        style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'white' }}
      >
        {/* Tipo */}
        <div className="flex gap-2">
          {(['produto', 'servico'] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTipo(t)}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium border transition-colors"
              style={{
                backgroundColor: tipo === t ? 'var(--color-primary)' : 'white',
                borderColor: tipo === t ? 'var(--color-primary-dark)' : 'var(--color-bg-surface)',
                color: tipo === t ? 'var(--color-primary-darker)' : 'var(--color-text-secondary)',
              }}
            >
              {t === 'produto' ? '📦 Produto' : '🔧 Serviço'}
            </button>
          ))}
        </div>

        {/* Identificação */}
        <div>
          <p style={sectionTitle}>Identificação</p>
          <div className="space-y-3">
            <div>
              <label style={labelStyle}>Nome *</label>
              <Input
                value={nome}
                onChange={e => setNome(e.target.value)}
                placeholder="Nome do produto ou serviço"
                required
              />
            </div>
            <div>
              <label style={labelStyle}>Descrição</label>
              <textarea
                value={descricao}
                onChange={e => setDescricao(e.target.value)}
                rows={2}
                placeholder="Descrição opcional..."
                className="w-full px-3 py-2 rounded-lg border text-sm resize-none"
                style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={labelStyle}>SKU / Código Interno</label>
                <Input value={sku} onChange={e => setSku(e.target.value)} placeholder="Ex: PROD-001" />
              </div>
              <div>
                <label style={labelStyle}>Código de Barras</label>
                <Input value={codigoBarras} onChange={e => setCodigoBarras(e.target.value)} placeholder="EAN-13..." />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Categoria</label>
              <Input value={categoria} onChange={e => setCategoria(e.target.value)} placeholder="Ex: Eletrônicos, Alimentos..." />
            </div>
          </div>
        </div>

        {/* Precificação */}
        <div>
          <p style={sectionTitle}>Precificação</p>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={labelStyle}>Preço de Venda (R$)</label>
                <Input
                  value={precoVenda}
                  onChange={e => setPrecoVenda(e.target.value)}
                  placeholder="0,00"
                  inputMode="decimal"
                />
              </div>
              <div>
                <label style={labelStyle}>Preço de Custo (R$)</label>
                <Input
                  value={precoCusto}
                  onChange={e => setPrecoCusto(e.target.value)}
                  placeholder="0,00"
                  inputMode="decimal"
                />
              </div>
            </div>
            {margem !== null && (
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
                style={{
                  backgroundColor: parseFloat(margem) >= 0 ? '#E9F7EF' : '#FDEDEC',
                  color: parseFloat(margem) >= 0 ? '#1E8449' : '#C0392B',
                }}
              >
                <span>Margem calculada:</span>
                <span className="font-bold">{margem}%</span>
              </div>
            )}
          </div>
        </div>

        {/* Estoque — apenas para produtos */}
        {tipo === 'produto' && (
          <div>
            <p style={sectionTitle}>Estoque</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label style={labelStyle}>Estoque Atual</label>
                <Input type="number" min="0" value={estoqueAtual} onChange={e => setEstoqueAtual(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Estoque Mínimo</label>
                <Input type="number" min="0" value={estoqueMinimo} onChange={e => setEstoqueMinimo(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Unidade</label>
                <select
                  value={unidadeMedida}
                  onChange={e => setUnidadeMedida(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                >
                  {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        {error && (
          <p className="text-sm p-3 rounded-lg bg-red-50" style={{ color: 'var(--color-error)' }}>{error}</p>
        )}
      </div>

      {/* Rodapé */}
      <div className="flex gap-3 justify-end mt-4">
        <Button type="button" variant="ghost" onClick={() => router.push('/operacional/produtos')}>
          Cancelar
        </Button>
        <Button type="submit" loading={loading}>
          Cadastrar
        </Button>
      </div>
    </form>
  )
}
