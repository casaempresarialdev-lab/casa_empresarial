'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createProductAction, updateProductAction } from '../actions'
import type { Product } from '../queries'

interface Props {
  open: boolean
  onClose: () => void
  companyId: string
  product: Product | null
}

const UNIDADES = ['un', 'kg', 'g', 'l', 'ml', 'm', 'cm', 'cx', 'pc', 'par', 'pct', 'h']

export function ModalProduto({ open, onClose, companyId, product }: Props) {
  const router = useRouter()
  const isEdit = !!product
  const fotoInputRef = useRef<HTMLInputElement>(null)

  const [tipo, setTipo] = useState<'produto' | 'servico'>('produto')
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
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
  const [tipoFiscal, setTipoFiscal] = useState('')
  const [ncm, setNcm] = useState('')
  const [origem, setOrigem] = useState('')
  const [cest, setCest] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Margem calculada localmente para feedback visual
  const margem = (() => {
    const pv = parseFloat(precoVenda.replace(',', '.'))
    const pc = parseFloat(precoCusto.replace(',', '.'))
    if (!isNaN(pv) && !isNaN(pc) && pc > 0) {
      return (((pv - pc) / pc) * 100).toFixed(1)
    }
    return null
  })()

  useEffect(() => {
    if (!open) return
    setError('')
    if (fotoInputRef.current) fotoInputRef.current.value = ''
    if (product) {
      setTipo(product.tipo)
      setFotoPreview(product.foto_url)
      setNome(product.nome)
      setDescricao(product.descricao ?? '')
      setSku(product.sku ?? '')
      setCodigoBarras(product.codigo_barras ?? '')
      setCategoria(product.categoria ?? '')
      setPrecoVenda(product.preco_venda !== null ? String(product.preco_venda) : '')
      setPrecoCusto(product.preco_custo !== null ? String(product.preco_custo) : '')
      setEstoqueAtual(String(product.estoque_atual))
      setEstoqueMinimo(String(product.estoque_minimo))
      setUnidadeMedida(product.unidade_medida)
      setTipoFiscal(product.tipo_fiscal ?? '')
      setNcm(product.ncm ?? '')
      setOrigem(product.origem ?? '')
      setCest(product.cest ?? '')
    } else {
      setTipo('produto'); setFotoPreview(null); setNome(''); setDescricao(''); setSku('')
      setCodigoBarras(''); setCategoria(''); setPrecoVenda(''); setPrecoCusto('')
      setEstoqueAtual('0'); setEstoqueMinimo('0'); setUnidadeMedida('un')
      setTipoFiscal(''); setNcm(''); setOrigem(''); setCest('')
    }
  }, [open, product])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const fd = new FormData()
    const fotoFile = fotoInputRef.current?.files?.[0]
    if (fotoFile) fd.set('foto_file', fotoFile)
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
    fd.set('tipo_fiscal', tipoFiscal)
    fd.set('ncm', ncm)
    fd.set('origem', origem)
    fd.set('cest', cest)

    const result = isEdit
      ? await updateProductAction(product!.id, fd)
      : await createProductAction(companyId, fd)

    setLoading(false)
    if ('error' in result) { setError(result.error ?? 'Erro ao salvar.'); return }
    router.refresh()
    onClose()
  }

  const labelStyle = { color: 'var(--color-text-secondary)', fontSize: '0.75rem', fontWeight: 500, marginBottom: 4, display: 'block' }
  const sectionTitle = { color: 'var(--color-primary-darker)', fontSize: '0.8rem', fontWeight: 600, marginBottom: 12, paddingBottom: 6, borderBottom: '1px solid var(--color-bg-surface)' }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Editar Item' : 'Novo Item'} className="sm:max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Tipo */}
        <div className="flex gap-2">
          {(['produto', 'servico'] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTipo(t)}
              className="flex-1 py-2 rounded-lg text-sm font-medium border transition-colors"
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
              <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do produto ou serviço" required />
            </div>

            {tipo === 'produto' && (
              <div>
                <label style={labelStyle}>Foto do Produto</label>
                <div className="flex items-center gap-4">
                  {fotoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={fotoPreview} alt="Preview" className="w-16 h-16 rounded-xl object-cover border flex-shrink-0" style={{ borderColor: 'var(--color-bg-surface)' }} />
                  ) : (
                    <div className="w-16 h-16 rounded-xl border flex items-center justify-center text-2xl flex-shrink-0" style={{ borderColor: 'var(--color-bg-surface)', backgroundColor: 'var(--color-bg-surface)' }}>📦</div>
                  )}
                  <div className="flex items-center gap-3">
                    <label className="cursor-pointer text-sm px-4 py-2 rounded-lg border transition-colors hover:bg-gray-50" style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-secondary)' }}>
                      {fotoPreview ? 'Trocar foto' : 'Selecionar foto'}
                      <input
                        ref={fotoInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={e => {
                          const f = e.target.files?.[0]
                          if (f) setFotoPreview(URL.createObjectURL(f))
                        }}
                      />
                    </label>
                    {fotoPreview && (
                      <button
                        type="button"
                        onClick={() => { setFotoPreview(null); if (fotoInputRef.current) fotoInputRef.current.value = '' }}
                        className="text-sm hover:underline"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        Remover
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>PNG, JPG ou WEBP — máx. 5 MB</p>
              </div>
            )}

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
            {tipo === 'produto' && (
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
            )}
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
                <Input value={precoVenda} onChange={e => setPrecoVenda(e.target.value)} placeholder="0,00" inputMode="decimal" />
              </div>
              <div>
                <label style={labelStyle}>Preço de Custo (R$)</label>
                <Input value={precoCusto} onChange={e => setPrecoCusto(e.target.value)} placeholder="0,00" inputMode="decimal" />
              </div>
            </div>
            {margem !== null && (
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
                style={{ backgroundColor: parseFloat(margem) >= 0 ? '#DCFCE7' : '#FEE2E2', color: parseFloat(margem) >= 0 ? '#15803D' : '#B91C1C' }}
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

        {/* Fiscal */}
        <div>
          <p style={sectionTitle}>Fiscal</p>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={labelStyle}>Tipo Fiscal</label>
                <select
                  value={tipoFiscal}
                  onChange={e => setTipoFiscal(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                >
                  <option value="">Selecione...</option>
                  <option value="mercadoria">Mercadoria</option>
                  <option value="servico">Serviço</option>
                  <option value="materia_prima">Matéria Prima</option>
                  <option value="produto_acabado">Produto Acabado</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Origem</label>
                <select
                  value={origem}
                  onChange={e => setOrigem(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)' }}
                >
                  <option value="">Selecione...</option>
                  <option value="nacional">Nacional</option>
                  <option value="importado">Importado</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={labelStyle}>NCM — Nomenclatura Comum do Mercosul</label>
                <Input value={ncm} onChange={e => setNcm(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="00000000" inputMode="numeric" maxLength={8} />
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>8 dígitos</p>
              </div>
              <div>
                <label style={labelStyle}>CEST — Cód. Especificador da Substituição Tributária</label>
                <Input value={cest} onChange={e => setCest(e.target.value.replace(/\D/g, ''))} placeholder="Somente números" inputMode="numeric" />
              </div>
            </div>
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
