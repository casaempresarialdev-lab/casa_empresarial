import Link from 'next/link'

export default function TermosPage() {
  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-primary-darker)' }}>
          Casa Empresarial
        </h1>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border p-8" style={{ borderColor: 'var(--color-bg-surface)' }}>
        <h2 className="text-xl font-bold mb-6" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
          Termos de Uso
        </h2>

        <div className="prose prose-sm max-w-none space-y-4 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          <p><strong>Última atualização:</strong> maio de 2026</p>

          <section>
            <h3 className="font-semibold text-base mb-2" style={{ color: 'var(--color-text-primary)' }}>
              1. Aceitação dos Termos
            </h3>
            <p>
              Ao criar uma conta e utilizar o Casa Empresarial, você concorda com estes Termos de Uso.
              Caso não concorde, não utilize o serviço.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-base mb-2" style={{ color: 'var(--color-text-primary)' }}>
              2. Descrição do Serviço
            </h3>
            <p>
              O Casa Empresarial é uma plataforma SaaS de gestão empresarial para microempresários,
              oferecendo módulos de Administrativo, Financeiro, Pessoas, Operacional e Marketing.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-base mb-2" style={{ color: 'var(--color-text-primary)' }}>
              3. Conta e Segurança
            </h3>
            <p>
              Você é responsável por manter a confidencialidade de suas credenciais de acesso e por todas
              as atividades realizadas em sua conta. Notifique-nos imediatamente sobre qualquer uso não autorizado.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-base mb-2" style={{ color: 'var(--color-text-primary)' }}>
              4. Dados e Privacidade
            </h3>
            <p>
              Seus dados são armazenados com segurança e utilizados exclusivamente para operação do serviço.
              Não compartilhamos dados pessoais com terceiros sem seu consentimento explícito.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-base mb-2" style={{ color: 'var(--color-text-primary)' }}>
              5. Uso Permitido
            </h3>
            <p>
              O sistema deve ser utilizado apenas para fins legais e em conformidade com a legislação brasileira.
              É proibido utilizar o serviço para atividades fraudulentas ou ilegais.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-base mb-2" style={{ color: 'var(--color-text-primary)' }}>
              6. Limitação de Responsabilidade
            </h3>
            <p>
              O Casa Empresarial não se responsabiliza por decisões tomadas com base nas informações
              gerenciadas na plataforma. Recomendamos sempre consultar profissionais especializados.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-base mb-2" style={{ color: 'var(--color-text-primary)' }}>
              7. Contato
            </h3>
            <p>
              Em caso de dúvidas, entre em contato pelo e-mail:{' '}
              <span style={{ color: 'var(--color-primary-dark)' }}>contato@casaempresarial.com.br</span>
            </p>
          </section>
        </div>

        <div className="mt-8 pt-6 border-t flex justify-center" style={{ borderColor: 'var(--color-bg-surface)' }}>
          <Link
            href="/cadastro/passo-1"
            className="text-sm font-medium hover:underline"
            style={{ color: 'var(--color-primary-dark)' }}
          >
            ← Voltar ao cadastro
          </Link>
        </div>
      </div>
    </div>
  )
}
