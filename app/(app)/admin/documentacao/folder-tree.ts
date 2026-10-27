import type { DocumentFolder } from './queries'

// Funções da árvore de pastas (pasta com pai que não existe mais conta como raiz)

export function folderParent(folders: DocumentFolder[], f: DocumentFolder): string | null {
  return f.parent_id && folders.some((p) => p.id === f.parent_id) ? f.parent_id : null
}

// Caminho da raiz até a pasta (inclusive)
export function folderPath(folders: DocumentFolder[], id: string | null): DocumentFolder[] {
  const path: DocumentFolder[] = []
  const seen = new Set<string>()
  let cur = folders.find((f) => f.id === id)
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id)
    path.unshift(cur)
    const parent = folderParent(folders, cur)
    cur = parent ? folders.find((f) => f.id === parent) : undefined
  }
  return path
}

// Ids da pasta e de todas as que estão dentro dela
export function folderSubtree(folders: DocumentFolder[], id: string): Set<string> {
  const ids = new Set([id])
  let added = true
  while (added) {
    added = false
    for (const f of folders) {
      const p = folderParent(folders, f)
      if (p && ids.has(p) && !ids.has(f.id)) { ids.add(f.id); added = true }
    }
  }
  return ids
}

// Todas as pastas em ordem de árvore, com o nível (para listas com recuo)
export function flattenFolders(folders: DocumentFolder[]): { folder: DocumentFolder; depth: number }[] {
  const out: { folder: DocumentFolder; depth: number }[] = []
  const walk = (parent: string | null, depth: number) => {
    for (const f of folders) {
      if (folderParent(folders, f) === parent && !out.some((o) => o.folder.id === f.id)) {
        out.push({ folder: f, depth })
        walk(f.id, depth + 1)
      }
    }
  }
  walk(null, 0)
  return out
}
