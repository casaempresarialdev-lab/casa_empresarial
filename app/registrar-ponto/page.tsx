import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { exigirAcessoPagina } from '@/lib/auth/acesso'
import { getCompanyBranding } from '@/lib/company-branding'
import { temPinCadastrado } from '@/lib/security-pin'
import { DEFAULT_BRAND_COLOR, themeCssVars } from '@/lib/theme'
import { TelaPonto, type RegistroHoje } from './components/tela-ponto'

export const dynamic = 'force-dynamic'

// Bater ponto: tela cheia, fora do menu, para o usuário logado
export default async function RegistrarPontoPage() {
  await exigirAcessoPagina('visao-geral.bater-ponto')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const companyId = (await cookies()).get('active_company_id')?.value
  if (!companyId) redirect('/dashboard')

  const admin = createAdminClient()
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())

  const [{ data: company }, { data: funcionario }, temPin, branding] = await Promise.all([
    admin.from('companies').select('razao_social, nome_fantasia, logo_url, cor_primaria').eq('id', companyId).maybeSingle(),
    admin.from('employees').select('id, nome, pin_ativo').eq('company_id', companyId).eq('profile_id', user.id).not('status', 'in', '(inativo,demitido)').limit(1).maybeSingle(),
    temPinCadastrado(user.id),
    getCompanyBranding(companyId),
  ])

  const { data: registro } = funcionario
    ? await admin
        .from('time_records')
        .select('entrada, saida_almoco, retorno_almoco, saida')
        .eq('company_id', companyId)
        .eq('employee_id', funcionario.id)
        .eq('data', hoje)
        .limit(1)
        .maybeSingle()
    : { data: null }

  const bloqueio = !funcionario
    ? 'Seu usuário não está ligado a uma ficha da Equipe. Peça ao responsável para vincular o cadastro.'
    : !funcionario.pin_ativo
      ? 'Seu cadastro não está marcado para registrar ponto. Fale com o responsável pela Equipe.'
      : null

  const fundo = branding.corFundo ? `;background-color:${branding.corFundo}` : ''

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `body{${themeCssVars(company?.cor_primaria ?? null)}${fundo}}` }} />
      <TelaPonto
        empresa={{ nome: company?.nome_fantasia || company?.razao_social || '', logoUrl: company?.logo_url ?? null, cor: company?.cor_primaria || DEFAULT_BRAND_COLOR }}
        funcionario={funcionario?.nome ?? null}
        bloqueio={bloqueio}
        registro={(registro as RegistroHoje) ?? null}
        temPin={temPin}
      />
    </>
  )
}
