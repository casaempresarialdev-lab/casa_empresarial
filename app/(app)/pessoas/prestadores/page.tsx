import { redirect } from 'next/navigation'
import { exigirAcessoPagina } from '@/lib/auth/acesso'

export default async function PrestadoresPage() {
  await exigirAcessoPagina('pessoas.funcionarios')

  redirect('/pessoas/funcionarios')
}
