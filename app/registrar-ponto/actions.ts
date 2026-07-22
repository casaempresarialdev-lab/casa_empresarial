'use server'

import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'

export type PontoSession = {
  employeeId: string
  companyId: string
  employeeName: string
  companyName: string
  companyCnpj: string
}

export type TipoBatida = 'entrada' | 'saida_almoco' | 'retorno_almoco' | 'saida'

// Valida CNPJ + PIN e cria cookie de sessão do colaborador
export async function validarPinAction(formData: FormData): Promise<
  { success: true; session: PontoSession } | { error: string }
> {
  const cnpjRaw = (formData.get('cnpj') as string ?? '').replace(/\D/g, '')
  const pin     = (formData.get('pin')  as string ?? '').trim()

  if (cnpjRaw.length !== 14) return { error: 'CNPJ inválido.' }
  if (!pin || pin.length < 4) return { error: 'PIN inválido.' }

  const admin = createAdminClient()

  const { data: company } = await admin
    .from('companies')
    .select('id, razao_social, nome_fantasia, cnpj')
    .eq('cnpj', cnpjRaw)
    .single()

  if (!company) return { error: 'Empresa não encontrada. Verifique o CNPJ.' }

  const { data: employee } = await admin
    .from('employees')
    .select('id, nome')
    .eq('company_id', company.id)
    .eq('pin', pin)
    .eq('pin_ativo', true)
    .single()

  if (!employee) return { error: 'PIN inválido ou acesso desativado.' }

  const session: PontoSession = {
    employeeId:   employee.id,
    companyId:    company.id,
    employeeName: employee.nome,
    companyName:  company.nome_fantasia ?? company.razao_social,
    companyCnpj:  cnpjRaw,
  }

  const cookieStore = await cookies()
  cookieStore.set('ponto_session', JSON.stringify(session), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/registrar-ponto',
    maxAge: 60 * 60 * 8,
  })

  return { success: true, session }
}

export async function sairPontoAction() {
  const cookieStore = await cookies()
  cookieStore.set('ponto_session', '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/registrar-ponto',
    maxAge: 0,
  })
}

export async function registrarPontoAction(
  employeeId: string,
  companyId: string,
  lat: number | null,
  lng: number | null,
  enderecoAprox: string | null,
  tipoBatida: TipoBatida,
): Promise<{ success: true; tipo: TipoBatida } | { error: string }> {
  const admin = createAdminClient()
  const agora = new Date()
  const hoje  = agora.toISOString().slice(0, 10)
  const ts    = agora.toISOString()

  const localizacao = lat && lng ? { lat, lng, endereco: enderecoAprox } : null

  // Busca o registro de hoje
  const { data: registro } = await admin
    .from('time_records')
    .select('id, entrada, saida_almoco, retorno_almoco, saida')
    .eq('company_id', companyId)
    .eq('employee_id', employeeId)
    .eq('data', hoje)
    .maybeSingle()

  if (tipoBatida === 'entrada') {
    if (registro?.entrada) return { error: 'Entrada já registrada hoje.' }
    const { error } = await admin.from('time_records').insert({
      company_id: companyId, employee_id: employeeId,
      data: hoje, entrada: ts, tipo: 'normal', localizacao,
    })
    if (error) return { error: error.message }
    return { success: true, tipo: 'entrada' }
  }

  if (!registro) return { error: 'Registre a entrada primeiro.' }

  if (tipoBatida === 'saida_almoco') {
    if (!registro.entrada)     return { error: 'Registre a entrada primeiro.' }
    if (registro.saida_almoco) return { error: 'Saída do almoço já registrada.' }
    const { error } = await admin.from('time_records')
      .update({ saida_almoco: ts, localizacao }).eq('id', registro.id)
    if (error) return { error: error.message }
    return { success: true, tipo: 'saida_almoco' }
  }

  if (tipoBatida === 'retorno_almoco') {
    if (!registro.saida_almoco)   return { error: 'Registre a saída do almoço primeiro.' }
    if (registro.retorno_almoco)  return { error: 'Retorno do almoço já registrado.' }
    const { error } = await admin.from('time_records')
      .update({ retorno_almoco: ts, localizacao }).eq('id', registro.id)
    if (error) return { error: error.message }
    return { success: true, tipo: 'retorno_almoco' }
  }

  if (tipoBatida === 'saida') {
    if (!registro.entrada) return { error: 'Registre a entrada primeiro.' }
    if (registro.saida)    return { error: 'Saída já registrada hoje.' }
    const { error } = await admin.from('time_records')
      .update({ saida: ts, localizacao }).eq('id', registro.id)
    if (error) return { error: error.message }
    return { success: true, tipo: 'saida' }
  }

  return { error: 'Ação inválida.' }
}
