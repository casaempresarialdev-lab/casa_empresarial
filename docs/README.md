# Documentação da equipe — Casa Empresarial

SaaS de gestão para microempresários, white label (cada empresa com a sua marca). Next.js 16 + Supabase + Tailwind.

## Por onde começar

1. **[Convenções de código](convencoes-de-codigo.md)** — estrutura de um módulo, páginas, Server Actions, permissões.
2. **[Guia de design e UX](design-ux.md)** — como uma tela deve ser, se comportar e falar com o usuário, com o checklist de entrega.
3. **[Glossário](glossario.md)** — os termos de Pessoas (período aquisitivo, avos, DSR...).

## Referência

| Documento | Quando ler |
|---|---|
| [Regras de cálculo](regras-de-calculo.md) | Antes de mexer em ponto, folha, férias ou 13º. **Inclui o que precisa ser atualizado todo ano** (INSS, IRRF, salário mínimo). |
| [Fluxos e situações](fluxos-e-status.md) | Antes de mexer num processo (admissão, rescisão, ajustes, atestados, férias, folha) |
| [Banco e migrations](banco-e-migrations.md) | Ao criar tabela ou coluna |
| [Testes](testes.md) | Ao mudar uma regra de cálculo |
| [Publicação](publicacao.md) | Ao colocar uma versão no ar |
| [Pendências](pendencias.md) | Antes de começar algo novo: o que está em aberto ou foi decidido não fazer |

## Comandos

```bash
npm run dev              # desenvolvimento em http://localhost:3000
npm test                 # testes das regras de cálculo
npx tsc --noEmit -p .    # checagem de tipos
npm run build            # build de produção (o mesmo da Vercel)
```

Mantenha estes documentos vivos: quem muda uma regra, um fluxo ou um padrão atualiza o documento no mesmo commit.
