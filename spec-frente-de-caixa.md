# Especificação Técnica — Frente de Caixa
> Módulo: Operacional  
> Data: 07/05/2026  
> Status: ✅ Especificado | ⏳ Aguarda decisão: saldo de abertura obrigatório?

---

## 1. Modelo de Autenticação

**Reautenticação da sessão existente** — não é um segundo usuário nem PIN avulso.  
O usuário logado no sistema confirma a própria senha para "abrir o caixa".  
A partir daí a interface muda para modo PDV simplificado.

### Por que não reutilizar a sessão principal

A sessão Supabase Auth é de longa duração. O caixa precisa expirar por inatividade (turno de trabalho). Um cookie separado com TTL de 8h resolve isso sem afetar a sessão principal — o gestor pode continuar com o sistema completo em outra aba enquanto o caixa está aberto no tablet do balcão.

---

## 2. Fluxo Completo

```
1. Usuário acessa /operacional/frente-de-caixa
2. Middleware verifica sessão principal (Supabase Auth)
   → Não autenticado → redireciona para /login
   → Autenticado → verifica cookie pdv_session
       → Cookie presente e válido → abre interface do caixa
       → Cookie ausente/expirado → redireciona para /operacional/frente-de-caixa/login
3. Tela de reautenticação (/operacional/frente-de-caixa/login):
   - Exibe avatar + nome do usuário logado
   - Campo de senha
   - Botão "Abrir Caixa"
   - Valida via Supabase Auth (signInWithPassword com e-mail já conhecido)
4. Sucesso:
   - Cria registro em cash_sessions (saldo_abertura, opened_by, opened_at)
   - Grava cookie httpOnly pdv_session (TTL: 8h)
   - Redireciona para /operacional/frente-de-caixa (interface PDV)
5. Interface do caixa: modo fullscreen, sem sidebar principal
6. Botão "Fechar Caixa":
   - Registra closed_at + saldo_fechamento em cash_sessions
   - Apaga cookie pdv_session
   - Redireciona para /dashboard
```

---

## 3. Middleware

```typescript
// middleware.ts — trecho adicional para rotas do PDV
const PDV_ROUTES = ['/operacional/frente-de-caixa']

if (PDV_ROUTES.some(r => pathname.startsWith(r))) {
  const mainSession = // checar cookie Supabase Auth
  if (!mainSession) return NextResponse.redirect('/login')

  const pdvSession = request.cookies.get('pdv_session')
  const isLoginPage = pathname === '/operacional/frente-de-caixa/login'

  if (!pdvSession && !isLoginPage) {
    return NextResponse.redirect('/operacional/frente-de-caixa/login')
  }
  if (pdvSession && isLoginPage) {
    return NextResponse.redirect('/operacional/frente-de-caixa')
  }
}
```

---

## 4. Schema

```sql
CREATE TABLE cash_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID REFERENCES companies(id) ON DELETE CASCADE,
  opened_by        UUID REFERENCES profiles(id),
  opened_at        TIMESTAMPTZ DEFAULT NOW(),
  closed_at        TIMESTAMPTZ,
  saldo_abertura   DECIMAL(12,2) DEFAULT 0,
  saldo_fechamento DECIMAL(12,2),
  status           TEXT DEFAULT 'aberta' CHECK (status IN ('aberta', 'fechada'))
);

-- RLS padrão
ALTER TABLE cash_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cash_sessions_policy" ON cash_sessions
  USING (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE profile_id = auth.uid() AND status = 'active'
    )
  );
```

---

## 5. Layout Responsivo

| Dispositivo | Layout |
|---|---|
| Desktop / notebook | Grid 2 colunas — produtos à esquerda, carrinho à direita |
| Tablet landscape | Mesmo grid, touch-friendly (botões mínimo 48px) |
| Tablet portrait | Produtos em cima, carrinho em drawer inferior |
| Celular | Carrinho visível por padrão, produtos via busca/modal |

A interface do PDV **não usa a sidebar principal**. É um layout próprio fullscreen.

---

## 6. Estrutura de Pastas

```
app/
└── (app)/
    └── operacional/
        └── frente-de-caixa/
            ├── login/
            │   └── page.tsx      # Tela de reautenticação
            ├── page.tsx          # Interface PDV (protegida por pdv_session)
            └── layout.tsx        # Layout próprio — sem sidebar principal
```

---

## 7. Decisão Pendente

> ⏳ **Confirmar com a Carol:** o saldo de abertura do caixa é obrigatório ou opcional no MVP?

- **Obrigatório** → operador informa o troco disponível ao abrir (padrão PDV tradicional)
- **Opcional (MVP)** → campo existe, pode ser zero, sem bloqueio

O campo `saldo_abertura` já está no schema. A decisão afeta apenas a validação do formulário de abertura — não muda a estrutura do banco.
