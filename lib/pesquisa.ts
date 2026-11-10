// Regras da resposta de pesquisa: quando ela aceita respostas e o que é uma resposta válida. Puro: servidor e tela.

import type { SurveyQuestion } from '@/app/(app)/pessoas/pesquisas/queries'

export type Resposta = string | string[] | number

/** Por que a pesquisa não aceita resposta agora; null = aberta */
export type MotivoFechada = 'rascunho' | 'encerrada' | 'antes' | 'depois' | 'sem_perguntas'

export function motivoFechada(s: { status: string; data_inicio: string | null; data_fim: string | null; perguntas: unknown[] }, hoje: string): MotivoFechada | null {
  if (s.status === 'rascunho') return 'rascunho'
  if (s.status !== 'ativo') return 'encerrada'
  if (s.data_inicio && hoje < s.data_inicio) return 'antes'
  if (s.data_fim && hoje > s.data_fim) return 'depois'
  if (!s.perguntas.length) return 'sem_perguntas'
  return null
}

export const hojeBrasil = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())

/** Opções da pergunta, sem as vazias que o cadastro por vírgula pode deixar */
export const opcoesDe = (q: SurveyQuestion) => (q.opcoes ?? []).map((o) => o.trim()).filter(Boolean)

/** Só guarda o que responde de fato a uma pergunta da pesquisa, no formato do tipo dela */
export function limparRespostas(perguntas: SurveyQuestion[], respostas: Record<string, unknown>): Record<string, Resposta> {
  const limpas: Record<string, Resposta> = {}
  for (const q of perguntas) {
    const v = respostas[q.id]
    const opcoes = opcoesDe(q)
    if (q.tipo === 'escala' && typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 5) limpas[q.id] = v
    else if (q.tipo === 'escolha' && typeof v === 'string' && opcoes.includes(v)) limpas[q.id] = v
    else if (q.tipo === 'multipla' && Array.isArray(v)) {
      const marcadas = [...new Set(v.filter((x): x is string => typeof x === 'string' && opcoes.includes(x)))]
      if (marcadas.length) limpas[q.id] = marcadas
    } else if (q.tipo === 'texto' && typeof v === 'string' && v.trim()) limpas[q.id] = v.trim().slice(0, 2000)
  }
  return limpas
}
