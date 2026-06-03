# Casa Empresarial — Blueprint do Projeto
> Documento de referência para desenvolvimento com Claude Code  
> Stack: Next.js 14 (App Router) + Supabase + Vercel  
> Gerado em: 07/05/2026

---

## 1. VISÃO GERAL

SaaS de gestão empresarial para microempresários, estruturado na metodologia "Casa Empresarial" da Carol. Substitui Bling + Conta Azul + Sólides + Trello + Google Drive por uma única plataforma acessível.

**5 módulos (as 5 partes da casa):**
- Administrativo (O Telhado)
- Financeiro (Coluna 1)
- Pessoas / RH (Coluna 2)
- Operacional (A Fundação)
- Marketing (Arquitetura Externa)

---

## 2. STACK TÉCNICA

```
Frontend:     Next.js 14 (App Router)
Backend:      Supabase (PostgreSQL + Auth + Storage + Realtime)
Deploy:       Vercel
Estilização:  Tailwind CSS
Formulários:  react-hook-form + zod
Tabelas:      TanStack Table v8
Estado:       Zustand (modais, sidebar, empresa ativa)
E-mail:       Resend
Pagamentos:   Stripe (planos SaaS)
```

---

## 3. ESTRUTURA DE PASTAS

```
casa-empresarial/
├── app/
│   ├── (auth)/                    # Rotas públicas — sem sidebar
│   │   ├── login/
│   │   ├── cadastro/
│   │   │   ├── passo-1/
│   │   │   ├── passo-2/
│   │   │   └── termos/
│   │   ├── esqueci-senha/
│   │   └── nova-senha/
│   │
│   └── (app)/                     # Rotas autenticadas — com sidebar
│       ├── layout.tsx             # Shell: sidebar + header
│       ├── dashboard/
│       ├── perfil/
│       ├── empresa/
│       ├── meu-plano/
│       │
│       ├── admin/                 # Módulo Administrativo
│       │   ├── usuarios/
│       │   ├── quadro-societario/
│       │   └── logins-senhas/
│       │
│       ├── financeiro/            # Módulo Financeiro
│       │   ├── contatos/
│       │   ├── centro-de-custo/
│       │   ├── categorias/
│       │   ├── contas-cartoes/
│       │   ├── fluxo-de-caixa/
│       │   │   ├── page.tsx       # Lista geral
│       │   │   ├── pagamentos/
│       │   │   └── recebimentos/
│       │   └── faturas/
│       │
│       ├── operacional/           # Módulo Operacional
│       │   ├── produtos/
│       │   ├── pedidos-compra/
│       │   ├── pedidos-venda/
│       │   └── frente-de-caixa/   # Auth própria
│       │
│       ├── pessoas/               # Módulo Pessoas / RH
│       │   ├── funcionarios/
│       │   ├── prestadores/
│       │   ├── admissao/
│       │   ├── encargos/
│       │   ├── beneficios/
│       │   ├── folha-de-pagamento/
│       │   ├── escala-de-trabalho/
│       │   ├── registro-de-ponto/
│       │   ├── seguranca-saude/
│       │   ├── pesquisas/
│       │   └── reunioes/
│       │
│       └── marketing/             # Módulo Marketing
│           ├── calendario/
│           ├── depoimentos/
│           ├── fotos-videos/
│           ├── material-grafico/
│           ├── manual-da-marca/
│           └── reunioes/
│
├── components/
│   ├── ui/                        # Design System base
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── modal.tsx
│   │   ├── table.tsx
│   │   ├── pagination.tsx
│   │   ├── badge.tsx
│   │   ├── tooltip.tsx
│   │   ├── avatar.tsx
│   │   ├── breadcrumb.tsx
│   │   ├── toggle.tsx
│   │   ├── checkbox.tsx
│   │   ├── radio.tsx
│   │   └── address-field.tsx      # CEP + auto-complete ViaCEP
│   │
│   ├── layout/
│   │   ├── sidebar.tsx            # Sidebar retrátil
│   │   ├── header.tsx             # Avatar + seletor de empresa
│   │   └── page-title.tsx
│   │
│   └── modules/                   # Componentes específicos de módulo
│       ├── financeiro/
│       └── pessoas/
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts              # Supabase client (browser)
│   │   ├── server.ts              # Supabase client (server)
│   │   └── middleware.ts
│   ├── validations/               # Schemas zod por entidade
│   └── utils.ts
│
├── hooks/
│   ├── use-empresa.ts             # Empresa ativa (multi-CNPJ)
│   └── use-permissions.ts
│
├── store/
│   └── index.ts                   # Zustand: modal, sidebar, empresa ativa
│
├── middleware.ts                  # Auth guard + seleção de empresa
└── supabase/
    └── migrations/                # SQL das migrations
```

