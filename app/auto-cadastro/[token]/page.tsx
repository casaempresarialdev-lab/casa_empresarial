import { createAdminClient } from '@/lib/supabase/server'
import { AutoCadastroForm } from './components/auto-cadastro-form'

export const dynamic = 'force-dynamic'

function MessagePage({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#FAF8F9' }}>
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl mx-auto mb-5"
          style={{ backgroundColor: '#F3F4F6' }}>
          {icon}
        </div>
        <h2 className="text-xl font-bold mb-2" style={{ fontFamily: 'Manrope', color: '#1F2937' }}>{title}</h2>
        <p className="text-sm" style={{ color: '#6B7280' }}>{body}</p>
      </div>
    </div>
  )
}

export default async function AutoCadastroPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const admin = createAdminClient()

  const { data: tokenRow } = await admin
    .from('employee_onboarding_tokens')
    .select('employee_id, company_id, expires_at, used_at')
    .eq('token', token)
    .single()

  if (!tokenRow) {
    return (
      <MessagePage
        icon="🔗"
        title="Link inválido"
        body="Este link não existe ou foi removido. Solicite um novo link ao seu empregador."
      />
    )
  }

  if (tokenRow.used_at) {
    const { data: emp } = await admin
      .from('employees')
      .select('nome')
      .eq('id', tokenRow.employee_id)
      .single()

    return (
      <MessagePage
        icon="✅"
        title="Formulário já preenchido"
        body={`Obrigado${emp?.nome ? ', ' + emp.nome.split(' ')[0] : ''}! Seus dados já foram recebidos com sucesso.`}
      />
    )
  }

  if (new Date(tokenRow.expires_at) < new Date()) {
    return (
      <MessagePage
        icon="⏰"
        title="Link expirado"
        body="Este link expirou após 7 dias. Solicite um novo link ao seu empregador."
      />
    )
  }

  const [{ data: employee }, { data: company }] = await Promise.all([
    admin.from('employees').select('nome').eq('id', tokenRow.employee_id).single(),
    admin.from('companies').select('nome_fantasia, razao_social').eq('id', tokenRow.company_id).single(),
  ])

  const employeeName = employee?.nome ?? 'Funcionário'
  const companyName  = company?.nome_fantasia ?? company?.razao_social ?? 'Empresa'

  return (
    <AutoCadastroForm
      token={token}
      employeeName={employeeName}
      companyName={companyName}
    />
  )
}
