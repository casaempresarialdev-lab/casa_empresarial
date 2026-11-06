import { createAdminClient } from '@/lib/supabase/server'
import { PublicoAviso, PublicoShell } from '@/components/layout/publico-shell'
import { fmtDataHora } from '@/lib/validations/admissao'
import { AutoCadastroForm } from './components/auto-cadastro-form'
import { submitOnboardingAction } from './actions'

export const dynamic = 'force-dynamic'

const TITULO = 'Seus dados de admissão'

export default async function AutoCadastroPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const admin = createAdminClient()

  const { data: tokenRow } = await admin
    .from('employee_onboarding_tokens')
    .select('employee_id, company_id, expires_at, used_at')
    .eq('token', token)
    .maybeSingle()

  if (!tokenRow) {
    return (
      <PublicoShell titulo={TITULO} cor={null}>
        <PublicoAviso icon="info" titulo="Link inválido" texto="Este link não existe ou foi removido. Solicite um novo link à empresa." />
      </PublicoShell>
    )
  }

  const [{ data: employee }, { data: company }] = await Promise.all([
    admin.from('employees')
      .select('nome, cargo, cpf, rg, nascimento, telefone, email, grau_instrucao, dependentes, pis_pasep, serie_ctps, certificado_reservista, dados_bancarios, tipo_contrato, doc_cpf_path, doc_ctps_path, doc_comprovante_residencia_path')
      .eq('id', tokenRow.employee_id)
      .maybeSingle(),
    admin.from('companies').select('nome_fantasia, razao_social, cor_primaria').eq('id', tokenRow.company_id).maybeSingle(),
  ])

  const marca = {
    empresa: company?.nome_fantasia || company?.razao_social || 'Empresa',
    cor: (company?.cor_primaria as string | null) ?? null,
  }
  const nome = employee?.nome ?? 'Funcionário'

  if (tokenRow.used_at) {
    return (
      <PublicoShell titulo={TITULO} {...marca}>
        <PublicoAviso icon="check" tom="sucesso" titulo="Formulário já preenchido" texto={`Obrigado, ${nome.split(' ')[0]}! Seus dados já foram recebidos.`} />
      </PublicoShell>
    )
  }

  if (new Date(tokenRow.expires_at) < new Date()) {
    return (
      <PublicoShell titulo={TITULO} {...marca}>
        <PublicoAviso icon="alarm" titulo="Link expirado" texto="O prazo deste link terminou. Solicite um novo à empresa." />
      </PublicoShell>
    )
  }

  const destaques = [
    { icon: 'user' as const, texto: nome },
    ...(employee?.cargo ? [{ icon: 'briefcase' as const, texto: employee.cargo as string }] : []),
    { icon: 'alarm' as const, texto: `Preencha até ${fmtDataHora(tokenRow.expires_at)}` },
  ]

  return (
    <PublicoShell titulo={TITULO} {...marca} destaques={destaques} largo>
      <AutoCadastroForm
        enviar={submitOnboardingAction.bind(null, token)}
        employeeName={nome}
        companyName={marca.empresa}
        inicial={{
          cpf: employee?.cpf ?? '',
          rg: employee?.rg ?? '',
          nascimento: employee?.nascimento ?? '',
          telefone: employee?.telefone ?? '',
          email: employee?.email ?? '',
          grau_instrucao: employee?.grau_instrucao ?? '',
          dependentes: String(employee?.dependentes ?? 0),
          pis_pasep: employee?.pis_pasep ?? '',
          serie_ctps: employee?.serie_ctps ?? '',
          certificado_reservista: employee?.certificado_reservista ?? '',
          dados_bancarios: employee?.dados_bancarios ?? '',
        }}
        tipoContrato={employee?.tipo_contrato ?? null}
        docsExistentes={[
          employee?.doc_cpf_path ? 'cpf' : null,
          employee?.doc_ctps_path ? 'ctps' : null,
          employee?.doc_comprovante_residencia_path ? 'comprovante_residencia' : null,
        ].filter((d): d is string => !!d)}
      />
    </PublicoShell>
  )
}