---

## 4. BANCO DE DADOS (Supabase / PostgreSQL)

### 4.1 Schema: Autenticação e Multi-tenant

```sql
-- Usuários (extends auth.users do Supabase)
CREATE TABLE profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id),
  name         TEXT NOT NULL,
  avatar_url   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Empresas (CNPJs)
CREATE TABLE companies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social    TEXT NOT NULL,
  cnpj            TEXT UNIQUE NOT NULL,
  inscricao_estadual TEXT,
  inscricao_municipal TEXT,
  regime_tributario TEXT,
  endereco        JSONB,              -- {cep, logradouro, numero, complemento, bairro, cidade, uf}
  logo_url        TEXT,
  instagram_url   TEXT,
  cor_principal   TEXT DEFAULT '#C19A6B',
  cor_secundaria  TEXT DEFAULT '#EED9C4',
  dados_bancarios JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Relação CPF (profile) → múltiplos CNPJs (companies)
CREATE TABLE company_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID REFERENCES companies(id) ON DELETE CASCADE,
  profile_id  UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'member',  -- 'owner' | 'admin' | 'member' | 'accountant'
  permissions JSONB DEFAULT '{}',              -- controle granular por módulo
  status      TEXT DEFAULT 'active',           -- 'active' | 'inactive'
  invited_by  UUID REFERENCES profiles(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, profile_id)
);
```

### 4.2 Schema: Módulo Administrativo

