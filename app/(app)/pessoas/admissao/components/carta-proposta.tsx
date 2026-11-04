'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/lib/toast'
import { cartaSchema, fmtDataHora, preencherModelo, type CartaInput } from '@/lib/validations/admissao'
import { enviarCartaAction } from '../actions'
import { getEmployeeDocUrlAction } from '../../funcionarios/actions'
import { fmtDate, fmtMoney, tipoLabel } from '../../funcionarios/components/ficha/ficha-config'
import type { Carta, ConfigAdmissao, EmAdmissao } from '../queries'

const brl = (n: number | null) => (n != null ? n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '')

interface Props {
  emp: EmAdmissao
  carta: Carta | undefined
  config: ConfigAdmissao
  empresa: string
  companyId: string
}

// Etapa "Enviar carta proposta": preparar e enviar; depois, acompanhar a resposta
export function CartaProposta({ emp, carta, config, empresa, companyId }: Props) {
  const router = useRouter()
  const [abrirForm, setAbrirForm] = useState(false)
  const [linkEnviado, setLinkEnviado] = useState<string | null>(null)
  const [baixando, setBaixando] = useState(false)
  const [agora] = useState(() => Date.now())

  const expirada = carta?.status === 'enviada' && Date.parse(carta.expira_em) < agora
  const aguardando = carta?.status === 'enviada' && !expirada

  const validade = new Date(agora + config.carta_validade_dias * 86_400_000)
  const salarioInicial = emp.salario ?? emp.valor_servico

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<CartaInput>({
    resolver: zodResolver(cartaSchema),
    defaultValues: {
      cargo: emp.cargo ?? '',
      salario: brl(salarioInicial),
      beneficios: emp.beneficios.join(', '),
      data_inicio: emp.data_admissao ?? '',
      local_trabalho: emp.local_trabalho ?? '',
      conteudo: '',
    },
  })

  // O texto acompanha os campos até a pessoa editar à mão
  const [textoEditado, setTextoEditado] = useState(false)
  const [cargo, salario, beneficios, dataInicio, local, conteudo] = watch(['cargo', 'salario', 'beneficios', 'data_inicio', 'local_trabalho', 'conteudo'])
  const textoDoModelo = preencherModelo(config.carta_modelo, {
    nome: emp.nome,
    empresa,
    vaga: emp.vaga?.titulo ?? '',
    cargo,
    tipo_contrato: tipoLabel(emp.tipo_contrato),
    salario: salario ? fmtMoney(salario) : '',
    beneficios,
    data_inicio: fmtDate(dataInicio),
    local,
    validade: fmtDataHora(validade.toISOString()),
  })
  const textoAtual = textoEditado ? conteudo : textoDoModelo

  async function enviar(d: CartaInput) {
    const r = await toast.promise(enviarCartaAction(companyId, emp.id, { ...d, conteudo: textoAtual }), {
      loading: 'Enviando a carta proposta…',
      success: (res) => ('emailEnviado' in res && res.emailEnviado ? `Carta enviada para ${emp.email}.` : 'Carta criada.'),
      error: 'Não foi possível enviar a carta.',
    })
    if ('error' in r) return
    if (!r.emailEnviado) {
      toast.error('O e-mail não foi enviado. Copie o link e envie por outro meio.')
      setLinkEnviado(r.link)
    }
    setAbrirForm(false)
    router.refresh()
  }

  // O texto vem da tela (modelo ou edição); o campo "conteudo" só é validado no envio
  function enviarFormulario() {
    setValue('conteudo', textoAtual)
    void handleSubmit(enviar)()
  }

  async function copiarLink(link: string) {
    await navigator.clipboard.writeText(link)
    toast('Link copiado.')
  }

  async function baixarPdf() {
    setBaixando(true)
    const r = await getEmployeeDocUrlAction(emp.id, 'carta_proposta', `Carta proposta - ${emp.nome}.pdf`)
    setBaixando(false)
    if (r.error || !r.url) { toast.error(r.error ?? 'Não foi possível baixar o PDF.'); return }
    window.location.assign(r.url)
  }

  const linkPublico = carta ? `${typeof window !== 'undefined' ? window.location.origin : ''}/carta/${carta.token}` : ''

  // Aceita: registro do aceite
  if (carta?.status === 'aceita') {
    return (
      <div className="rounded-xl border p-3.5 flex flex-wrap items-center justify-between gap-3" style={{ borderColor: '#BBF7D0', backgroundColor: '#F0FDF4' }}>
        <div>
          <p className="text-sm font-semibold" style={{ color: '#15803D' }}>Aceita em {fmtDataHora(carta.respondida_em!)}</p>
          {carta.resposta_ip && <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>IP {carta.resposta_ip}</p>}
        </div>
        {carta.pdf_path && <Button type="button" variant="secondary" size="sm" onClick={baixarPdf} loading={baixando}>Baixar PDF</Button>}
      </div>
    )
  }

  const mostrarForm = abrirForm || !aguardando

  return (
    <div className="flex flex-col gap-3">
      {aguardando && (
        <div className="rounded-xl border p-3.5 flex flex-col gap-2" style={{ borderColor: 'var(--color-card-border)', backgroundColor: 'var(--color-brand-light)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Enviada em {fmtDataHora(carta!.created_at)}. Aguardando a resposta até {fmtDataHora(carta!.expira_em)}.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => copiarLink(linkEnviado ?? linkPublico)}>Copiar link</Button>
            {!abrirForm && <Button type="button" variant="ghost" size="sm" onClick={() => setAbrirForm(true)}>Enviar nova carta</Button>}
          </div>
        </div>
      )}
      {expirada && (
        <p className="text-sm p-3 rounded-lg" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
          A carta enviada em {fmtDataHora(carta!.created_at)} expirou sem resposta. Envie uma nova.
        </p>
      )}

      {mostrarForm && (
        <form onSubmit={(e) => { e.preventDefault(); enviarFormulario() }} noValidate className="flex flex-col gap-3">
          {aguardando && (
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>A nova carta substitui a anterior, e o link antigo deixa de funcionar.</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input label="Cargo" error={errors.cargo?.message} {...register('cargo')} />
            <Input label="Remuneração (R$)" inputMode="decimal" placeholder="0,00" error={errors.salario?.message} {...register('salario')} />
            <Input label="Data de início *" type="date" error={errors.data_inicio?.message} {...register('data_inicio')} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Local de trabalho" error={errors.local_trabalho?.message} {...register('local_trabalho')} />
            <Input label="Benefícios" error={errors.beneficios?.message} {...register('beneficios')} />
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="texto-carta" className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Texto da carta</label>
              {textoEditado && (
                <button type="button" onClick={() => setTextoEditado(false)} className="text-xs font-medium hover:underline" style={{ color: 'var(--color-brand)' }}>
                  Voltar ao modelo
                </button>
              )}
            </div>
            <textarea
              id="texto-carta"
              rows={12}
              maxLength={10000}
              value={textoAtual}
              onChange={(e) => { setTextoEditado(true); setValue('conteudo', e.target.value) }}
              className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]"
              style={{ borderColor: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', backgroundColor: '#fff' }}
            />
            {errors.conteudo && <p className="text-xs" style={{ color: 'var(--color-error)' }}>{errors.conteudo.message}</p>}
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {textoEditado ? 'Texto editado: os campos acima não alteram mais a carta.' : `Vem do modelo em Configurações. O candidato tem ${config.carta_validade_dias} ${config.carta_validade_dias === 1 ? 'dia' : 'dias'} para responder.`}
            </p>
          </div>
          <div className="flex justify-end gap-2">
            {abrirForm && aguardando && <Button type="button" variant="secondary" size="sm" onClick={() => setAbrirForm(false)}>Cancelar</Button>}
            <Button type="submit" size="sm" loading={isSubmitting}>
              {emp.email ? `Enviar para ${emp.email}` : 'Enviar carta'}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
