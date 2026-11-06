import { z } from 'zod'
import { isValidCpf } from './auth'

// Dados que o próprio candidato preenche. PJ e autônomo não têm os campos trabalhistas.
export function autoCadastroSchema(pj: boolean) {
  const obrigatorio = (msg: string) => z.string().trim().min(1, msg)
  const trabalhista = (msg: string) => (pj ? z.string() : obrigatorio(msg))
  return z.object({
    cpf: z.string().refine((v) => {
      const d = v.replace(/\D/g, '')
      return d.length === 11 && isValidCpf(d)
    }, 'Informe um CPF válido'),
    rg: obrigatorio('Informe o RG'),
    nascimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data de nascimento'),
    telefone: z.string().refine((v) => /^\d{10,11}$/.test(v.replace(/\D/g, '')), 'Informe o telefone com DDD'),
    email: z.string().trim().email('Informe um e-mail válido'),
    grau_instrucao: obrigatorio('Selecione o grau de instrução'),
    dependentes: pj ? z.string() : z.string().regex(/^\d{1,2}$/, 'Informe a quantidade, ou 0'),
    pis_pasep: trabalhista('Informe o PIS / PASEP'),
    serie_ctps: trabalhista('Informe a série da CTPS'),
    certificado_reservista: z.string(),
    dados_bancarios: obrigatorio('Informe os dados bancários'),
  })
}

export type AutoCadastroInput = z.infer<ReturnType<typeof autoCadastroSchema>>
