import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { exigirAcessoPagina } from '@/lib/auth/acesso'
import { getDiasDoPonto, getFichaDoPonto, getMinhasAusencias, hojeBrasil } from './queries'
import { MeuPontoClient } from './components/meu-ponto-client'

export const dynamic = 'force-dynamic'

// Meu ponto: os próprios dias e horários, com pedido de ajuste
export default async function MeuPontoPage({ searchParams }: { searchParams: Promise<{ mes?: string; aba?: string }> }) {
  await exigirAcessoPagina('visao-geral.bater-ponto')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const companyId = (await cookies()).get('active_company_id')?.value
  if (!companyId) redirect('/dashboard')

  const atual = hojeBrasil().slice(0, 7)
  const { mes, aba } = await searchParams
  // Qualquer mês válido, inclusive os próximos (para ver férias e abonos programados)
  const periodo = mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes) ? mes : atual
  const [ano, numeroMes] = periodo.split('-').map(Number)

  const ficha = await getFichaDoPonto(companyId, user.id)
  const [dias, ausencias] = await Promise.all([
    ficha?.pin_ativo ? getDiasDoPonto(companyId, ficha.id, ano, numeroMes) : [],
    ficha ? getMinhasAusencias(companyId, ficha.id) : [],
  ])

  return (
    <div className="w-full">
      <MeuPontoClient
        dias={dias}
        ausencias={ausencias}
        periodo={periodo}
        mesAtual={atual}
        abaInicial={aba === 'ausencias' ? 1 : 0}
        bloqueio={!ficha
          ? 'Seu usuário não está ligado a uma ficha da Equipe. Peça ao responsável para vincular o cadastro.'
          : !ficha.pin_ativo ? 'Seu cadastro não está marcado para registrar ponto. Fale com o responsável pela Equipe.' : null}
      />
    </div>
  )
}
