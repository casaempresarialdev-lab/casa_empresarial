import { z } from 'zod'

export const perfilAcessoSchema = z.object({
  nome: z.string().trim().min(1, 'Dê um nome ao perfil').max(60, 'Use até 60 caracteres'),
  permissoes: z.array(z.string()).max(200),
})

export type PerfilAcessoInput = z.infer<typeof perfilAcessoSchema>
