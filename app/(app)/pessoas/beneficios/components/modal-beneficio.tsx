'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/toast'
import { REGRAS_DESCONTO, custoEmpresaMensal, descontoMensal, valorMensal, type RegraDesconto } from '@/lib/beneficios-calculo'
import { maskMoeda, normalizarValor } from '../../funcionarios/components/ficha/ficha-config'
import { createBenefitAction, updateBenefitAction } from '../actions'
import type { CompanyBenefit } from '../queries'

interface Props {
  open: boolean
  onClose: () => void
  companyId: string
  benefit: CompanyBenefit | null
}

const SALARIO_EXEMPLO = 3000
const COBRANCA = [{ value: 'mes', label: 'Por mês' }, { value: 'dia', label: 'Por dia trabalhado' }]

const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const comDecimais = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function Titulo({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{children}</p>
}

function Valor({ rotulo, valor, destaque }: { rotulo: string; valor: number; destaque?: boolean }) {
  return (
    <div className="flex flex-col min-w-0">
      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{rotulo}</span>
      <span className="text-sm font-bold" style={{ color: destaque ? 'var(--color-brand)' : 'var(--color-text-primary)' }}>{moeda(valor)}</span>
    </div>
  )
}

export function ModalBeneficio({ open, onClose, companyId, benefit }: Props) {
  const router = useRouter()
  const isEdit = !!benefit

  const [nome, setNome] = useState('')
  const [valor, setValor] = useState('')
  const [cobranca, setCobranca] = useState('mes')
  const [regra, setRegra] = useState<RegraDesconto>('nenhum')
  const [descontoTexto, setDescontoTexto] = useState('')
  const [ativo, setAtivo] = useState(true)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    const tipo = (benefit?.desconto_tipo ?? (benefit?.desconta_salario ? 'percentual_beneficio' : 'nenhum')) as RegraDesconto
    const desconto = benefit?.desconto_valor ?? (benefit?.desconta_salario ? 100 : 0)
    setNome(benefit?.nome ?? '')
    setValor(benefit && benefit.valor > 0 ? comDecimais(benefit.valor) : '')
    setCobranca(benefit?.por_dia_trabalhado ? 'dia' : 'mes')
    setRegra(tipo)
    setDescontoTexto(tipo === 'nenhum' ? '' : tipo === 'valor_fixo' ? comDecimais(desconto) : String(desconto).replace('.', ','))
    setAtivo(benefit?.ativo ?? true)
  }, [open, benefit])

  const percentual = regra === 'percentual_salario' || regra === 'percentual_beneficio'
  const numero = (texto: string) => Number(normalizarValor(texto)) || 0
  const descontoNumero = numero(descontoTexto)

  // Prévia com as mesmas contas da folha
  const simulado = {
    valor: numero(valor),
    por_dia_trabalhado: cobranca === 'dia',
    desconto_tipo: regra,
    desconto_valor: descontoNumero,
  }

  function escolherRegra(nova: RegraDesconto) {
    setRegra(nova)
    setDescontoTexto('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (regra !== 'nenhum' && descontoNumero <= 0) { toast.error(percentual ? 'Informe o percentual do desconto.' : 'Informe o valor do desconto.'); return }
    if (percentual && descontoNumero > 100) { toast.error('O percentual pode ser de até 100%.'); return }

    const fd = new FormData()
    fd.set('nome', nome)
    // A action lê com ponto decimal: "2.500,00" vai como "2500.00"
    fd.set('valor', normalizarValor(valor))
    fd.set('por_dia_trabalhado', String(cobranca === 'dia'))
    fd.set('desconto_tipo', regra)
    fd.set('desconto_valor', regra === 'nenhum' ? '0' : normalizarValor(descontoTexto))
    fd.set('ativo', String(ativo))

    setLoading(true)
    const result = await toast.promise(isEdit ? updateBenefitAction(benefit!.id, fd) : createBenefitAction(companyId, fd), {
      loading: 'Salvando o benefício…',
      success: isEdit ? 'Benefício salvo.' : 'Benefício criado.',
      error: 'Não foi possível salvar o benefício.',
    })
    setLoading(false)
    if ('error' in result) return
    router.refresh()
    onClose()
  }

  return (
    <Modal open={open} onClose={() => { if (!loading) onClose() }} title={isEdit ? 'Editar benefício' : 'Novo benefício'}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Input label="Nome do benefício *" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Vale-refeição" required />

        <div className="flex flex-col gap-3">
          <Titulo>O que a empresa oferece</Titulo>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
            <Input
              label="Valor (R$)"
              value={valor}
              onChange={(e) => setValor(maskMoeda(e.target.value))}
              placeholder="0,00"
              inputMode="numeric"
              hint="Pode ser ajustado por funcionário."
            />
            <Select label="Cobrança" options={COBRANCA} value={cobranca} onChange={(e) => setCobranca(e.target.value)} />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Titulo>O que é descontado do colaborador</Titulo>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
            <Select label="Regra de desconto" options={[...REGRAS_DESCONTO]} value={regra} onChange={(e) => escolherRegra(e.target.value as RegraDesconto)} />
            {percentual && (
              <Input
                label="Percentual (%) *"
                value={descontoTexto}
                onChange={(e) => setDescontoTexto(e.target.value.replace(/[^\d,]/g, ''))}
                placeholder="Ex.: 6"
                inputMode="decimal"
              />
            )}
            {regra === 'valor_fixo' && (
              <Input
                label="Valor do desconto (R$) *"
                value={descontoTexto}
                onChange={(e) => setDescontoTexto(maskMoeda(e.target.value))}
                placeholder="0,00"
                inputMode="numeric"
              />
            )}
          </div>
          {regra !== 'nenhum' && <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>O desconto nunca passa do valor do benefício.</p>}
        </div>

        {simulado.valor > 0 && (
          <div className="flex flex-col gap-2 rounded-xl p-3" style={{ backgroundColor: 'var(--color-brand-light)' }}>
            <p className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Por mês{regra === 'percentual_salario' ? `, com salário de ${moeda(SALARIO_EXEMPLO)}` : ''}
            </p>
            <div className="grid grid-cols-3 gap-3">
              <Valor rotulo="Oferecido" valor={valorMensal(simulado)} />
              <Valor rotulo="Descontado" valor={descontoMensal(simulado, null, SALARIO_EXEMPLO)} />
              <Valor rotulo="Custo da empresa" valor={custoEmpresaMensal(simulado, null, SALARIO_EXEMPLO)} destaque />
            </div>
          </div>
        )}

        {isEdit && (
          <label className="flex items-start gap-2.5 text-sm cursor-pointer" style={{ color: 'var(--color-text-secondary)' }}>
            <input type="checkbox" className="mt-0.5 w-4 h-4 shrink-0" style={{ accentColor: 'var(--color-brand)' }} checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
            <span>
              <span className="font-medium">Benefício ativo</span>
              <span className="block text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>Inativo, deixa de entrar nos totais e nas novas admissões.</span>
            </span>
          </label>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button type="submit" loading={loading}>{isEdit ? 'Salvar' : 'Criar benefício'}</Button>
        </div>
      </form>
    </Modal>
  )
}
