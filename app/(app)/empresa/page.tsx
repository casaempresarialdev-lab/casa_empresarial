import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCompany, getCompanyBanks } from './queries'
import { EmpresaAbas } from './components/empresa-abas'
import { getEstrutura } from './estrutura/queries'
import { exigirAcessoPagina } from '@/lib/auth/acesso'

export const dynamic = 'force-dynamic'

export default async function EmpresaPage({ searchParams }: { searchParams: Promise<{ aba?: string }> }) {
  await exigirAcessoPagina('sistema.empresa')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const companyId = cookieStore.get('active_company_id')?.value

  const [company, banks, estrutura, { aba }] = await Promise.all([
    companyId ? getCompany(companyId) : null,
    companyId ? getCompanyBanks(companyId) : [],
    companyId ? getEstrutura(companyId) : { departamentos: [], cargos: [] },
    searchParams,
  ])

  return (
    <EmpresaAbas
      company={company}
      banks={banks}
      companyId={companyId ?? null}
      departamentos={estrutura.departamentos}
      cargos={estrutura.cargos}
      abaInicial={aba === 'estrutura' ? 1 : 0}
    />
  )
}
