// Tipos e regras puras da Estrutura: usados no servidor e na tela.

export type Departamento = { id: string; nome: string }

export type Ocupante = { id: string; nome: string; foto: string | null }

export type Cargo = {
  id: string
  nome: string
  department_id: string
  departamento: string
  superior_id: string | null
  salario_min: number | null
  salario_max: number | null
  ocupantes: Ocupante[]
}

/** O que os formulários de Vagas, Equipe e Carta precisam de um cargo */
export type CargoOpcao = {
  id: string
  nome: string
  departamento: string
  salario_min: number | null
  salario_max: number | null
}

/** Ids de todos os cargos abaixo deste na hierarquia */
export function descendentesDe(cargos: Pick<Cargo, 'id' | 'superior_id'>[], id: string): Set<string> {
  const achados = new Set<string>()
  const fila = [id]
  while (fila.length) {
    const atual = fila.pop()!
    for (const c of cargos) {
      if (c.superior_id === atual && !achados.has(c.id)) {
        achados.add(c.id)
        fila.push(c.id)
      }
    }
  }
  return achados
}

/** Um cargo não pode responder a si mesmo nem a alguém abaixo dele */
export const criaCiclo = (cargos: Pick<Cargo, 'id' | 'superior_id'>[], id: string, superiorId: string) =>
  superiorId === id || descendentesDe(cargos, id).has(superiorId)

const PALETA = ['#2563EB', '#059669', '#D97706', '#7C3AED', '#DB2777', '#0891B2', '#65A30D', '#DC2626']

/** Cor fixa do departamento no organograma, derivada do id */
export function corDepartamento(id: string) {
  let soma = 0
  for (const ch of id) soma = (soma * 31 + ch.charCodeAt(0)) % 1000
  return PALETA[soma % PALETA.length]
}

const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** "R$ 2.000,00 a R$ 3.000,00" */
export function faixaSalarial(c: { salario_min: number | null; salario_max: number | null }) {
  if (c.salario_min != null && c.salario_max != null) return c.salario_min === c.salario_max ? moeda(c.salario_min) : `${moeda(c.salario_min)} a ${moeda(c.salario_max)}`
  if (c.salario_min != null) return `A partir de ${moeda(c.salario_min)}`
  if (c.salario_max != null) return `Até ${moeda(c.salario_max)}`
  return null
}