```sql
-- Quadro Societário
CREATE TABLE socios (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID REFERENCES companies(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL,
  cpf         TEXT,
  participacao DECIMAL(5,2),
  contato     JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Logins e Senhas (cofre)
CREATE TABLE credentials (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID REFERENCES companies(id) ON DELETE CASCADE,
  sistema     TEXT NOT NULL,
  login       TEXT NOT NULL,
  senha       TEXT NOT NULL,           -- criptografada via pgcrypto
  observacao  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.3 Schema: Módulo Financeiro

```sql
-- Contatos (clientes / fornecedores)
CREATE TABLE contacts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID REFERENCES companies(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL,
  tipo        TEXT NOT NULL CHECK (tipo IN ('PF', 'PJ')),
  cpf_cnpj    TEXT,
  email       TEXT,
  telefone    TEXT,
  endereco    JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Centro de Custo
CREATE TABLE cost_centers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID REFERENCES companies(id) ON DELETE CASCADE,
  nome         TEXT NOT NULL,
  codigo       TEXT,
  responsavel  UUID REFERENCES profiles(id),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Categorias (hierárquicas)
CREATE TABLE categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID REFERENCES companies(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL,
  tipo        TEXT NOT NULL CHECK (tipo IN ('receita', 'despesa')),
  parent_id   UUID REFERENCES categories(id),  -- NULL = categoria raiz
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Contas Bancárias
CREATE TABLE bank_accounts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID REFERENCES companies(id) ON DELETE CASCADE,
  banco       TEXT NOT NULL,
  agencia     TEXT,
  numero      TEXT,
  tipo        TEXT,   -- 'corrente' | 'poupança' | etc
  saldo_inicial DECIMAL(12,2) DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Cartões de Crédito
CREATE TABLE credit_cards (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID REFERENCES companies(id) ON DELETE CASCADE,
  nome            TEXT NOT NULL,
  bandeira        TEXT,
  limite          DECIMAL(12,2),
  dia_vencimento  INT,
  dia_fechamento  INT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Lançamentos (Fluxo de Caixa) — ENTIDADE CENTRAL
CREATE TABLE transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID REFERENCES companies(id) ON DELETE CASCADE,
  descricao       TEXT NOT NULL,
  tipo            TEXT NOT NULL CHECK (tipo IN ('pagamento', 'recebimento')),
  valor           DECIMAL(12,2) NOT NULL,
  data_competencia DATE NOT NULL,
  data_vencimento  DATE,
  categoria_id    UUID REFERENCES categories(id),
  account_id      UUID REFERENCES bank_accounts(id),
  card_id         UUID REFERENCES credit_cards(id),
  status          TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'cancelado', 'conciliado')),
  cost_center_id  UUID REFERENCES cost_centers(id),
  contact_id      UUID REFERENCES contacts(id),
  detalhes        TEXT,
  -- Recorrência
  recorrente      BOOLEAN DEFAULT FALSE,
  recorrencia_tipo TEXT,       -- 'mensal' | 'anual' | etc
  recorrencia_fim  DATE,       -- NULL = infinito (diferencial crítico)
  parent_id       UUID REFERENCES transactions(id),  -- série de recorrência
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Faturas de Cartão
CREATE TABLE card_invoices (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID REFERENCES companies(id) ON DELETE CASCADE,
  card_id     UUID REFERENCES credit_cards(id),
  mes_ano     TEXT NOT NULL,  -- 'YYYY-MM'
  valor_total DECIMAL(12,2),
  status      TEXT DEFAULT 'aberta' CHECK (status IN ('aberta', 'fechada', 'paga')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.4 Schema: Módulo Operacional

```sql
-- Produtos
CREATE TABLE products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID REFERENCES companies(id) ON DELETE CASCADE,
  nome            TEXT NOT NULL,
  sku             TEXT,
  categoria       TEXT,
  preco_venda     DECIMAL(12,2),
  preco_custo     DECIMAL(12,2),
  estoque_atual   INT DEFAULT 0,
  unidade_medida  TEXT,
  tags            TEXT[],
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Pedidos de Compra
CREATE TABLE purchase_orders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID REFERENCES companies(id) ON DELETE CASCADE,
  fornecedor_id UUID REFERENCES contacts(id),
  data        DATE,
  status      TEXT DEFAULT 'rascunho',
  itens       JSONB,    -- [{product_id, nome, qtd, preco}]
  valor_total DECIMAL(12,2),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Pedidos de Venda
CREATE TABLE sale_orders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID REFERENCES companies(id) ON DELETE CASCADE,
  cliente_id  UUID REFERENCES contacts(id),
  data        DATE,
  status      TEXT DEFAULT 'rascunho',
  itens       JSONB,
  valor_total DECIMAL(12,2),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.5 Schema: Módulo Pessoas

```sql
-- Funcionários
CREATE TABLE employees (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID REFERENCES companies(id) ON DELETE CASCADE,
  nome            TEXT NOT NULL,
  cpf             TEXT,
  telefone        TEXT,
  status          TEXT DEFAULT 'ativo',  -- 'admissao' | 'experiencia' | 'ativo' | 'inativo'
  data_admissao   DATE,
  data_experiencia_fim DATE,
  vale_transporte BOOLEAN DEFAULT FALSE,
  grau_instrucao  TEXT,
  documentos      JSONB,   -- URLs dos uploads no Supabase Storage
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Prestadores de Serviço
CREATE TABLE service_providers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID REFERENCES companies(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL,
  cnpj        TEXT,
  servico     TEXT,
  documentos  JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Registro de Ponto
CREATE TABLE time_records (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id),
  data        DATE NOT NULL,
  entrada     TIME,
  saida       TIME,
  horas_trabalhadas INTERVAL GENERATED ALWAYS AS (saida - entrada) STORED,
  foto_url    TEXT,
  localizacao JSONB,   -- {lat, lng}
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Escala de Trabalho
CREATE TABLE work_schedules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID REFERENCES companies(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id),
  data        DATE NOT NULL,
  turno       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Pesquisas de Clima
CREATE TABLE surveys (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID REFERENCES companies(id) ON DELETE CASCADE,
  titulo      TEXT NOT NULL,
  perguntas   JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Reuniões
CREATE TABLE meetings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID REFERENCES companies(id) ON DELETE CASCADE,
  titulo      TEXT NOT NULL,
  data        TIMESTAMPTZ,
  participantes JSONB,
  ata         TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.6 Schema: Módulo Marketing

```sql
-- Manual da Marca
CREATE TABLE brand_manual (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID REFERENCES companies(id) ON DELETE CASCADE,
  categoria   TEXT NOT NULL,  -- 'conceito' | 'publico-alvo' | 'persona' | 'tom-de-voz' | 'atendimento'
  conteudo    JSONB,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Calendário Editorial
CREATE TABLE editorial_calendar (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID REFERENCES companies(id) ON DELETE CASCADE,
  titulo      TEXT NOT NULL,
  data_publicacao DATE,
  status      TEXT DEFAULT 'ideia' CHECK (status IN ('ideia', 'em_producao', 'feito', 'publicado')),
  plataforma  TEXT,
  estrategia  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Assets (Fotos, Vídeos, Material Gráfico, Depoimentos)
CREATE TABLE media_assets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID REFERENCES companies(id) ON DELETE CASCADE,
  tipo        TEXT NOT NULL,  -- 'foto' | 'video' | 'material_grafico' | 'depoimento'
  nome        TEXT,
  url         TEXT NOT NULL,  -- Supabase Storage URL
  tamanho     BIGINT,
  mime_type   TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.7 Row Level Security (RLS)

```sql
-- Padrão para TODAS as tabelas com company_id:
ALTER TABLE [tabela] ENABLE ROW LEVEL SECURITY;

CREATE POLICY "[tabela]_policy" ON [tabela]
  USING (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE profile_id = auth.uid()
      AND status = 'active'
    )
  );
```

---

## 5. DESIGN SYSTEM

### Tokens de Cor (CSS Variables)
```css
:root {
  --color-primary:        #EED9C4;
  --color-primary-dark:   #C19A6B;
  --color-primary-darker: #A67B5B;
  --color-text-primary:   #05070F;
  --color-text-secondary: #111111;
  --color-text-muted:     #747474;
  --color-bg-default:     #FAF8F9;
  --color-bg-surface:     #F1F1F1;
  --color-error:          #FF0000;
}
```

### Tipografia
- **Inter** — corpo de texto e UI geral
- **Manrope** — headings de marketing/onboarding
- **Hind** — elementos específicos de UI

### Layout
- Base: 1440px
- Sidebar retraída: ~64px | expandida: ~240px
- Altura de linha de tabela: 40px

---

## 6. ARQUITETURA DE AUTENTICAÇÃO E MULTI-EMPRESA

```
1. Usuário se cadastra → cria profile (CPF/pessoa física)
2. Durante onboarding → cadastra primeira empresa (CNPJ)
3. company_members registra a relação owner
4. Header exibe seletor de empresa → troca via cookie/context
5. Middleware injeta company_id ativo em todas as queries
6. RLS garante isolamento total por company_id
7. Convite de terceiros → email → link → aceite → company_members
```

### Middleware (middleware.ts)
```typescript
// Verificar sessão
// Se autenticado → verificar company_id ativo no cookie
// Se não tem company → redirecionar para /cadastro/empresa
// Injetar company_id no header para uso nas Server Actions
```

---

## 7. PADRÕES DE IMPLEMENTAÇÃO

### Server Actions (padrão para CRUD)
```typescript
// app/(app)/financeiro/categorias/actions.ts
'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createCategory(data: CategoryFormData) {
  const supabase = createClient()
  const companyId = // pegar do cookie/header
  
  const { error } = await supabase
    .from('categories')
    .insert({ ...data, company_id: companyId })
  
  if (error) throw error
  revalidatePath('/financeiro/categorias')
}
```

### Zustand Store (modais e estado global)
```typescript
// store/index.ts
interface AppStore {
  activeCompanyId: string | null
  setActiveCompany: (id: string) => void
  sidebarExpanded: boolean
  toggleSidebar: () => void
  openModal: (id: string, data?: unknown) => void
  closeModal: () => void
  activeModal: { id: string; data?: unknown } | null
}
```

### Componente de Tabela Padrão
```typescript
// Toda tabela usa TanStack Table com:
// - Paginação (10/25/50 por página)
// - Ações por linha (editar/excluir via tooltip)
// - Scroll horizontal em mobile
// - Estado de loading (skeleton)
// - Estado vazio (empty state)
```

---

## 8. SUPABASE STORAGE — BUCKETS

```
company-logos/          → logos das empresas
employee-documents/     → docs de funcionários (privado, RLS)
media-assets/           → fotos, vídeos, material gráfico
  └── {company_id}/
       ├── fotos/
       ├── videos/
       └── material-grafico/
```

---

## 9. VARIÁVEIS DE AMBIENTE

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

RESEND_API_KEY=
FROM_EMAIL=noreply@casaempresarial.com.br

NEXT_PUBLIC_APP_URL=http://localhost:3000

# Stripe (futuro)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
```

---

## 10. ROADMAP DE DESENVOLVIMENTO (MVP First)

### Sprint 1 — Fundação (1-2 semanas)
- [ ] Configurar projeto Next.js 14 + Supabase + Tailwind
- [ ] Migrations de auth (profiles, companies, company_members)
- [ ] Fluxo de cadastro (2 passos + termos)
- [ ] Login / logout / esqueci senha
- [ ] Shell autenticada: sidebar + header + breadcrumb
- [ ] Seletor de empresa no header
- [ ] Dashboard com widgets placeholder

### Sprint 2 — Módulo Administrativo (1 semana)
- [ ] Migrations: socios, credentials
- [ ] Tela: Usuários (CRUD via modal)
- [ ] Tela: Quadro Societário (CRUD via modal)
- [ ] Tela: Logins e Senhas (cofre com validação de senha)

### Sprint 3 — Módulo Financeiro Parte 1 (2 semanas)
- [ ] Migrations: contacts, cost_centers, categories, bank_accounts, credit_cards
- [ ] CRUD: Contatos
- [ ] CRUD: Centro de Custo
- [ ] CRUD: Categorias (hierárquico)
- [ ] CRUD: Contas e Cartões

### Sprint 4 — Módulo Financeiro Parte 2 (2 semanas) ← DIFERENCIAL CRÍTICO
- [ ] Migration: transactions com recorrência
- [ ] Fluxo de Caixa: listagem com filtros
- [ ] Lançamento: formulário simples e detalhado
- [ ] **Recorrência infinita** de parcelas (motor central)
- [ ] Faturas de cartão (abrir/fechar/pagar)
- [ ] Exportação de extrato (impressão)

### Sprint 5 — Módulo Pessoas (2 semanas)
- [ ] Migrations: employees, service_providers, time_records, etc.
- [ ] CRUD: Funcionários + upload de documentos
- [ ] Registro de Ponto
- [ ] Banco de Horas (cálculo automático)
- [ ] Escala de Trabalho

### Sprint 6 — Módulo Marketing (1 semana)
- [ ] Calendário Editorial
- [ ] Upload de mídia (Supabase Storage)
- [ ] Manual da Marca

### Sprint 7 — Módulo Operacional (2 semanas)
- [ ] Produtos + Estoque
- [ ] Pedidos de Compra e Venda (multi-step)
- [ ] Frente de Caixa (sessão separada)

### Sprint 8 — Planos e Pagamento (1 semana)
- [ ] Stripe integration
- [ ] Tela Meu Plano
- [ ] Bloqueio por módulo conforme plano

---

## 11. CLAUDE.md — Para colar na raiz do projeto

```markdown
# Casa Empresarial

SaaS de gestão para microempresários. Stack: Next.js 14 App Router + Supabase + Tailwind.

## Arquitetura
- Multi-tenant via company_id em todas as tabelas
- RLS no Supabase garante isolamento por empresa
- Usuário (CPF/profile) → N empresas (CNPJ/companies) via company_members
- Server Actions para mutações, Server Components para leitura
- Zustand para estado client-side (modal, sidebar, empresa ativa)

## Convenções
- Sempre usar `createClient()` do `@/lib/supabase/server` em Server Components
- Nunca expor SUPABASE_SERVICE_ROLE_KEY no client
- Sempre filtrar por company_id (RLS já cobre, mas filtre explicitamente também)
- Modais gerenciados pelo Zustand store — não criar estado local de modal
- Formulários: react-hook-form + zod schema em `lib/validations/`
- Tabelas: TanStack Table com paginação padrão

## Estrutura de módulos
Cada módulo tem:
- page.tsx (Server Component — lista)
- components/ (Client Components — modais, formulários)
- actions.ts (Server Actions — CRUD)
- queries.ts (funções de leitura do Supabase)

## Design System
- Cores em CSS variables (ver globals.css)
- Componentes base em components/ui/
- Fontes: Inter (UI), Manrope (headings), Hind (labels especiais)
- Sidebar retrátil: 64px retraída, 240px expandida

## Comandos úteis
- `npm run dev` — desenvolvimento
- `npx supabase db diff` — ver diff de migrations
- `npx supabase gen types typescript` — gerar types do banco
```

---

## 12. PRIMEIRO COMANDO PARA O CLAUDE CODE

Cole isso no Claude Code para iniciar:

```
Crie um projeto Next.js 14 com App Router chamado "casa-empresarial".

Stack:
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Supabase (@supabase/ssr, @supabase/supabase-js)
- Zustand
- react-hook-form + zod
- TanStack Table

Configure:
1. Estrutura de pastas com grupos (auth) e (app)
2. Supabase client para browser e server (usando @supabase/ssr)
3. Middleware de autenticação
4. Variáveis de ambiente (.env.local e .env.example)
5. globals.css com os CSS tokens de cor e import das fontes Inter e Manrope do Google Fonts
6. Layout da área autenticada com sidebar retrátil (64px/240px) e header
7. Store Zustand com: activeCompanyId, sidebarExpanded, activeModal

CSS tokens de cor:
--color-primary: #EED9C4
--color-primary-dark: #C19A6B
--color-primary-darker: #A67B5B
--color-text-primary: #05070F
--color-text-muted: #747474
--color-bg-default: #FAF8F9
--color-bg-surface: #F1F1F1
--color-error: #FF0000

Não implemente nenhuma tela ainda. Apenas a estrutura, configurações e o shell autenticado.
```

---

*Blueprint gerado com base na visão de produto (calls com Carol) + requisitos extraídos do Figma.*
