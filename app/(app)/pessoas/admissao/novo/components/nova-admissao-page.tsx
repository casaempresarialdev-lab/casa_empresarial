'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Breadcrumb } from '@/components/layout/breadcrumb'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { toast } from '@/lib/toast'
import { FuncionarioFicha, type CadastroConcluido } from '../../../funcionarios/components/ficha/funcionario-ficha'
import type { CompanyBenefit } from '../../../beneficios/queries'

interface Props {
  companyId: string
  companyBenefits: CompanyBenefit[]
}

// Nova admissão: ficha do funcionário em etapas; ao concluir, o link de auto-cadastro para enviar
export function NovaAdmissaoPage({ companyId, companyBenefits }: Props) {
  const router = useRouter()
  const [concluido, setConcluido] = useState<CadastroConcluido | null>(null)
  // Remonta o formulário vazio em "Nova admissão"
  const [formKey, setFormKey] = useState(0)

  const voltar = () => router.push('/pessoas/admissao')

  async function copiarLink() {
    if (!concluido?.link) return
    await navigator.clipboard.writeText(concluido.link)
    toast('Link copiado.')
  }

  function enviarWhatsApp() {
    if (!concluido?.link) return
    const primeiroNome = concluido.nome.split(' ')[0]
    const msg = encodeURIComponent(`Olá, ${primeiroNome}! Acesse o link abaixo para preencher seus dados de admissão:\n${concluido.link}`)
    const fone = concluido.telefone.replace(/\D/g, '')
    window.open(fone ? `https://wa.me/55${fone}?text=${msg}` : `https://wa.me/?text=${msg}`, '_blank')
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={voltar}
        className="flex items-center gap-1.5 text-sm"
        style={{ color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        ← Admissão
      </button>

      {/* Título e breadcrumb na mesma linha */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h1 className="text-3xl font-extrabold animate-enter" style={{ fontFamily: 'Manrope', color: 'var(--color-brand)' }}>
          Nova admissão
        </h1>
        <Breadcrumb current="Nova admissão" />
      </div>

      <div className="app-card p-6">
        {concluido ? (
          <div className="max-w-lg mx-auto py-6 flex flex-col items-center text-center gap-4">
            <span className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: '#DCFCE7', color: '#15803D' }}>
              <Icon name="check" size={32} />
            </span>
            <div>
              <h2 className="text-xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
                Admissão iniciada
              </h2>
              <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
                {concluido.nome} foi cadastrado.
                {concluido.link && ' Envie o link abaixo para que o funcionário preencha os demais dados.'}
              </p>
            </div>

            {concluido.pediuAcesso && (
              <p className="text-sm" style={{ color: concluido.acessoMsg ? '#B45309' : '#15803D' }}>
                {concluido.acessoMsg ?? 'Convite de acesso ao sistema enviado por e-mail.'}
              </p>
            )}

            {concluido.link && (
              <div className="w-full rounded-xl border p-4 text-left" style={{ borderColor: 'var(--color-card-border)', backgroundColor: 'var(--color-brand-light)' }}>
                <p className="text-xs font-semibold mb-1" style={{ color: 'var(--color-brand)' }}>Link de auto-cadastro · válido por 7 dias</p>
                <p className="text-xs break-all mb-3" style={{ color: 'var(--color-text-secondary)' }}>{concluido.link}</p>
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" className="flex-1" onClick={copiarLink}>Copiar link</Button>
                  <Button type="button" className="flex-1" style={{ backgroundColor: '#25D366' }} onClick={enviarWhatsApp}>Enviar por WhatsApp</Button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap justify-center gap-2 pt-2">
              <Button type="button" onClick={() => router.push(`/pessoas/funcionarios/${concluido.employeeId}`)}>Ver ficha</Button>
              <Button type="button" variant="secondary" onClick={voltar}>Ir para Admissão</Button>
              <Button type="button" variant="ghost" onClick={() => { setConcluido(null); setFormKey((k) => k + 1) }}>Nova admissão</Button>
            </div>
          </div>
        ) : (
          <FuncionarioFicha
            key={formKey}
            modo="cadastro"
            employee={null}
            companyId={companyId}
            companyBenefits={companyBenefits}
            onCancel={voltar}
            onCreated={setConcluido}
          />
        )}
      </div>
    </div>
  )
}
