# Convenções de código

Stack: **Next.js 16 (App Router)**, **Supabase**, **Tailwind**, **Zustand**, **react-hook-form + zod**, **@react-pdf/renderer**, **exceljs**.

> Esta versão do Next.js tem mudanças em relação ao que costuma aparecer em tutoriais. Antes de usar uma API do Next, confira o guia em `node_modules/next/dist/docs/`.

## Estrutura de um módulo

```
app/(app)/<area>/<modulo>/
  page.tsx            Server Component: autoriza, busca os dados e entrega ao client
  queries.ts          leituras do banco (funções async, sem 'use server')
  actions.ts          Server Actions ('use server'): gravações
  components/         Client Components ('use client'): tela, modais, PDFs
```

Regras de negócio puras (sem banco) ficam em `lib/<assunto>/` — ex.: `lib/folha/calculo.ts`, `lib/ferias/regras.ts` — para poderem ser testadas e usadas tanto no servidor quanto na tela. Validações zod ficam em `lib/validations/<assunto>.ts`.

## Página

```ts
export const dynamic = 'force-dynamic'

export default async function Pagina() {
  await exigirAcessoPagina('pessoas.ferias')          // perfil de acesso
  const { data: { user } } = await (await createClient()).auth.getUser()
  if (!user) redirect('/login')
  const companyId = (await cookies()).get('active_company_id')?.value
  if (!companyId) redirect('/empresa')
  // colaborador tem tela própria: redirecione se for o caso (getViewerContext)
  const dados = await getDados(companyId)
  return <div className="w-full"><ModuloClient {...dados} /></div>
}
```

## Server Action

```ts
'use server'
export async function aprovarAction(companyId: string, id: string) {
  const negado = await semAcesso('pessoas.ferias', companyId)   // 1. permissão
  if (negado) return negado
  const viewer = await getViewerContext(companyId)              // 2. colaborador não gerencia
  if (viewer?.isColaborador) return { error: 'Sem permissão para esta ação.' }

  const parsed = schema.safeParse(dados)                        // 3. valida
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const admin = createAdminClient()
  const { data, error } = await admin.from('tabela')            // 4. grava filtrando pela empresa
    .update({ status: 'aprovada' })
    .eq('id', id).eq('company_id', companyId).eq('status', 'solicitada')
    .select('id').maybeSingle()
  if (error) return { error: error.message }
  if (!data) return { error: 'Este pedido já foi decidido.' }

  await notificarFuncionario(admin, { ... })                    // 5. avisa a outra parte
  revalidatePath('/pessoas/ferias')                             // 6. atualiza as telas afetadas
  return { success: true as const }
}
```

- Retorno sempre `{ error: string }` ou `{ success: true }` (mais dados, se preciso). **Não lance exceção** para erro esperado: o `toast.promise` mostra o `error`.
- Mensagens de erro em português, dizendo o que fazer.
- `revalidatePath` em todas as telas que mostram o dado (gestão e colaborador).
- Etapas em sequência: se uma falha, desfaça as anteriores antes de devolver o erro.

## Cliente (tela)

- Estado de modal na própria tela (ou no Zustand quando compartilhado), sempre com o componente `Modal`.
- Ações chamadas com `toast.promise(...)` e, no sucesso, `router.refresh()`.
- Componentes base em `components/ui/` — `Modal`, `ConfirmDialog`, `ListItem`, `ListEmpty`, `ActionMenu`, `AddButton`, `FilterSelect`, `SearchField`, `FilterResult`, `Input`, `Select`, `FileDropZone`, `Tabs` (`form-steps`), `PinGate`, `CodeInput`. Dashboards em `components/modules/dashboard/`.
- Nada de `alert`, `confirm` ou `prompt`.

## Permissões

- Catálogo único em `lib/acesso/catalogo.ts`: cada módulo e item com uma **chave estável** (`pessoas.ferias`). O menu, a tela de perfis e o bloqueio vêm dele.
- Item novo: inclua no catálogo, use a chave em `exigirAcessoPagina` e em `semAcesso`.
- O dashboard de cada área é o item com `dashboard: true` e `exato: true`.
- Rotas do colaborador: lista `COLABORADOR_ROUTES` em `middleware.ts`.

## Nomes e textos

- Código em **português** (variáveis, funções, comentários), seguindo o domínio: `feriasDe`, `calcularFolha`, `notificarGestores`.
- Comentários explicam **por quê**, não o quê.
- Datas como texto `AAAA-MM-DD`; "hoje" sempre no fuso de Brasília:
  ```ts
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
  ```
- Horário com fuso: `2026-11-10T08:00:00-03:00`.
- Dinheiro arredondado em centavos (`Math.round(v * 100) / 100`) a cada passo do cálculo.

## Antes de commitar

```bash
npm test && npx tsc --noEmit -p .
```

Veja também: [design-ux.md](design-ux.md), [banco-e-migrations.md](banco-e-migrations.md), [publicacao.md](publicacao.md).
