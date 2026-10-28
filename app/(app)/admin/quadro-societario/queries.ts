import { createAdminClient } from '@/lib/supabase/server'

export type Socio = {
  id: string
  company_id: string
  nome: string
  cpf: string | null
  email: string | null
  telefone: string | null
  participacao: number | null
  cargo: string | null
  administrador: boolean
  cep: string | null
  uf: string | null
  cidade: string | null
  logradouro: string | null
  bairro: string | null
  numero: string | null
  complemento: string | null
  created_at: string
  updated_at: string
  /** Caminho da foto no bucket privado 'documentos' (migration 20261027000056) */
  foto_path?: string | null
  /** Link temporário da foto (gerado na consulta) */
  foto_url?: string | null
  /** Quantidade de documentos do sócio */
  documentos?: number
}

export async function getSocioById(id: string, companyId: string): Promise<Socio | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('socios')
    .select('*')
    .eq('id', id)
    .eq('company_id', companyId)
    .maybeSingle()

  if (error || !data) return null
  const socio = data as Socio
  let foto_url: string | null = null
  if (socio.foto_path) {
    const { data: signed } = await admin.storage.from('documentos').createSignedUrl(socio.foto_path, 3600)
    foto_url = signed?.signedUrl ?? null
  }
  return { ...socio, foto_url }
}

export async function getSocios(companyId: string): Promise<Socio[]> {
  const admin = createAdminClient()
  const [{ data, error }, { data: docs }] = await Promise.all([
    admin
      .from('socios')
      .select('*')
      .eq('company_id', companyId)
      .order('nome', { ascending: true }),
    // Se a tabela socio_documents ainda não existir, a contagem fica zerada
    admin.from('socio_documents').select('socio_id').eq('company_id', companyId),
  ])

  if (error) throw error
  const socios = (data ?? []) as Socio[]

  // Links temporários (1h) das fotos, gerados de uma vez
  const paths = socios.map((s) => s.foto_path).filter((p): p is string => !!p)
  const urlByPath = new Map<string, string>()
  if (paths.length) {
    const { data: signed } = await admin.storage.from('documentos').createSignedUrls(paths, 3600)
    for (const item of signed ?? []) if (item.path && item.signedUrl) urlByPath.set(item.path, item.signedUrl)
  }

  const docCount = new Map<string, number>()
  for (const d of docs ?? []) docCount.set(d.socio_id, (docCount.get(d.socio_id) ?? 0) + 1)

  return socios.map((s) => ({
    ...s,
    foto_url: s.foto_path ? urlByPath.get(s.foto_path) ?? null : null,
    documentos: docCount.get(s.id) ?? 0,
  }))
}
