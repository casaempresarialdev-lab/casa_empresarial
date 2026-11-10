'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { semAcesso } from '@/lib/auth/acesso'
import { getViewerContext } from '@/lib/auth/viewer'
import { notificarFuncionario } from '@/lib/notificacoes'
import { ROTULO_TIPO_SS, TIPOS_SS, type TipoSS } from '@/lib/seguranca'

// Segurança e saúde: quem tem acesso registra; cada pessoa do registro é avisada e vê em "Minha saúde e segurança"

type Admin = ReturnType<typeof createAdminClient>

async function autor(companyId: string) {
  const negado = await semAcesso('pessoas.seguranca-saude', companyId)
  if (negado) return negado
  const viewer = await getViewerContext(companyId)
  if (viewer?.isColaborador) return { error: 'Sem permissão para esta ação.' }
  const { data: { user } } = await (await createClient()).auth.getUser()
  if (!user) return { error: 'Não autenticado' }
  return { id: user.id }
}

function campos(formData: FormData) {
  const tipo = String(formData.get('tipo') ?? '') as TipoSS
  const titulo = String(formData.get('titulo') ?? '').trim()
  if (!TIPOS_SS.includes(tipo)) return { error: 'Escolha o tipo.' }
  if (!titulo) return { error: 'Informe o título.' }
  const data = (formData.get('data') as string) || null
  const data_vencimento = (formData.get('data_vencimento') as string) || null
  if (data && data_vencimento && data_vencimento < data) return { error: 'O vencimento não pode ser antes da data.' }
  return {
    tipo, titulo: titulo.slice(0, 200), data, data_vencimento,
    resultado: tipo === 'aso' ? (formData.get('resultado') as string) || null : null,
    observacao: ((formData.get('observacao') as string) || '').trim().slice(0, 1000) || null,
  }
}

const fmt = (d: string) => d.split('-').reverse().join('/')

/** Aviso no sistema para a pessoa do registro */
async function avisar(admin: Admin, companyId: string, employeeIds: string[], autorId: string, c: { tipo: TipoSS; titulo: string; data_vencimento: string | null }, novo: boolean) {
  const vence = c.data_vencimento ? ` Vence em ${fmt(c.data_vencimento)}.` : ''
  await Promise.all(employeeIds.map((employeeId) => notificarFuncionario(admin, {
    companyId, employeeId, autorId, tipo: 'saude',
    titulo: novo ? `${ROTULO_TIPO_SS[c.tipo]} registrado` : `${ROTULO_TIPO_SS[c.tipo]} atualizado`,
    mensagem: `${c.titulo}.${vence}`,
    link: '/minha-saude',
  })))
}

function revalidar() {
  revalidatePath('/pessoas/seguranca-saude')
  revalidatePath('/pessoas')
  revalidatePath('/minha-saude')
}

/** Um registro por pessoa escolhida; sem ninguém, é um registro da empresa */
export async function createHealthSafetyAction(companyId: string, formData: FormData) {
  const quem = await autor(companyId)
  if ('error' in quem) return quem
  const c = campos(formData)
  if ('error' in c) return c

  let ids: string[] = []
  try { ids = JSON.parse(String(formData.get('employee_ids') ?? '[]')) } catch { return { error: 'Escolha para quem é o registro.' } }
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) return { error: 'Escolha para quem é o registro.' }
  ids = [...new Set(ids)]

  const admin = createAdminClient()
  if (ids.length) {
    const { data: validos } = await admin.from('employees').select('id').eq('company_id', companyId).in('id', ids)
    if ((validos ?? []).length !== ids.length) return { error: 'Algum funcionário escolhido não foi encontrado.' }
  }

  const linhas = (ids.length ? ids : [null]).map((employee_id) => ({ company_id: companyId, employee_id, ...c }))
  const { error } = await admin.from('health_safety_records').insert(linhas)
  if (error) return { error: error.message }

  await avisar(admin, companyId, ids, quem.id, c, true)
  revalidar()
  return { success: true as const, total: linhas.length }
}

export async function updateHealthSafetyAction(recordId: string, formData: FormData) {
  const admin = createAdminClient()
  const { data: atual } = await admin.from('health_safety_records').select('company_id').eq('id', recordId).maybeSingle()
  if (!atual) return { error: 'Registro não encontrado.' }
  const quem = await autor(atual.company_id as string)
  if ('error' in quem) return quem
  const c = campos(formData)
  if ('error' in c) return c

  const employeeId = (formData.get('employee_id') as string) || null
  if (employeeId) {
    const { data: f } = await admin.from('employees').select('id').eq('id', employeeId).eq('company_id', atual.company_id).maybeSingle()
    if (!f) return { error: 'Funcionário não encontrado.' }
  }

  const { error } = await admin.from('health_safety_records').update({ employee_id: employeeId, ...c }).eq('id', recordId).eq('company_id', atual.company_id)
  if (error) return { error: error.message }

  if (employeeId) await avisar(admin, atual.company_id as string, [employeeId], quem.id, c, false)
  revalidar()
  return { success: true as const }
}

export async function deleteHealthSafetyAction(recordId: string) {
  const admin = createAdminClient()
  const { data: atual } = await admin.from('health_safety_records').select('company_id').eq('id', recordId).maybeSingle()
  if (!atual) return { error: 'Registro não encontrado.' }
  const quem = await autor(atual.company_id as string)
  if ('error' in quem) return quem

  const { error } = await admin.from('health_safety_records').delete().eq('id', recordId).eq('company_id', atual.company_id)
  if (error) return { error: error.message }
  revalidar()
  return { success: true as const }
}
