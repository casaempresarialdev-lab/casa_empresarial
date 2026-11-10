'use client'

import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { periodoDoMes, somarDias } from '@/lib/escala/periodo'
import { diasDsr, fmtDataBr, periodoApuracao, vencimentosFolha, type ConfigFolha } from '@/lib/folha/config'
import Link from 'next/link'
import { toast } from '@/lib/toast'
import { configFolhaSchema, type ConfigFolhaInput } from '@/lib/validations/folha'
import { salvarConfigFolhaAction } from '../actions-folha'

const numeroOuNulo = (v: unknown) => (v === '' || v === null || v === undefined ? null : Number(v))

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const nomeMes = (mesAno: string) => MESES[Number(mesAno.slice(5, 7)) - 1]
const dm = (iso: string) => `${iso.slice(8)}/${iso.slice(5, 7)}`
const moeda = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const diaValido = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 28
const numeroValido = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0

// Mês seguinte a uma competência
const seguinte = (mesAno: string) => periodoDoMes(`${mesAno}-01`).proximo.slice(0, 7)

/** Explica, com datas e valores reais, o efeito do que está preenchido */
function Explicacao({ children, alerta }: { children: React.ReactNode; alerta?: React.ReactNode }) {
  return (
    <div className="text-sm rounded-lg px-3 py-2.5 flex flex-col gap-1.5 leading-relaxed" style={{ backgroundColor: 'var(--color-brand-light)', color: 'var(--color-text-secondary)' }}>
      <div className="flex flex-col gap-1.5">{children}</div>
      {alerta && <p className="font-semibold" style={{ color: '#B45309' }}>{alerta}</p>}
    </div>
  )
}

