import type { createAdminClient } from '@/lib/supabase/server'

// Apaga candidaturas de quem não foi contratado depois do prazo informado no aceite (12 meses).
// Quem foi selecionado fica de fora: os dados seguem no processo de admissão. A vaga nunca é apagada.
export async function expurgarCandidaturas(admin: ReturnType<typeof createAdminClient>) {
  const hoje = new Date().toISOString().slice(0, 10)
  const { data, error } = await admin
    .from('job_applications')
    .select('id, anexo_path')
    .lt('guardar_ate', hoje)
    .neq('status', 'selecionada')
    .limit(200)

  // Tabela ainda não criada ou falha momentânea: tenta de novo na próxima rotina
  if (error || !data?.length) return { apagadas: 0 }

  // Candidatura aberta pela admissão não tem arquivo
  const anexos = data.map((c) => c.anexo_path as string | null).filter((p): p is string => !!p)
  if (anexos.length) {
    const { error: errRemove } = await admin.storage.from('documentos').remove(anexos)
    if (errRemove) return { apagadas: 0 }
  }

  const { error: errDelete } = await admin.from('job_applications').delete().in('id', data.map((c) => c.id as string))
  return { apagadas: errDelete ? 0 : data.length }
}
