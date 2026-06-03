import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { LoginPontoForm } from './components/login-ponto-form'

export const dynamic = 'force-dynamic'

export default async function RegistrarPontoPage() {
  // Se já tem sessão válida, vai direto para o portal
  const cookieStore = await cookies()
  const session = cookieStore.get('ponto_session')?.value
  if (session) {
    try {
      JSON.parse(session) // valida que é JSON
      redirect('/registrar-ponto/ponto')
    } catch {
      // sessão corrompida — continua na tela de login
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ backgroundColor: '#FAF8F9' }}>
      <div className="w-full max-w-sm">
        {/* Logo / header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ backgroundColor: 'var(--color-primary)' }}>
            <span className="text-3xl">🏢</span>
          </div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'Manrope', color: 'var(--color-text-primary)' }}>
            Registro de Ponto
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Entre com o CNPJ da empresa e seu PIN
          </p>
        </div>

        <LoginPontoForm />
      </div>
    </div>
  )
}
