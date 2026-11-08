import type { createAdminClient } from '@/lib/supabase/server'

type Admin = ReturnType<typeof createAdminClient>

/** Cargo desta empresa, com o nome do departamento: de onde saem os textos gravados em vagas, cartas e fichas */
export async function buscarCargo(admin: Admin, companyId: string, positionId: string) {
  const { data } = await admin
    .from('job_positions')
    .select('id, nome, departments(nome)')
    .eq('id', positionId)
    .eq('company_id', companyId)
    .maybeSingle()
  if (!data) return null
  return {
    id: data.id as string,
    nome: data.nome as string,
    departamento: (data.departments as unknown as { nome: string } | null)?.nome ?? '',
  }
}
