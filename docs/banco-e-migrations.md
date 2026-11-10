# Banco de dados e migrations

Banco no **Supabase** (Postgres). As mudanças de estrutura ficam em `supabase/migrations/` e são aplicadas **à mão, em ordem**, no SQL Editor do Supabase.

## Criar uma migration

**Nome:** `AAAAMMDD` + número sequencial de 6 dígitos + `_assunto.sql`, sempre maior que o último.
Ex.: `20261110000105_cargo_bate_ponto.sql`. O número sequencial é o que define a ordem; nunca reaproveite nem renumere.

**Cabeçalho:** um comentário dizendo o que muda e por quê, e a linha `-- Pode ser executada de novo sem efeito colateral.`

**Precisa poder rodar de novo sem quebrar nada (idempotente):**

```sql
CREATE TABLE IF NOT EXISTS nome ( ... );
ALTER TABLE nome ADD COLUMN IF NOT EXISTS coluna TEXT NOT NULL DEFAULT 'x';
CREATE INDEX IF NOT EXISTS idx_nome_campo ON nome (company_id, campo);

-- Restrição nova: ignora se já existir
DO $$ BEGIN
  ALTER TABLE nome ADD CONSTRAINT nome_coluna_check CHECK (coluna IN ('a', 'b'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Segurança por empresa
ALTER TABLE nome ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "nome_policy" ON nome;
CREATE POLICY "nome_policy" ON nome USING (is_company_member(company_id));

-- Sempre por último: o Supabase recarrega o esquema da API
NOTIFY pgrst, 'reload schema';
```

**Regras:**
- Toda tabela de dados da empresa tem `company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE` e a política `is_company_member(company_id)`.
- Tabela pessoal (ex.: `notifications`, `survey_participations`) usa `profile_id = auth.uid()`.
- Não use tabela temporária. Ajuste de dados (`UPDATE`) vai com uma condição que o torna inofensivo na segunda execução (ex.: `WHERE adicional_risco IS NULL`).
- Valores permitidos de uma coluna vão num `CHECK`. Para acrescentar um valor depois, derrube e recrie a restrição numa migration nova (ver `20261110000104`).
- Coluna nova com valor padrão que reproduz o comportamento antigo (ex.: `bate_ponto DEFAULT TRUE`), para nada mudar até a empresa configurar.

## O código convive com a migration ainda não aplicada

O código pode chegar à produção antes da migration. Por isso:

- **Leitura** de tabela ou coluna nova: use `select('*')` e trate a ausência (`data.coluna ?? padrao`). Tabela ausente devolve erro `42P01` ou `PGRST205`; trate devolvendo lista vazia ou o padrão.
- **Gravação** em coluna ausente devolve `PGRST204` ou `42703`: devolva uma mensagem clara, por exemplo *"Execute a migration 20261110000105 para…"*. Se o valor gravado for o padrão, grave sem a coluna (ver `salvarCargoAction` em `app/(app)/empresa/estrutura/actions.ts`).
- Comente no código qual migration traz a coluna: `// '*': bate_ponto vem da migration 20261110000105`.

## Aplicar

1. Abra o **SQL Editor** do projeto no Supabase.
2. Rode as migrations pendentes **em ordem de número**, uma por vez, conferindo que cada uma terminou sem erro.
3. Gere os tipos, se usar: `npx supabase gen types typescript --local > lib/supabase/types.ts`.

Para conferir o que já está aplicado sem alterar nada, uma consulta de leitura na tabela ou coluna de cada migration basta (`select coluna from tabela limit 1`): erro = falta aplicar.

## Acesso ao banco no código

- **Server Components e Server Actions:** `createClient()` de `@/lib/supabase/server` para saber quem é o usuário; `createAdminClient()` para ler e gravar.
- O cliente admin **ignora o RLS**. Por isso, **sempre filtre por `company_id`** e confira que o registro alterado é da empresa ativa.
- **Nunca** use `SUPABASE_SERVICE_ROLE_KEY` no navegador nem a coloque no repositório.
- Arquivos (anexos, holerites) ficam no bucket `documentos`, em `funcionarios/<company_id>/<employee_id>/...`. Para abrir, gere link assinado de 5 minutos (`createSignedUrl(path, 300)`).
