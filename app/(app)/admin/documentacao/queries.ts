import { createAdminClient } from '@/lib/supabase/server'

export type Document = {
  id: string
  company_id: string
  nome: string
  storage_path: string
  tamanho: number | null
  tipo: string | null
  descricao: string | null
  vencimento: string | null
  observacao: string | null
  folder_id?: string | null
  created_at: string
}

export type DocumentFolder = {
  id: string
  nome: string
  /** Pasta padrão do sistema: não pode ser movida, renomeada nem excluída */
  sistema: boolean
  /** Pasta onde esta está (null = raiz) */
  parent_id: string | null
}

export async function getDocuments(companyId: string): Promise<Document[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('documents')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as Document[]
}

// Pastas padrão (company_id nulo) + pastas da empresa; padrão primeiro, na ordem definida
export async function getFolders(companyId: string): Promise<{ folders: DocumentFolder[]; error: string | null }> {
  // O id entra no filtro .or(): só aceita UUID
  if (!/^[0-9a-f-]{36}$/i.test(companyId)) return { folders: [], error: 'Empresa inválida.' }
  const admin = createAdminClient()
  const query = (cols: string) => admin
    .from('document_folders')
    .select(cols)
    .or(`company_id.is.null,company_id.eq.${companyId}`)
    .order('sistema', { ascending: false })
    .order('ordem')
    .order('nome')

  // Sem a coluna parent_id (SQL de subpastas ainda não aplicado), tudo fica na raiz
  let { data, error } = await query('id, nome, sistema, parent_id')
  if (error) ({ data, error } = await query('id, nome, sistema'))

  // Ex.: tabela ainda não criada no banco
  if (error) return { folders: [], error: error.message }
  const rows = (data ?? []) as unknown as { id: string; nome: string; sistema: boolean; parent_id?: string | null }[]
  return {
    folders: rows.map((f) => ({ id: f.id, nome: f.nome, sistema: f.sistema, parent_id: f.parent_id ?? null })),
    error: null,
  }
}
