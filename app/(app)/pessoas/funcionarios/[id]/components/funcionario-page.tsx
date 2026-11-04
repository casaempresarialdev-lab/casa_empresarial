'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { pdf } from '@react-pdf/renderer'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { toast } from '@/lib/toast'
import { FuncionarioFicha } from '../../components/ficha/funcionario-ficha'
import { FichaPdf } from '../../components/ficha/ficha-pdf'
import { STATUS_CFG, iniciais, tipoLabel, type SecaoId } from '../../components/ficha/ficha-config'
import { MeusDadosForm } from './meus-dados-form'
import type { Employee } from '../../queries'
import type { CompanyBenefit } from '../../../beneficios/queries'
import type { Company } from '../../../../empresa/queries'

interface Props {
  modo: 'ver' | 'editar'
  employee: Employee
  companyId: string
  company: Company | null
  companyBenefits: CompanyBenefit[]
  fotoUrl: string | null
  abaInicial?: SecaoId
  /** Colaborador vendo a própria ficha: edita só os dados de contato (Meus Dados) */
  isColaboradorSelf: boolean
}

// Foto baixada como data URL para o PDF (sem foto, ou se falhar, o PDF usa as iniciais)
async function fotoParaPdf(url: string | null) {
  if (!url) return null
  try {
    const blob = await (await fetch(url)).blob()
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

// Ficha do funcionário: visualizar (abas, campos fechados) e editar (mesmas abas, campos abertos)
export function FuncionarioPage({ modo, employee: emp, companyId, company, companyBenefits, fotoUrl, abaInicial, isColaboradorSelf }: Props) {
  const router = useRouter()
  const abaRef = useRef<SecaoId>(abaInicial ?? 'identificacao')
  const [gerandoPdf, setGerandoPdf] = useState(false)
  const [meusDadosOpen, setMeusDadosOpen] = useState(false)

  const base = `/pessoas/funcionarios/${emp.id}`
  const status = STATUS_CFG[emp.status]
  const editando = modo === 'editar'

  const voltarParaFicha = () => router.push(`${base}?aba=${abaRef.current}`)

  function editar() {
    if (isColaboradorSelf) { setMeusDadosOpen(true); return }
    router.push(`${base}/editar?aba=${abaRef.current}`)
  }

  async function exportarPdf() {
    setGerandoPdf(true)
    try {
      const agora = new Date()
      const geradoEm = `${agora.toLocaleDateString('pt-BR')} às ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
      const doc = (foto: string | null) => <FichaPdf employee={emp} company={company} foto={foto} benefits={companyBenefits} geradoEm={geradoEm} />
      // Se a logo/foto não carregar, gera de novo sem as imagens
      let blob: Blob
      try {
        blob = await pdf(doc(await fotoParaPdf(fotoUrl))).toBlob()
      } catch {
        blob = await pdf(<FichaPdf employee={emp} company={company ? { ...company, logo_url: null } : null} foto={null} benefits={companyBenefits} geradoEm={geradoEm} />).toBlob()
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ficha-${emp.nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Não foi possível gerar o PDF da ficha.')
    } finally {
      setGerandoPdf(false)
    }
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => (editando ? voltarParaFicha() : router.push(isColaboradorSelf ? '/pessoas/registro-de-ponto' : '/pessoas/funcionarios'))}
        className="flex items-center gap-1.5 text-sm"
        style={{ color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        ← {editando ? emp.nome : isColaboradorSelf ? 'Voltar' : 'Funcionários'}
      </button>

      {/* Foto + nome + selos; breadcrumb embaixo. As ações ficam dentro da caixa, na linha das abas */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex items-center gap-3 min-w-0 animate-enter">
          <span
            className="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center shrink-0 text-base font-bold"
            style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {fotoUrl ? <img src={fotoUrl} alt={emp.nome} className="w-full h-full object-cover" /> : iniciais(emp.nome)}
          </span>
          <div className="min-w-0">
            <h1 className="text-3xl font-extrabold truncate" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>
              {editando ? `Editar · ${emp.nome}` : emp.nome}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {status && (
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full" style={{ backgroundColor: status.bg, color: status.color }}>
                  {status.label}
                </span>
              )}
              {emp.tipo_contrato && (
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-brand)' }}>
                  {tipoLabel(emp.tipo_contrato)}
                </span>
              )}
              {(emp.cargo || emp.servico) && (
                <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{emp.cargo || emp.servico}</span>
              )}
            </div>
          </div>
        </div>

        <Breadcrumb segmentLabels={{ [emp.id]: emp.nome }} />
      </div>

      <div className="app-card p-6">
        <FuncionarioFicha
          key={modo}
          modo={modo}
          employee={emp}
          companyId={companyId}
          companyBenefits={companyBenefits}
          fotoUrl={fotoUrl}
          abaInicial={abaInicial}
          onAbaChange={(a) => { abaRef.current = a }}
          podeGerenciar={!isColaboradorSelf}
          acoes={!editando && (
            <>
              <Button type="button" variant="secondary" onClick={exportarPdf} loading={gerandoPdf}>
                {!gerandoPdf && <Icon name="download" size={16} />}
                Exportar PDF
              </Button>
              <Button type="button" onClick={editar}>
                <Icon name="pencil" size={16} />
                Editar
              </Button>
            </>
          )}
          onCancel={voltarParaFicha}
          onSaved={voltarParaFicha}
        />
      </div>

      {isColaboradorSelf && <MeusDadosForm open={meusDadosOpen} onClose={() => setMeusDadosOpen(false)} employee={emp} />}
    </div>
  )
}
