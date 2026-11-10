'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getViewerContext } from '@/lib/auth/viewer'
import { semAcesso } from '@/lib/auth/acesso'
import { diaBancarioAte, vencimentosFolha } from '@/lib/folha/config'
import { notificarFuncionario } from '@/lib/notificacoes'
import { getFeriadosEmpresa } from '../escala-de-trabalho/queries'
import { getConfigFolha } from './queries'
import { montarDecimo } from './queries-decimo'
import { getRecibos } from './recibos'

// 13º salário: fechar congela a parcela e lança no fluxo de caixa; reabrir desfaz, se nada foi pago

const c = (v: number) => Math.round(v * 100) / 100

async function autorizado(companyId: string, ano: number, parcela: number) {
  const negado = await semAcesso('pessoas.folha-de-pagamento', companyId)
  if (negado) return negado
  const viewer = await getViewerContext(companyId)
  if (viewer?.isColaborador) return { error: 'Sem permissão para esta ação.' }
  if (!Number.isInteger(ano) || ano < 2000 || ano > 2100 || (parcela !== 1 && parcela !== 2)) return { error: 'Parcela inválida.' }
  return null
}

function revalidar() {
  revalidatePath('/pessoas/folha-de-pagamento')
  revalidatePath('/meu-holerite')
  revalidatePath('/financeiro/fluxo-de-caixa')
  revalidatePath('/financeiro/fluxo-de-caixa/pagamentos')
}

export async function fecharDecimoAction(companyId: string, ano: number, parcela: 1 | 2) {
  const negado = await autorizado(companyId, ano, parcela)
  if (negado) return negado

  const decimo = await montarDecimo(companyId, ano, parcela)
  if (decimo.fechada) return { error: 'Esta parcela já está fechada.' }
  if (!decimo.linhas.length) return { error: 'Ninguém tem 13º a receber nesta parcela.' }

  const admin = createAdminClient()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: perfil } = user ? await admin.from('profiles').select('name').eq('id', user.id).maybeSingle() : { data: null }
  const autor = (perfil?.name as string | undefined) ?? 'Usuário'
  const tipo = parcela === 1 ? 'decimo_1' : 'decimo_2'

  const { data: gravados, error } = await admin
    .from('payroll_receipts')
    .insert(decimo.linhas.map((l) => ({
      company_id: companyId, employee_id: l.employee.id, tipo, referencia: String(ano),
      pagamento_em: decimo.pagamentoEm, liquido: l.recibo.liquido, dados: l.recibo, fechado_por_nome: autor,
    })))
    .select('id, employee_id')
  if (error || !gravados) {
    return { error: error && ['42P01', 'PGRST205'].includes(error.code) ? 'Execute a migration 20261110000102 para fechar o 13º.' : error?.message ?? 'Não foi possível fechar.' }
  }

  const [config, feriados] = await Promise.all([getConfigFolha(companyId), getFeriadosEmpresa(companyId)])
  const idDe = new Map(gravados.map((g) => [g.employee_id as string, g.id as string]))
  const rotulo = `13º ${parcela}ª parcela`
  const comum = { company_id: companyId, tipo: 'pagamento', status: 'pendente', recorrente: false, data_competencia: `${decimo.pagamentoEm.slice(0, 7)}-01` }
  const soma = (campo: 'fgts' | 'inss' | 'irrf') => c(decimo.linhas.reduce((t, l) => t + l.recibo.resumo[campo], 0))

  const contas = decimo.linhas
    .filter((l) => l.recibo.liquido > 0)
    .map((l) => ({ ...comum, descricao: `${rotulo} — ${l.employee.nome} — ${ano}`, valor: l.recibo.liquido, data_vencimento: decimo.pagamentoEm, detalhes: `payroll_receipt:${idDe.get(l.employee.id)}:decimo` }))
  // FGTS e IRRF vencem com as guias do mês seguinte ao pagamento; o INSS do 13º vence em 20/12
  const guias = vencimentosFolha(decimo.pagamentoEm.slice(0, 7), config, feriados).guias
  const ref = `payroll_decimo:${ano}:${parcela}`
  if (soma('fgts') > 0) contas.push({ ...comum, descricao: `FGTS do ${rotulo} — ${ano}`, valor: soma('fgts'), data_vencimento: guias, detalhes: `${ref}:fgts` })
  if (soma('inss') > 0) contas.push({ ...comum, descricao: `INSS do 13º — ${ano}`, valor: soma('inss'), data_vencimento: diaBancarioAte(`${ano}-12-20`, feriados), detalhes: `${ref}:inss` })
  if (soma('irrf') > 0) contas.push({ ...comum, descricao: `IRRF do 13º — ${ano}`, valor: soma('irrf'), data_vencimento: guias, detalhes: `${ref}:irrf` })

  if (contas.length) {
    const { error: erroContas } = await admin.from('transactions').insert(contas)
    if (erroContas) {
      await admin.from('payroll_receipts').delete().in('id', gravados.map((g) => g.id))
      return { error: erroContas.message }
    }
  }

  // O holerite do 13º aparece em Meu holerite, quando a empresa disponibiliza
  if (config.holerite_ativo && config.holerite_fonte === 'sistema') {
    await Promise.all(decimo.linhas.map((l) => notificarFuncionario(admin, {
      companyId, employeeId: l.employee.id, autorId: user?.id, tipo: 'folha',
      titulo: `${parcela}ª parcela do 13º disponível`, mensagem: `O recibo da ${parcela}ª parcela do 13º de ${ano} já está em Meu holerite.`, link: '/meu-holerite',
    })))
  }

  revalidar()
  return { success: true as const }
}

export async function reabrirDecimoAction(companyId: string, ano: number, parcela: 1 | 2) {
  const negado = await autorizado(companyId, ano, parcela)
  if (negado) return negado

  const admin = createAdminClient()
  const recibos = await getRecibos(admin, companyId, { tipo: parcela === 1 ? 'decimo_1' : 'decimo_2', referencia: String(ano) })
  if (!recibos.length) return { error: 'Esta parcela não está fechada.' }
  if (parcela === 1 && (await getRecibos(admin, companyId, { tipo: 'decimo_2', referencia: String(ano) })).length) {
    return { error: 'Reabra a 2ª parcela antes: ela desconta o valor da 1ª.' }
  }

  const filtro = [...recibos.map((r) => `detalhes.like.payroll_receipt:${r.id}:*`), `detalhes.like.payroll_decimo:${ano}:${parcela}:*`].join(',')
  const { data: contas, error } = await admin.from('transactions').select('id, status').eq('company_id', companyId).or(filtro)
  if (error) return { error: error.message }
  if (contas?.some((c) => c.status !== 'pendente')) return { error: 'Há pagamentos desta parcela já baixados no fluxo de caixa. Estorne-os antes de reabrir.' }
  if (contas?.length) {
    const { error: erroContas } = await admin.from('transactions').delete().in('id', contas.map((c) => c.id))
    if (erroContas) return { error: erroContas.message }
  }
  const { error: erroRecibos } = await admin.from('payroll_receipts').delete().in('id', recibos.map((r) => r.id))
  if (erroRecibos) return { error: erroRecibos.message }

  revalidar()
  return { success: true as const }
}
