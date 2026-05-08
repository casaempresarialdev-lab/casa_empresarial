import { z } from 'zod'

function cleanCNPJ(v: string) {
  return v.replace(/\D/g, '')
}

function validCNPJ(cnpj: string): boolean {
  const c = cleanCNPJ(cnpj)
  if (c.length !== 14) return false
  if (/^(\d)\1{13}$/.test(c)) return false

  const calc = (slice: string, weights: number[]) =>
    slice.split('').reduce((acc, d, i) => acc + parseInt(d) * weights[i], 0)

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]

  const r1 = calc(c.slice(0, 12), w1) % 11
  const d1 = r1 < 2 ? 0 : 11 - r1

  const r2 = calc(c.slice(0, 13), w2) % 11
  const d2 = r2 < 2 ? 0 : 11 - r2

  return parseInt(c[12]) === d1 && parseInt(c[13]) === d2
}

export const companySchema = z.object({
  cnpj: z
    .string()
    .min(1, 'CNPJ é obrigatório')
    .refine((v) => validCNPJ(v), { message: 'CNPJ inválido' }),
  razao_social: z.string().min(2, 'Razão social é obrigatória').max(200),
  nome_fantasia: z.string().max(200).optional(),
  regime_tributario: z
    .enum(['simples_nacional', 'lucro_presumido', 'lucro_real', 'mei'])
    .optional(),
  telefone: z.string().optional(),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
})

export type CompanyData = z.infer<typeof companySchema>
