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

// Valida CNPJ + PIN e cria cookie de sessão do colaborador
export async function validarPinAction(formData: FormData): Promise<
  { success: true; session: PontoSession } | { error: string }
> {
  const cnpjRaw = (formData.get('cnpj') as string ?? '').replace(/\D/g, '')
  const pin     = (formData.get('pin')  as string ?? '').trim()

  if (cnpjRaw.length !== 14) return { error: 'CNPJ inválido.' }
  if (!pin || pin.length < 4) return { error: 'PIN inválido.' }

  const admin = createAdminClient()

  // Busca empresa pelo CNPJ
  const { data: company } = await admin
    .from('companies')
    .select('id, razao_social, nome_fantasia, cnpj')
    .eq('cnpj', cnpjRaw)
    .single()

  if (!company) return { error: 'Empresa não encontrada. Verifique o CNPJ.' }

  // Busca funcionário pelo PIN dentro da empresa
  const { data: employee } = await admin
    .from('employees')
    .select('id, nome')
    .eq('company_id', company.id)
    .eq('pin', pin)
    .eq('pin_ativo', true)
    .single()

  if (!employee) return { error: 'PIN inválido ou acesso desativado.' }

  const session: PontoSession = {
    employeeId:  employee.id,
    companyId:   company.id,
    employeeName: employee.nome,
    companyName: company.nome_fantasia ?? company.razao_social,
    companyCnpj: cnpjRaw,
  }

  const cookieStore = await cookies()
  cookieStore.set('ponto_session', JSON.stringify(session), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/registrar-ponto',
    maxAge: 60 * 60 * 8, // 8 horas
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
): Promise<{ success: true; tipo: 'entrada' | 'saida' } | { error: string }> {
  const admin = createAdminClient()
  const agora = new Date()
  const hoje  = agora.toISOString().slice(0, 10)
  const ts    = agora.toISOString()

  const localizacao = lat && lng
    ? { lat, lng, endereco: enderecoAprox }
    : null

  // Verifica se já tem um registro de hoje com entrada sem saída
  const { data: aberto } = await admin
    .from('time_records')
    .select('id, entrada')
    .eq('company_id', companyId)
    .eq('employee_id', employeeId)
    .eq('data', hoje)
    .is('saida', null)
    .not('entrada', 'is', null)
    .single()

  if (aberto) {
    // Registra saída
    const { error } = await admin
      .from('time_records')
      .update({ saida: ts, localizacao })
      .eq('id', aberto.id)

    if (error) return { error: error.message }
    return { success: true, tipo: 'saida' }
  }

  // Registra entrada
  const { error } = await admin
    .from('time_records')
    .insert({
      company_id:  companyId,
      employee_id: employeeId,
      data:        hoje,
      entrada:     ts,
      tipo:        'normal',
      localizacao,
    })

  if (error) return { error: error.message }
  return { success: true, tipo: 'entrada' }
}

// Busca o registro aberto (entrada sem saída) de hoje
export async function getRegistroHojeAction(employeeId: string, companyId: string) {
  const admin = createAdminClient()
  const hoje  = new Date().toISOString().slice(0, 10)

  const { data } = await admin
    .from('time_records')
    .select('id, entrada, saida, data')
    .eq('company_id', companyId)
    .eq('employee_id', employeeId)
    .eq('data', hoje)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return data ?? null
}
