import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { enviarAvisosEventos } from '@/lib/eventos-email'
import { estenderSeries } from '@/lib/calendario-series'

// Rotina agendada: envia por e-mail os avisos dos eventos do calendário. Chamada a cada 5 min pelo Supabase
// (pg_cron — migration 20261028000070) e uma vez por dia pela Vercel (vercel.json; o plano Hobby só permite diário),
// de todos os usuários, mesmo com o sistema fechado. Com o sistema aberto, o próprio sistema já envia
// (resumoNotificacoesAction); a reserva em lib/eventos-email.ts evita e-mail duplicado.
// Também cria as próximas ocorrências dos eventos repetidos sem data final (até 12 meses à frente).
// Protegida pelo CRON_SECRET: a Vercel envia "Authorization: Bearer <CRON_SECRET>".

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const admin = createAdminClient()
  const [r, series] = await Promise.all([enviarAvisosEventos(admin), estenderSeries(admin).catch(() => ({ estendidas: 0 }))])
  return NextResponse.json({ ...r, series }, { status: r.erro ? 500 : 200 })
}
