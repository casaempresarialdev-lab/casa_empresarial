import { headers } from 'next/headers'
import { limparLocal, type LocalBatida, type OrigemBatida } from './ponto'

/** De onde veio o registro: a localização enviada pelo aparelho e o IP visto pelo servidor */
export async function origemDaRequisicao(local: LocalBatida | null | undefined, em: string): Promise<OrigemBatida> {
  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || null
  return { ...limparLocal(local), ip, em }
}