function Bloco({ titulo, descricao, explicacao, children }: { titulo: string; descricao: string; explicacao: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="app-card p-5 flex flex-col gap-4">
      <div>
        <h2 className="text-base font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>{titulo}</h2>
        <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{descricao}</p>
      </div>
      {children}
      {explicacao}
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

// Regras da folha da empresa: período, datas, adiantamento, horas extras, DSR, adicionais e holerite
export function ConfigFolhaForm({ companyId, inicial, adicionais }: { companyId: string; inicial: ConfigFolha; adicionais: { cargos: number; excecoes: number } }) {
  const router = useRouter()
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<ConfigFolhaInput>({
    resolver: zodResolver(configFolhaSchema),
    defaultValues: {
      ...inicial,
      noturno_percentual: Number(inicial.noturno_percentual),
      salario_minimo: Number(inicial.salario_minimo),
      modo_periodo: inicial.dia_corte ? 'corte' : 'mes',
      holerite_modo: !inicial.holerite_ativo ? 'nao' : inicial.holerite_fonte,
    },
  })

  const v = watch()
  const mesAtual = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date()).slice(0, 7)
  const corte = v.modo_periodo === 'corte' && diaValido(v.dia_corte) ? v.dia_corte : null
  const periodo = periodoApuracao(mesAtual, { dia_corte: corte })
  const mesSeguinte = seguinte(mesAtual)
  const mes = nomeMes(mesAtual)
  const proximoMes = nomeMes(mesSeguinte)

  const datasOk = diaValido(v.pagamento_dia) && diaValido(v.guias_dia) && (v.beneficios_dia === null || diaValido(v.beneficios_dia))
  const venc = datasOk ? vencimentosFolha(mesAtual, { ...inicial, ...v, dia_corte: corte }, []) : null
  const limiteClt = vencimentosFolha(mesAtual, { ...inicial, pagamento_tipo: 'dia_util', pagamento_dia: 5 }, []).salario
  const guiasAntecipadas = venc && diaValido(v.guias_dia) && Number(venc.guias.slice(8)) !== v.guias_dia

  const tolerancia = numeroValido(v.tolerancia_minutos) ? v.tolerancia_minutos : null
  const adiantamentoOk = diaValido(v.adiantamento_dia) && numeroValido(v.adiantamento_percentual)
  const heOk = numeroValido(v.he_percentual) && numeroValido(v.he_feriado_percentual) && numeroValido(v.he_domingo_percentual)
  const hora = (pct: number) => moeda(10 * (1 + pct / 100))

  // Exemplo do DSR com o mês atual (feriados nacionais; os da empresa entram na folha)
  const exDsr = diasDsr(periodoDoMes(`${mesAtual}-01`).inicio, periodoDoMes(`${mesAtual}-01`).fim, [])
  const exHe = 300
  const noturnoOk = numeroValido(v.noturno_percentual) && /^\d{2}:\d{2}$/.test(v.noturno_inicio ?? '') && /^\d{2}:\d{2}$/.test(v.noturno_fim ?? '')
  const minimoOk = numeroValido(v.salario_minimo) && v.salario_minimo > 0

  async function salvar(d: ConfigFolhaInput) {
    const r = await toast.promise(salvarConfigFolhaAction(companyId, d), {
      loading: 'Salvando…',
      success: 'Configurações da folha salvas.',
      error: 'Não foi possível salvar.',
    })
    if (!('error' in r)) router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(salvar, () => toast.error('Confira os campos destacados.'))} noValidate className="flex flex-col gap-4">
      <Bloco
        titulo="Período de apuração"
        descricao="Quais dias de ponto entram em cada competência. O salário é sempre do mês inteiro."
        explicacao={
          <Explicacao alerta={v.modo_periodo === 'corte' && !corte ? 'Informe um dia de corte de 1 a 28.' : undefined}>
            {corte ? (
              <p>Na folha de <strong>{mes}</strong>, entram as faltas, os atrasos e as horas extras de <strong>{dm(periodo.inicio)}</strong> a <strong>{dm(periodo.fim)}</strong>. O que acontecer a partir de <strong>{dm(somarDias(periodo.fim, 1))}</strong> vai para a folha de {proximoMes}.</p>
            ) : (
              <p>Na folha de <strong>{mes}</strong>, entram as faltas, os atrasos e as horas extras de <strong>{dm(periodo.inicio)}</strong> a <strong>{dm(periodo.fim)}</strong>, o mês inteiro.</p>
            )}
            {tolerancia !== null && (
              <p>{tolerancia === 0
                ? 'Sem tolerância: qualquer diferença de minutos no dia já conta como atraso ou hora extra.'
                : <>Diferenças de até <strong>{tolerancia} {tolerancia === 1 ? 'minuto' : 'minutos'}</strong> no dia são ignoradas. Passou disso, conta a diferença inteira.</>}</p>
            )}
          </Explicacao>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Select label="Apuração" options={[{ value: 'mes', label: 'Mês cheio' }, { value: 'corte', label: 'Dia de corte' }]} {...register('modo_periodo')} />
          {v.modo_periodo === 'corte' && (
            <Input label="Dia de corte" type="number" min={1} max={28} error={errors.dia_corte?.message} {...register('dia_corte', { setValueAs: numeroOuNulo })} />
          )}
          <Input label="Tolerância diária (minutos)" type="number" min={0} max={60} error={errors.tolerancia_minutos?.message} hint="A CLT prevê até 10 minutos por dia." {...register('tolerancia_minutos', { valueAsNumber: true })} />
        </div>
      </Bloco>

      <Bloco
        titulo="Datas de pagamento"
        descricao="Ao fechar a folha, cada lançamento entra no fluxo de caixa com o seu vencimento."
        explicacao={
          <Explicacao alerta={venc && venc.salario > limiteClt ? `Esta data passa do limite da CLT, que seria ${fmtDataBr(limiteClt)}.` : !venc ? 'Preencha os dias com valores de 1 a 28.' : undefined}>
            {venc && (
              <>
                <p>
                  A folha de <strong>{mes}</strong> paga os salários em <strong>{fmtDataBr(venc.salario)}</strong>
                  {v.pagamento_tipo === 'dia_util' ? <>, o {v.pagamento_dia}º dia útil de {proximoMes} (sábado conta; domingo e feriado, não).</> : <>, dia {v.pagamento_dia} de {proximoMes}.</>}
                </p>
                <p>FGTS, INSS e IRRF vencem em <strong>{fmtDataBr(venc.guias)}</strong>{guiasAntecipadas ? <>, antecipados porque o dia {v.guias_dia} não é dia útil.</> : '.'}</p>
                <p>{v.beneficios_dia ? <>Os benefícios vencem em <strong>{fmtDataBr(venc.beneficios)}</strong>.</> : <>Os benefícios vencem junto com o salário.</>}</p>
              </>
            )}
          </Explicacao>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Select label="Salário" options={[{ value: 'dia_util', label: 'Dia útil do mês seguinte' }, { value: 'dia_fixo', label: 'Dia fixo do mês seguinte' }]} {...register('pagamento_tipo')} />
          <Input label={v.pagamento_tipo === 'dia_util' ? 'Qual dia útil' : 'Dia do mês'} type="number" min={1} max={28} error={errors.pagamento_dia?.message} hint={v.pagamento_tipo === 'dia_util' ? 'O limite da CLT é o 5º dia útil.' : undefined} {...register('pagamento_dia', { valueAsNumber: true })} />
          <Input label="Guias (FGTS, INSS, IRRF)" type="number" min={1} max={28} error={errors.guias_dia?.message} hint="Antecipa se não for dia útil." {...register('guias_dia', { valueAsNumber: true })} />
          <Input label="Benefícios" type="number" min={1} max={28} error={errors.beneficios_dia?.message} hint="Em branco, vence com o salário." {...register('beneficios_dia', { setValueAs: numeroOuNulo })} />
        </div>
      </Bloco>

      <Bloco
        titulo="Adiantamento"
        descricao="Valor pago durante o mês e descontado automaticamente no fechamento."
        explicacao={
          <Explicacao alerta={v.adiantamento_ativo && !adiantamentoOk ? 'Informe o dia (1 a 28) e o percentual.' : undefined}>
            {!v.adiantamento_ativo ? (
              <p>Sem adiantamento: cada pessoa recebe o salário inteiro na data do pagamento.</p>
            ) : adiantamentoOk ? (
              <p>Todo dia <strong>{v.adiantamento_dia}</strong>, cada pessoa recebe <strong>{v.adiantamento_percentual}%</strong> do salário. Quem ganha R$ 3.000,00 recebe <strong>{moeda(3000 * v.adiantamento_percentual / 100)}</strong> no dia {v.adiantamento_dia}, e esse valor sai do líquido no fechamento.</p>
            ) : null}
          </Explicacao>
        }
      >
        <Marcar titulo="A empresa paga adiantamento" descricao="Vale para CLT e menor aprendiz, e pode ser editado por pessoa na conferência." {...register('adiantamento_ativo')} />
        {v.adiantamento_ativo && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:max-w-md">
            <Input label="Dia do pagamento" type="number" min={1} max={28} error={errors.adiantamento_dia?.message} {...register('adiantamento_dia', { valueAsNumber: true })} />
            <Input label="Percentual do salário" type="number" min={0} max={100} step="0.01" error={errors.adiantamento_percentual?.message} {...register('adiantamento_percentual', { valueAsNumber: true })} />
          </div>
        )}
      </Bloco>

      <Bloco
        titulo="Horas extras"
        descricao="Adicional sobre o valor da hora. Confira se a convenção coletiva define outros percentuais."
        explicacao={
          <Explicacao alerta={!heOk ? 'Preencha os três percentuais.' : numeroValido(v.he_percentual) && v.he_percentual < 50 ? 'A Constituição exige adicional de pelo menos 50%.' : undefined}>
            {heOk && <p>Para quem ganha R$ 10,00 por hora, cada hora extra vale <strong>{hora(v.he_percentual)}</strong> em dia normal, <strong>{hora(v.he_feriado_percentual)}</strong> em feriado e <strong>{hora(v.he_domingo_percentual)}</strong> em domingo de folga.</p>}
          </Explicacao>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input label="Dias normais (%)" type="number" min={0} max={200} step="0.01" error={errors.he_percentual?.message} {...register('he_percentual', { valueAsNumber: true })} />
          <Input label="Feriados (%)" type="number" min={0} max={200} step="0.01" error={errors.he_feriado_percentual?.message} {...register('he_feriado_percentual', { valueAsNumber: true })} />
          <Input label="Domingos de folga (%)" type="number" min={0} max={200} step="0.01" error={errors.he_domingo_percentual?.message} {...register('he_domingo_percentual', { valueAsNumber: true })} />
        </div>
      </Bloco>

      <Bloco
        titulo="DSR (descanso semanal remunerado)"
        descricao="Reflexo das horas extras no descanso e perda do descanso na semana com falta sem justificativa."
        explicacao={
          <Explicacao>
            {v.dsr_reflexo_ativo ? (
              <p>Em {mes}, com <strong>{exDsr.diasUteis} dias úteis</strong> e <strong>{exDsr.descansos} domingos e feriados</strong>, quem fizer {moeda(exHe)} de horas extras e adicional noturno recebe mais <strong>{moeda((exHe / exDsr.diasUteis) * exDsr.descansos)}</strong> de DSR. Os feriados nacionais e os da empresa contam como descanso.</p>
            ) : (
              <p>Sem reflexo: as horas extras e o adicional noturno não somam no descanso. A Súmula 172 do TST garante esse reflexo para quem faz horas extras com frequência.</p>
            )}
            <p>{v.dsr_desconta_falta
              ? <>Na semana com falta sem justificativa, a pessoa perde também o descanso: quem ganha R$ 3.000,00 e falta um dia perde <strong>{moeda(100)}</strong> da falta e mais <strong>{moeda(100)}</strong> do DSR (Lei 605/49). Atestados abonados não descontam.</>
              : 'A falta desconta só o próprio dia, sem a perda do descanso da semana.'}</p>
          </Explicacao>
        }
      >
        <Marcar titulo="Somar o DSR sobre horas extras e adicional noturno" descricao="Calculado sobre os dias úteis e os domingos e feriados do período de apuração." {...register('dsr_reflexo_ativo')} />
        <Marcar titulo="Descontar o DSR na semana com falta sem justificativa" descricao="Um dia de descanso por semana com falta. Pode ser editado por pessoa na conferência." {...register('dsr_desconta_falta')} />
      </Bloco>

      <Bloco
        titulo="Adicional noturno"
        descricao="Calculado pelos registros de ponto que caem no horário noturno."
        explicacao={
          <Explicacao alerta={v.noturno_ativo && noturnoOk && v.noturno_percentual < 20 ? 'A CLT (art. 73) exige adicional de pelo menos 20% para o trabalho urbano.' : v.noturno_ativo && !noturnoOk ? 'Preencha o horário e o percentual.' : undefined}>
            {!v.noturno_ativo ? (
              <p>Sem adicional noturno: o trabalho à noite conta como horas comuns.</p>
            ) : noturnoOk ? (
              <>
                <p>Entre <strong>{v.noturno_inicio}</strong> e <strong>{v.noturno_fim}</strong>, cada hora vale <strong>{v.noturno_percentual}%</strong> a mais. Para quem ganha R$ 10,00 por hora, são <strong>{moeda(10 * v.noturno_percentual / 100)}</strong> de adicional por hora noturna.</p>
                <p>{v.noturno_hora_reduzida
                  ? <>Com a hora reduzida, cada 52min30s de relógio vale uma hora: das 22h às 5h, 7 horas de relógio são pagas como <strong>8 horas</strong>.</>
                  : 'Sem a hora reduzida: conta o tempo de relógio.'}</p>
              </>
            ) : null}
          </Explicacao>
        }
      >
        <Marcar titulo="A empresa paga adicional noturno" descricao="Vale para quem registra ponto; para os demais, informe na conferência." {...register('noturno_ativo')} />
        {v.noturno_ativo && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input label="Começa às" type="time" error={errors.noturno_inicio?.message} {...register('noturno_inicio')} />
              <Input label="Termina às" type="time" error={errors.noturno_fim?.message} {...register('noturno_fim')} />
              <Input label="Adicional (%)" type="number" min={0} max={200} step="0.01" error={errors.noturno_percentual?.message} {...register('noturno_percentual', { valueAsNumber: true })} />
            </div>
            <Marcar titulo="Hora noturna reduzida (52min30s)" descricao="Regra da CLT para o trabalho urbano. Desmarque se a convenção coletiva prevê outra forma." {...register('noturno_hora_reduzida')} />
          </>
        )}
      </Bloco>

      <Bloco
        titulo="Insalubridade e periculosidade"
        descricao="Aqui ficam as regras de cálculo. Quem recebe o adicional é definido no cargo e, nas exceções, na ficha da pessoa."
        explicacao={
          <Explicacao alerta={!minimoOk ? 'Informe o salário mínimo.' : undefined}>
            {minimoOk && (
              <p>{v.insalubridade_base === 'salario_minimo'
                ? <>A insalubridade é calculada sobre o salário mínimo de <strong>{moeda(v.salario_minimo)}</strong>: <strong>{moeda(v.salario_minimo * 0.1)}</strong> no grau mínimo, <strong>{moeda(v.salario_minimo * 0.2)}</strong> no médio e <strong>{moeda(v.salario_minimo * 0.4)}</strong> no máximo.</>
                : <>A insalubridade é calculada sobre o salário de cada pessoa: quem ganha R$ 3.000,00 recebe <strong>{moeda(300)}</strong> no grau mínimo, <strong>{moeda(600)}</strong> no médio e <strong>{moeda(1200)}</strong> no máximo.</>}</p>
            )}
            <p>A periculosidade é de 30% sobre o salário. A CLT não deixa receber os dois: se a pessoa tiver direito aos dois, vale o maior. Os adicionais entram na base das horas extras, das férias e do 13º.</p>
          </Explicacao>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:max-w-xl">
          <Select label="Base da insalubridade" options={[{ value: 'salario_minimo', label: 'Salário mínimo' }, { value: 'salario_base', label: 'Salário da pessoa (convenção)' }]} {...register('insalubridade_base')} />
          <Input label="Salário mínimo" type="number" min={1} step="0.01" error={errors.salario_minimo?.message} {...register('salario_minimo', { valueAsNumber: true })} />
        </div>
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {adicionais.cargos || adicionais.excecoes
            ? [adicionais.cargos && `${adicionais.cargos} ${adicionais.cargos === 1 ? 'cargo' : 'cargos'} com adicional`, adicionais.excecoes && `${adicionais.excecoes} ${adicionais.excecoes === 1 ? 'pessoa' : 'pessoas'} com exceção na ficha`].filter(Boolean).join(' · ')
            : 'Nenhum cargo com adicional ainda.'}
          {' · '}
          <Link href="/empresa?aba=estrutura" className="font-semibold hover:underline" style={{ color: 'var(--color-brand)' }}>Definir na Estrutura</Link>
        </p>
      </Bloco>

      <Bloco
        titulo="Fechamento e holerite"
        descricao="Quem responde pelos números e o que o colaborador consegue ver."
        explicacao={
          <Explicacao>
            <p>{v.responsavel_calculo === 'contabilidade'
              ? 'A folha e o holerite saem como demonstrativo, com o aviso de que os valores oficiais são os conferidos pela contabilidade.'
              : 'A folha e o holerite saem como o cálculo oficial da empresa, sem aviso de conferência externa.'}</p>
            <p>{v.holerite_modo === 'sistema'
              ? <>Depois de fechar a folha, cada colaborador baixa o <strong>próprio holerite</strong> em Meu holerite, junto com os recibos de férias e do 13º. Reabrir a folha tira o holerite daquele mês do ar.</>
              : v.holerite_modo === 'arquivo'
                ? <>Na Folha de Pagamento, quem tem acesso <strong>envia o PDF</strong> que a contabilidade fechou, por pessoa. O colaborador é avisado e abre o arquivo em Meu holerite; os holerites do sistema não aparecem para ele.</>
                : <>O colaborador <strong>não vê</strong> os valores da folha. Quem tem acesso à Folha de Pagamento continua baixando os holerites por lá.</>}</p>
          </Explicacao>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:max-w-xl">
          <Select
            label="Quem calcula oficialmente"
            options={[{ value: 'contabilidade', label: 'A contabilidade confere os valores' }, { value: 'sistema', label: 'O cálculo do sistema é o oficial' }]}
            {...register('responsavel_calculo')}
          />
          <Select
            label="Holerite do colaborador"
            options={[
              { value: 'nao', label: 'Não disponibilizar' },
              { value: 'sistema', label: 'Gerado pelo sistema' },
              { value: 'arquivo', label: 'PDF enviado da contabilidade' },
            ]}
            {...register('holerite_modo')}
          />
        </div>
      </Bloco>

      <div className="flex justify-end">
        <Button type="submit" loading={isSubmitting}>Salvar</Button>
      </div>
    </form>
  )
}
