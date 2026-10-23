// O PostgREST limita cada resposta (1000 linhas por padrão). Busca todas as páginas.
const PAGE_SIZE = 1000

/**
 * @param page monta a consulta para o intervalo [from, to] — deve ter um .order() estável
 */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE_SIZE) return rows
  }
}
