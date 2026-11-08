import { z } from 'zod'

const dinheiro = z.string().trim().regex(/^(\d{1,3}(\.\d{3})*|\d+)(,\d{1,2})?$|^$/, 'Informe um valor válido, como 2.500,00')

export const departamentoSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome do departamento').max(120, 'Use até 120 caracteres'),
})

export const cargoSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome do cargo').max(120, 'Use até 120 caracteres'),
  department_id: z.string().uuid('Escolha o departamento'),
  superior_id: z.string().uuid().or(z.literal('')),
  salario_min: dinheiro,
  salario_max: dinheiro,
})

export type CargoInput = z.infer<typeof cargoSchema>
