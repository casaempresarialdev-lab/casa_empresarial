import { z } from 'zod'

function isValidCpf(digits: string): boolean {
  if (/^(\d)\1+$/.test(digits)) return false
  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i)
  let r = (sum * 10) % 11
  if (r >= 10) r = 0
  if (r !== parseInt(digits[9])) return false
  sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i)
  r = (sum * 10) % 11
  if (r >= 10) r = 0
  return r === parseInt(digits[10])
}

export const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
})

export const cadastroPasso1Schema = z
  .object({
    name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100),
    cpf: z.string()
      .min(1, 'CPF é obrigatório')
      .refine((v) => v.replace(/\D/g, '').length === 11, 'CPF deve ter 11 dígitos')
      .refine((v) => isValidCpf(v.replace(/\D/g, '')), 'CPF inválido'),
    email: z.string().email('E-mail inválido'),
    password: z
      .string()
      .min(8, 'Senha deve ter pelo menos 8 caracteres')
      .regex(/[A-Z]/, 'Deve conter pelo menos uma letra maiúscula')
      .regex(/[0-9]/, 'Deve conter pelo menos um número'),
    confirmPassword: z.string(),
    acceptTerms: z.boolean().refine((v) => v === true, {
      message: 'Você precisa aceitar os termos de uso',
    }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'As senhas não conferem',
    path: ['confirmPassword'],
  })

export const cadastroPasso2Schema = z.object({
  cep: z.string().refine((v) => v.replace(/\D/g, '').length === 8, 'CEP deve ter 8 dígitos'),
  uf: z.string().min(2, 'Selecione o estado'),
  cidade: z.string().min(1, 'Cidade é obrigatória'),
  logradouro: z.string().min(1, 'Logradouro é obrigatório'),
  bairro: z.string().min(1, 'Bairro é obrigatório'),
  numero: z.string().min(1, 'Número é obrigatório'),
  complemento: z.string().optional(),
})

export const esqueciSenhaSchema = z.object({
  email: z.string().email('E-mail inválido'),
})

export const novaSenhaSchema = z
  .object({
    password: z
      .string()
      .min(8, 'Senha deve ter pelo menos 8 caracteres')
      .regex(/[A-Z]/, 'Deve conter pelo menos uma letra maiúscula')
      .regex(/[0-9]/, 'Deve conter pelo menos um número'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'As senhas não conferem',
    path: ['confirmPassword'],
  })

export type LoginData = z.infer<typeof loginSchema>
export type CadastroPasso1Data = z.infer<typeof cadastroPasso1Schema>
export type CadastroPasso2Data = z.infer<typeof cadastroPasso2Schema>
export type EsqueciSenhaData = z.infer<typeof esqueciSenhaSchema>
export type NovaSenhaData = z.infer<typeof novaSenhaSchema>
