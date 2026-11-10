# Testes

Os testes cobrem as **regras puras** — ponto, folha, férias, 13º, escala e feriados — que são a parte que mexe com dinheiro e com direitos do trabalhador. Rodam em Node com o [Vitest](https://vitest.dev), sem banco nem navegador.

```bash
npm test            # roda tudo uma vez (use antes de commitar)
npm run test:watch  # fica rodando enquanto você edita
```

## Onde estão

| Arquivo | O que cobre |
|---|---|
| `tests/ponto-folha.test.ts` | Tabelas de INSS/IRRF, divisor, apuração do ponto (faltas, atrasos, horas extras, tolerância, 12x36), registros livres, valores do mês |
| `tests/folha-config-recibos.test.ts` | Período e vencimentos, configuração, adicional noturno, DSR, insalubridade e periculosidade, recibo de férias, 13º, holerite fechando com o líquido |
| `tests/ferias-escala.test.ts` | Períodos aquisitivos e validação das férias (CLT), escala de trabalho (semanal, ciclos, expiração, trocas avulsas), feriados |

## Regras

- **Mudou um cálculo, mude o teste junto.** Acrescente um caso com o valor calculado à mão e o raciocínio no comentário (ex.: `// (45 + 30 + 3,43) / 23 × 7`).
- **Datas fixas.** Os testes usam datas fixas (ex.: hoje = `2026-11-10`), nunca a data de agora, para não quebrarem com o tempo.
- **Todo documento fecha:** holerite, recibo de férias e 13º têm de ter `proventos − descontos = líquido`; há teste para isso.
- **Compatibilidade com folhas fechadas:** campos novos em `InsumosFolha` ou `ApuracaoPonto` são opcionais e, ausentes, reproduzem o cálculo antigo. Há um teste ("folha antiga, sem os campos novos, não muda") que garante isso — mantenha.
- Telas, actions e consultas ao banco não têm teste automático: teste no navegador antes de publicar (ver [publicacao.md](publicacao.md)).
