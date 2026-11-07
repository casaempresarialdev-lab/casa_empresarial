// Motor das etapas de um processo em kanban (admissão, rescisão): as etapas padrão têm ordem fixa e só ativam ou
// inativam; cada empresa pode incluir etapas próprias (controle interno, sem integração) em qualquer posição antes
// da final. Puro: usado no servidor e na tela.

/** Etapa do processo da empresa: padrão (com cadeado, só ativa ou inativa) ou personalizada */
export type Etapa = { key: string; label: string; padrao: boolean; ativo: boolean }

/** Como fica gravado (coluna etapas JSONB), na ordem do processo */
export type EtapaSalva = { key: string; label?: string; ativo?: boolean }

export const PREFIXO_PERSONALIZADA = 'custom_'
export const isPersonalizada = (key: string | null | undefined) => !!key?.startsWith(PREFIXO_PERSONALIZADA)
export const ETAPA_LABEL_MAX = 60

export type DefProcesso = {
  /** Etapas padrão, na ordem; a última é a final */
  etapas: readonly { key: string; label: string }[]
  final: string
  /** A segunda etapa do par acompanha a primeira: ativa ou inativa junto e nada entra entre as duas */
  vinculadaA: Record<string, string>
  /** Reativada se a configuração gravada não tiver nenhuma etapa ativa */
  reserva: string
  /** O que cada etapa padrão faz, para a tela de configuração */
  descricao: Record<string, string>
}

const isPadrao = (def: DefProcesso, key: string) => def.etapas.some((e) => e.key === key)

export const temEtapaAtiva = (def: DefProcesso, etapas: Etapa[]) => etapas.some((e) => e.ativo && e.key !== def.final)

/**
 * Lista completa da empresa, na ordem: as padrão sempre todas e na ordem fixa, com as personalizadas
 * entre elas (até antes da final). Personalizada gravada entre as duas etapas de um par vai para depois
 * do par. Sem configuração (ou inválida), é o fluxo padrão com tudo ativo.
 */
export function montarEtapasDe(def: DefProcesso, salvas: unknown): Etapa[] {
  const lista = Array.isArray(salvas) ? (salvas as EtapaSalva[]).filter((s) => s && typeof s.key === 'string') : []
  const ativoPadrao = new Map(lista.filter((s) => isPadrao(def, s.key)).map((s) => [s.key, s.ativo !== false]))

  // Cada personalizada entra antes da próxima etapa padrão que aparece depois dela
  const antesDe = new Map<string, Etapa[]>()
  const vistas = new Set<string>()
  lista.forEach((s, i) => {
    if (!isPersonalizada(s.key) || vistas.has(s.key)) return
    const label = String(s.label ?? '').trim().slice(0, ETAPA_LABEL_MAX)
    if (!label) return
    vistas.add(s.key)
    let ancora = lista.slice(i + 1).find((x) => isPadrao(def, x.key))?.key ?? def.final
    // Não entra entre as etapas de um par
    while (def.vinculadaA[ancora]) ancora = def.etapas[def.etapas.findIndex((e) => e.key === ancora) + 1].key
    antesDe.set(ancora, [...(antesDe.get(ancora) ?? []), { key: s.key, label, padrao: false, ativo: true }])
  })

  const resultado: Etapa[] = []
  for (const e of def.etapas) {
    resultado.push(...(antesDe.get(e.key) ?? []))
    const dona = def.vinculadaA[e.key]
    const ativo = e.key === def.final || (ativoPadrao.get(dona ?? e.key) ?? true)
    resultado.push({ key: e.key, label: e.label, padrao: true, ativo })
  }
  // Gravado sem nenhuma ativa (não deveria acontecer): a reserva volta, para haver processo
  if (!temEtapaAtiva(def, resultado)) resultado.find((e) => e.key === def.reserva)!.ativo = true
  return resultado
}

/** Para gravar: as padrão só com o ativo; as personalizadas com o nome */
export const paraSalvarDe = (def: DefProcesso, etapas: Etapa[]): EtapaSalva[] =>
  etapas.filter((e) => e.key !== def.final).map((e) => (e.padrao ? { key: e.key, ativo: e.ativo } : { key: e.key, label: e.label }))

export const indiceEtapa = (etapas: Etapa[], key: string | null | undefined) => etapas.findIndex((e) => e.key === key)

export const labelEtapa = (etapas: Etapa[], key: string | null | undefined) =>
  etapas.find((e) => e.key === key)?.label ?? 'Etapa removida'

/** Primeira etapa ativa, sem as puladas (ex.: entrevista na admissão sem vaga), a não ser que só reste ela */
export function primeiraEtapaDe(def: DefProcesso, etapas: Etapa[], pular: string[] = []): string {
  const ativas = etapas.filter((e) => e.ativo && e.key !== def.final)
  return (ativas.find((e) => !pular.includes(e.key)) ?? ativas[0])?.key ?? def.reserva
}

/** Próxima etapa ativa depois da atual, sem as puladas; sem nenhuma, a final (o processo é concluído) */
export function proximaEtapaDe(def: DefProcesso, etapas: Etapa[], atual: string, pular: string[] = []): string {
  const i = indiceEtapa(etapas, atual)
  if (i < 0) return primeiraEtapaDe(def, etapas, pular)
  return etapas.slice(i + 1).find((e) => e.ativo && e.key !== def.final && !pular.includes(e.key))?.key ?? def.final
}

/** Onde uma personalizada pode entrar: antes de cada item até a final, menos entre as etapas de um par */
export function posicoesValidas(def: DefProcesso, lista: Etapa[]): number[] {
  const fim = lista.findIndex((e) => e.key === def.final)
  return lista.map((_, i) => i).filter((i) => i <= fim && !def.vinculadaA[lista[i].key])
}
