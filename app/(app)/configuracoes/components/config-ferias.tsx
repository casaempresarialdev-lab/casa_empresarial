'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { somarDias } from '@/lib/escala/periodo'
import { fmt, type ConfigFerias } from '@/lib/ferias/regras'
import { toast } from '@/lib/toast'
import { configFeriasSchema, type ConfigFeriasInput } from '@/lib/validations/ferias'
import { salvarConfigFeriasAction } from '../actions-folha'

function Bloco({ titulo, descricao, explicacao, children }: { titulo: string; descricao: string; explicacao: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="app-card p-5 flex flex-col gap-4">
      <div>
        <h2 className="text-base font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>{titulo}</h2>
        <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{descricao}</p>
      </div>
      {children}
      <div className="text-sm rounded-lg px-3 py-2.5 flex flex-col gap-1.5 leading-relaxed" style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-text-secondary)' }}>{explicacao}</div>
    </section>
  )
}

function Marcar({ titulo, descricao, ...props }: { titulo: string; descricao: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex items-start gap-2.5 text-sm cursor-pointer" style={{ color: 'var(--color-text-secondary)' }}>
      <input type="checkbox" className="mt-0.5 w-4 h-4 shrink-0" style={{ accentColor: 'var(--color-brand)' }} {...props} />
      <span>
        <span className="font-medium">{titulo}</span>
        <span className="block text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{descricao}</span>
      </span>
    </label>
  )
}

// Regras de férias que cabem à empresa. As da CLT (30 dias, prazos, partes) são fixas.
export function ConfigFeriasForm({ companyId, inicial }: { companyId: string; inicial: ConfigFerias }) {
  const router = useRouter()
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<ConfigFeriasInput>({
    resolver: zodResolver(configFeriasSchema),
    defaultValues: inicial,
  })
  const v = watch()
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
  const antecedencia = Number.isInteger(v.ferias_antecedencia_dias) && v.ferias_antecedencia_dias >= 0 ? v.ferias_antecedencia_dias : null

  async function salvar(d: ConfigFeriasInput) {
    const r = await toast.promise(salvarConfigFeriasAction(companyId, d), { loading: 'Salvando…', success: 'Configurações de férias salvas.', error: 'Não foi possível salvar.' })
    if (!('error' in r)) router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(salvar, () => toast.error('Confira os campos destacados.'))} noValidate className="flex flex-col gap-4">
      <Bloco
        titulo="Pedidos do colaborador"
        descricao="Se cada pessoa pode pedir as próprias férias em Minhas férias, e com quanta antecedência."
        explicacao={v.ferias_solicitacao_ativa ? (
          <>
            <p>O colaborador vê seus períodos aquisitivos e saldo e pede as férias. O pedido fica <strong>aguardando aprovação</strong> em Pessoas → Férias.</p>
            {antecedencia !== null && <p>{antecedencia === 0 ? 'Sem antecedência mínima: dá para pedir férias que começam a partir de amanhã.' : <>Quem pedir hoje pode marcar férias a partir de <strong>{fmt(somarDias(hoje, antecedencia))}</strong>. A CLT pede que o aviso seja dado com 30 dias de antecedência.</>}</p>}
          </>
        ) : (
          <p>O colaborador <strong>só consulta</strong> seus períodos e férias. Quem programa é a área de Pessoas.</p>
        )}
      >
        <Marcar titulo="O colaborador pode pedir as próprias férias" descricao="Desligado, Minhas férias fica só para consulta." {...register('ferias_solicitacao_ativa')} />
        {v.ferias_solicitacao_ativa && (
          <div className="sm:max-w-xs">
            <Input label="Antecedência mínima (dias)" type="number" min={0} max={120} error={errors.ferias_antecedencia_dias?.message} {...register('ferias_antecedencia_dias', { valueAsNumber: true })} />
          </div>
        )}
      </Bloco>

      <Bloco
        titulo="Divisão e venda de dias"
        descricao="O que a empresa aceita além das férias corridas."
        explicacao={
          <>
            <p>{v.ferias_permite_fracionar
              ? <>Os 30 dias podem ser divididos em <strong>até 3 partes</strong>: uma de pelo menos 14 dias e as outras de pelo menos 5 (art. 134 da CLT). Exemplo: 14 + 10 + 6.</>
              : <>As férias são tiradas <strong>de uma vez</strong>: os 30 dias juntos, ou 20 se a pessoa vender 10.</>}</p>
            <p>{v.ferias_permite_abono
              ? <>A pessoa pode <strong>vender até 10 dias</strong> por período (abono pecuniário). Eles são pagos com 1/3 a mais e sem INSS, IRRF ou FGTS.</>
              : <>A venda de dias <strong>não aparece</strong> nos pedidos nem na programação.</>}</p>
          </>
        }
      >
        <Marcar titulo="Permitir dividir as férias" descricao="Em até 3 partes, como prevê a CLT." {...register('ferias_permite_fracionar')} />
        <Marcar titulo="Permitir vender dias de férias" descricao="Abono pecuniário de até 10 dias por período." {...register('ferias_permite_abono')} />
      </Bloco>

      <div className="flex justify-end">
        <Button type="submit" loading={isSubmitting}>Salvar</Button>
      </div>
    </form>
  )
}
