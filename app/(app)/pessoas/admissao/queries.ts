import { createAdminClient } from '@/lib/supabase/server'
import type { Employee } from '../funcionarios/queries'

export async function getAdmissaoEmployees(companyId: string): Promise<Employee[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('employees')
    .select('*')
    .eq('company_id', companyId)
    .in('status', ['admissao', 'experiencia'])
    .order('data_admissao', { ascending: false })

  if (error) throw error
  return (data ?? []) as unknown as Employee[]
}
