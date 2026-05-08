@AGENTS.md

# Casa Empresarial

SaaS de gestão para microempresários. Stack: Next.js (App Router) + Supabase + Tailwind.

## Arquitetura

- Multi-tenant via `company_id` em todas as tabelas
- RLS no Supabase garante isolamento por empresa
- Usuário (CPF/profile) → N empresas (CNPJ/companies) via `company_members`
- Server Actions para mutações, Server Components para leitura
- Zustand para estado client-side (modal, sidebar, empresa ativa)

## Convenções

- Usar `createClient()` de `@/lib/supabase/server` em Server Components/Actions
- Usar `createClient()` de `@/lib/supabase/client` em Client Components
- Nunca expor `SUPABASE_SERVICE_ROLE_KEY` no client
- Sempre filtrar por `company_id` nas queries (RLS já cobre, mas filtre explicitamente)
- Modais gerenciados pelo Zustand store — não criar estado local de modal
- Formulários: react-hook-form + zod schema em `lib/validations/`
- Tabelas: TanStack Table com paginação padrão (10/25/50 por página)

## Estrutura de módulos

Cada módulo tem:
- `page.tsx` — Server Component (lista)
- `components/` — Client Components (modais, formulários)
- `actions.ts` — Server Actions (CRUD)
- `queries.ts` — funções de leitura do Supabase

## Frente de Caixa (PDV)

- Rota: `/operacional/frente-de-caixa`
- Autenticação dupla: sessão Supabase Auth + cookie `pdv_session` (TTL 8h)
- Layout próprio fullscreen sem sidebar principal
- Lógica no `middleware.ts`: verifica ambos os tokens

## Design System

- Cores em CSS variables em `globals.css`
- Componentes base em `components/ui/`
- Fontes: Inter (UI), Manrope (headings), Hind (labels especiais)
- Sidebar: 64px retraída, 240px expandida — controlada pelo Zustand store

## Banco de dados

- Migrations em `supabase/migrations/`
- Gerar types: `npx supabase gen types typescript --local > lib/supabase/types.ts`

## Comandos úteis

```bash
npm run dev                          # desenvolvimento
npx supabase db diff                 # ver diff de migrations
npx supabase gen types typescript    # gerar types do banco
```
