import type { createAdminClient } from '@/lib/supabase/server'
import { somarDias } from '@/lib/escala/periodo'
import type { Batida } from '@/lib/ponto'
import { ASO_MAX_BYTES, GUIA_TIPOS } from '@/lib/validations/admissao'
import { MAX_DIAS_AUSENCIA, ausenciaSchema, rotuloAusencia } from '@/lib/validations/ausencias'

// Atestados, ausências e férias viram marcações no ponto: é assim que o dia deixa de contar como falta na folha.

type Admin = ReturnType<typeof createAdminClient>

export function diasEntre(inicio: string, fim: string): string[] {
  const dias: string[] = []
  for (let d = inicio; d <= fim; d = somarDias(d, 1)) dias.push(d)
  return dias
}

/** Marca os dias sem batida; onde a pessoa bateu ponto, as batidas ficam como estão */
export async function marcarDias(admin: Admin, companyId: string, employeeId: string, datas: string[], tipo: 'atestado' | 'ferias', observacao: string | null) {
  const { data: existentes, error: erroLer } = await admin.from('time_records').select('id, data, batidas').eq('company_id', companyId).eq('employee_id', employeeId).in('data', datas)
  if (erroLer) return erroLer.message
  const registros = (existentes ?? []) as { id: string; data: string; batidas: Batida[] }[]
  const comBatida = new Set(registros.filter((r) => r.batidas?.length).map((r) => r.data))

  // Dia que já tem registro sem batida (ex.: falta lançada) é atualizado; dia sem registro ganha um novo
  const atualizar = registros.filter((r) => !comBatida.has(r.data)).map((r) => r.id)
  const comRegistro = new Set(registros.map((r) => r.data))
  const novos = datas.filter((d) => !comRegistro.has(d))

  if (atualizar.length) {
    const { error } = await admin.from('time_records').update({ tipo, observacao }).in('id', atualizar)
    if (error) return error.message
  }
  if (novos.length) {
    const { error } = await admin.from('time_records').insert(novos.map((data) => ({ company_id: companyId, employee_id: employeeId, data, tipo, observacao, batidas: [] })))
    if (error) return error.message
  }
  return null
}

/** Desfaz a marcação, sem tocar em dias que tenham batidas */
export async function desmarcarDias(admin: Admin, companyId: string, employeeId: string, datas: string[], tipo: 'atestado' | 'ferias') {
  const { data: marcados, error: erroLer } = await admin.from('time_records').select('id, batidas').eq('company_id', companyId).eq('employee_id', employeeId).eq('tipo', tipo).in('data', datas)
  if (erroLer) return erroLer.message
  const lista = (marcados ?? []) as { id: string; batidas: Batida[] }[]
  const vazios = lista.filter((r) => !r.batidas?.length).map((r) => r.id)
  // Dia abonado em que a pessoa bateu ponto: as batidas ficam e o dia volta a ser normal
  const comBatida = lista.filter((r) => r.batidas?.length).map((r) => r.id)
  if (vazios.length) {
    const { error } = await admin.from('time_records').delete().in('id', vazios)
    if (error) return error.message
  }
  if (comBatida.length) {
    const { error } = await admin.from('time_records').update({ tipo: 'normal', observacao: null }).in('id', comBatida)
    if (error) return error.message
  }
  return null
}

/** Texto gravado no dia do ponto */
export const observacaoAusencia = (tipo: string, motivo: string | null) => `${rotuloAusencia(tipo)}${motivo ? `: ${motivo}` : ''}`.slice(0, 500)

/** Valida o formulário e o anexo e grava a ausência. Devolve o registro, ou o erro. */
export async function gravarAusencia(admin: Admin, opcoes: {
  companyId: string
  employeeId: string
  formData: FormData
  origem: 'colaborador' | 'gestor'
  status: 'pendente' | 'abonado'
  autor: { id: string; nome: string }
}): Promise<{ error: string } | { ausencia: { id: string; tipo: string; motivo: string | null; data_inicio: string; data_fim: string } }> {
  const { companyId, employeeId, formData, origem, status, autor } = opcoes
  const parsed = ausenciaSchema.safeParse({
    tipo: formData.get('tipo'),
    data_inicio: formData.get('data_inicio') ?? '',
    data_fim: formData.get('data_fim') ?? '',
    motivo: formData.get('motivo') ?? '',
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const d = parsed.data
  if (diasEntre(d.data_inicio, d.data_fim).length > MAX_DIAS_AUSENCIA) return { error: `Informe no máximo ${MAX_DIAS_AUSENCIA} dias por vez.` }

  const { data: sobrepostas, error: erroSobre } = await admin
    .from('time_absences')
    .select('id')
    .eq('company_id', companyId)
    .eq('employee_id', employeeId)
    .neq('status', 'recusado')
    .lte('data_inicio', d.data_fim)
    .gte('data_fim', d.data_inicio)
    .limit(1)
  if (erroSobre) return { error: erroSobre.message }
  if (sobrepostas?.length) return { error: 'Já existe um atestado ou ausência nestes dias.' }

  const arquivo = formData.get('anexo') as File | null
  let anexo_path: string | null = null
  let anexo_nome: string | null = null
  if (arquivo && arquivo.size > 0) {
    if (!GUIA_TIPOS.includes(arquivo.type)) return { error: 'O anexo precisa ser PDF, JPG ou PNG.' }
    if (arquivo.size > ASO_MAX_BYTES) return { error: 'O anexo pode ter até 10 MB.' }
    const ext = arquivo.name.split('.').pop()?.toLowerCase() || 'pdf'
    anexo_path = `funcionarios/${companyId}/${employeeId}/ausencia_${Date.now()}.${ext}`
    anexo_nome = arquivo.name.slice(0, 200)
    const { error: erroUp } = await admin.storage.from('documentos').upload(anexo_path, await arquivo.arrayBuffer(), { contentType: arquivo.type })
    if (erroUp) return { error: `Não foi possível enviar o anexo: ${erroUp.message}` }
  }

  const motivo = d.motivo || null
  const decidido = status === 'abonado' ? { decidido_por: autor.id, decidido_por_nome: autor.nome, decidido_em: new Date().toISOString() } : {}
  const { data: ausencia, error } = await admin
    .from('time_absences')
    .insert({ company_id: companyId, employee_id: employeeId, data_inicio: d.data_inicio, data_fim: d.data_fim, tipo: d.tipo, motivo, anexo_path, anexo_nome, status, origem, solicitado_por: autor.id, ...decidido })
    .select('id, tipo, motivo, data_inicio, data_fim')
    .single()
  if (error || !ausencia) {
    if (anexo_path) await admin.storage.from('documentos').remove([anexo_path])
    return { error: error?.message ?? 'Não foi possível registrar.' }
  }
  return { ausencia: ausencia as { id: string; tipo: string; motivo: string | null; data_inicio: string; data_fim: string } }
}
