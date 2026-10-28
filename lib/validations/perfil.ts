import { z } from 'zod'
import { isValidCpf, senhaForte } from './auth'

// Dados do próprio usuário (Meu Perfil). CPF opcional aqui: só é pedido se ainda não foi cadastrado.
export const perfilSchema = z.object({
  name: z.string().trim().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100),
  cpf: z
    .string()
    .optional()
    .refine((v) => {
      const d = v?.replace(/\D/g, '') ?? ''
      return !d || (d.length === 11 && isValidCpf(d))
    }, 'CPF inválido'),
  cep: z
    .string()
    .optional()
    .refine((v) => !v || v.replace(/\D/g, '').length === 8, 'CEP deve ter 8 dígitos'),
  uf: z.string().optional(),
  cidade: z.string().optional(),
  logradouro: z.string().optional(),
  bairro: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
})

// Troca de senha no perfil: senha segura (8+ caracteres, maiúscula, minúscula, número e símbolo) + confirmação
export const perfilSenhaSchema = z
  .object({ password: senhaForte, confirmPassword: z.string().min(1, 'Confirme a nova senha') })
  .refine((d) => d.password === d.confirmPassword, { message: 'As senhas não conferem', path: ['confirmPassword'] })

// Etapa "Nova senha" do modal (sozinha)
export const novaSenhaForteSchema = z.object({ password: senhaForte })

// PIN de segurança: 6 números, sem sequências óbvias
const pin = z
  .string()
  .regex(/^\d{6}$/, 'O PIN deve ter exatamente 6 números')
  .refine((v) => !/^(\d)\1{5}$/.test(v), 'Não use o mesmo número repetido')
  .refine((v) => !['123456', '654321', '012345', '543210'].includes(v), 'Escolha um PIN menos óbvio')

// Etapa "PIN" do modal (sozinha) e a gravação final (PIN + confirmação)
export const novoPinSchema = z.object({ pin })

export const definirPinSchema = z
  .object({ pin, confirmPin: z.string() })
  .refine((d) => d.pin === d.confirmPin, { message: 'Os PINs não conferem', path: ['confirmPin'] })

// Confirmação de identidade com a senha da conta (ex.: antes de ativar o 2FA)
export const confirmarSenhaSchema = z.object({ senha: z.string().min(1, 'Informe a sua senha') })

export const codigo2faSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'O código tem 6 números'),
})

export type NovoPinData = z.infer<typeof novoPinSchema>
export type DefinirPinData = z.infer<typeof definirPinSchema>
export type Codigo2faData = z.infer<typeof codigo2faSchema>
export type ConfirmarSenhaData = z.infer<typeof confirmarSenhaSchema>

export type PerfilData = z.infer<typeof perfilSchema>
export type PerfilSenhaData = z.infer<typeof perfilSenhaSchema>
export type NovaSenhaForteData = z.infer<typeof novaSenhaForteSchema>
