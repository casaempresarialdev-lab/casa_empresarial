# Regras de cálculo — ponto, folha, férias e 13º

Como o sistema calcula cada valor, onde está no código e a base legal. **Antes de mexer em qualquer cálculo, rode `npm test`** e acrescente um caso de teste para a mudança (ver [testes.md](testes.md)).

Todo o cálculo é **puro** (sem banco): `lib/folha/calculo.ts`, `lib/folha/config.ts`, `lib/folha/recibos.ts`, `lib/folha/holerite.ts`, `lib/ferias/regras.ts`, `lib/escala/*`. O servidor só junta os dados (`app/(app)/pessoas/folha-de-pagamento/queries.ts`, `queries-decimo.ts`, `recibos.ts`).

---

## ⚠️ Atualização anual obrigatória

Estes valores mudam todo ano e **não se atualizam sozinhos**. Se ninguém mexer, a folha do ano seguinte sai errada sem dar erro nenhum.

| O quê | Onde | Quando |
|---|---|---|
| Faixas e teto do INSS | `lib/folha/calculo.ts` → `INSS_FAIXAS`, `TETO_INSS` | Portaria interministerial de janeiro |
| Faixas do IRRF, dedução por dependente, desconto simplificado | `lib/folha/calculo.ts` → `IRRF_FAIXAS`, `DEDUCAO_DEPENDENTE`, `DESCONTO_SIMPLIFICADO` | Sempre que a Receita mudar |
| Redução do IRRF (Lei 15.270/2025) | `lib/folha/calculo.ts` → `calcIrrf` (limites 5.000 e 7.350) | Se a lei mudar |
| Salário mínimo padrão (base da insalubridade) | `lib/folha/config.ts` → `CONFIG_FOLHA_PADRAO.salario_minimo` **e** o `DEFAULT` da coluna `payroll_settings.salario_minimo` (nova migration) | Janeiro |
| Rótulo das tabelas | `lib/folha/calculo.ts` → `VIGENCIA_TABELAS` e o texto "tabelas de 2026" nas telas da folha e do 13º | Janeiro |

Para cada atualização: altere os valores, atualize as expectativas em `tests/` com um caso calculado à mão e rode `npm test`. As empresas que já salvaram o salário mínimo nas configurações precisam atualizar o próprio valor; vale avisá-las.

Os **feriados nacionais** não precisam de atualização: são calculados a cada ano, inclusive os móveis pela data da Páscoa (`lib/escala/feriados.ts`). Um feriado nacional novo criado por lei precisa entrar na lista de fixos desse arquivo.

---

## 1. Apuração do ponto

`apurarPonto` em `lib/folha/calculo.ts`. Recebe os dias da escala (`generateRange`) e os registros do período.

- **Período:** o mês cheio ou do dia seguinte ao corte no mês anterior até o dia de corte (`periodoApuracao`).
- **Registros livres:** o dia aceita quantos registros forem precisos, alternando entrada e saída. As horas são a soma de cada par (`minutosTrabalhados`). Número ímpar de registros num dia passado = **incompleto**: o dia não entra no cálculo e aparece como "precisa de atenção".
- **Previsto do dia:** saída − entrada − intervalo, pela escala.
- **Tolerância:** diferenças de até N minutos no dia são ignoradas (padrão 10, art. 58 §1º da CLT; configurável de 0 a 60). Passou disso, conta a diferença inteira.
- **Hora extra:** o que passa do previsto. Folga trabalhada = hora extra normal; **domingo de folga** trabalhado = hora extra de domingo; **feriado** trabalhado = hora extra de feriado, exceto na escala 12x36, em que o feriado é dia normal (art. 59-A).
- **Atraso ou saída antecipada:** o que falta do previsto.
- **Falta:** dia de trabalho na escala, já passado (hoje não conta), sem registro e sem marcação de folga, atestado ou férias. Feriado sem registro não é falta. Dias antes da admissão não contam.
- **Semanas com falta:** cada semana (domingo a sábado) com falta sem justificativa, para a perda do DSR.
- **Horário noturno:** minutos de relógio de cada par que caem na faixa configurada (padrão 22h às 5h, `minutosNoturnos`), em horário de Brasília.

**Quando o ponto não é apurado** (a conferência mostra o motivo e os valores são informados à mão):
- `sem_controle`: a ficha não registra ponto, ou é PJ ou autônomo.
- `sem_escala`: a pessoa não tem escala no período.
- `sem_registros`: nenhum registro no mês. Não vira um mês inteiro de faltas.
- `afastado`: o status da pessoa é afastado.

---

## 2. Folha do mês

`calcularFolha` em `lib/folha/calculo.ts`. Os valores automáticos podem ser editados na conferência; a edição prevalece e fica marcada como "Editado".

### Remuneração e valor da hora
- **Salário do mês:** cheio; na admissão no meio do mês, proporcional ao mês comercial de 30 dias.
- **Periculosidade:** 30% do salário. **Insalubridade:** 10%, 20% ou 40% sobre o salário mínimo ou sobre o salário, conforme a configuração, proporcional na admissão. **Não acumulam** (art. 193 §2º): vale o maior.
- **Adicional da pessoa:** a exceção na ficha (`employees.adicional_risco`) ou, sem ela, o do cargo (`job_positions.adicional`).
- **Valor da hora** = remuneração (salário + adicional) ÷ divisor.
- **Divisor:** jornada semanal da escala × 5, com teto de 44h (44h → 220; 40h → 200). Sem escala: 220.

### Proventos
- **Horas extras:** horas × valor da hora × fator (padrão 1,5 normal; 2 feriado; 2 domingo; configuráveis).
- **Adicional noturno:** horas × valor da hora × percentual (padrão 20%). Com a hora reduzida (padrão), cada 52min30s de relógio vale uma hora (minutos × 60 ÷ 52,5).
- **DSR (reflexo):** (horas extras + adicional noturno) ÷ dias úteis × dias de descanso do período. Descanso = domingos e feriados (nacionais e da empresa). Súmula 172 do TST. Desligável.
- **Comissão:** informada na conferência.

### Descontos
- **Faltas:** dias × remuneração ÷ 30.
- **DSR perdido:** 1 dia por semana com falta sem justificativa × remuneração ÷ 30 (Lei 605/49). Atestado abonado não desconta. Desligável e editável.
- **Atrasos:** horas × valor da hora.
- **Benefícios:** valor e desconto pela regra de cada benefício (ex.: VT até 6% do salário), proporcionais aos dias trabalhados (dias na escala − faltas − atestados − férias). Sem apuração do ponto, usa 22 dias.
- **Adiantamento:** percentual do salário, pago no dia configurado e descontado no fechamento. Só CLT e menor aprendiz.

### Encargos (só CLT e menor aprendiz; PJ, autônomo e estagiário não têm)
- **INSS:** progressivo sobre a base (bruto + férias do mês pagas em recibo, menos o INSS já retido no recibo).
- **IRRF:** sobre o bruto − INSS − dependentes, ou o desconto simplificado se for maior; depois a redução da Lei 15.270/2025 (zera até R$ 5.000; parcial até R$ 7.350).
- **FGTS e outros encargos:** percentuais da tela Encargos (padrão FGTS 8% e outros 47,24%) sobre a base do INSS.

### Datas
- **Salário:** N-ésimo dia útil do mês seguinte (sábado conta, domingo e feriado não; padrão 5º) ou dia fixo.
- **Guias (FGTS, INSS, IRRF):** dia N do mês seguinte, antecipado para o dia bancário anterior se cair em fim de semana ou feriado.
- **Benefícios:** dia próprio ou junto com o salário. **Adiantamento:** dia N do próprio mês.

### Fechamento
Fechar **congela** a apuração e os valores (`payroll_entries.apuracao`) e lança no fluxo de caixa, como pendentes e com vencimento: salários, adiantamentos, benefícios e as guias do mês. Reabrir só é permitido se nada foi pago no fluxo de caixa. Mudanças posteriores de regra não alteram folhas fechadas.

---

## 3. Férias

### Períodos (`calcularPeriodos`, `lib/ferias/regras.ts`)
- **Aquisitivo:** 12 meses a partir da admissão. **Concessivo:** os 12 meses seguintes.
- A tela mostra só os períodos cujo concessivo ainda não acabou (os anteriores costumam ter sido tirados antes do sistema) e o período em aquisição.
- **Situação:** em aquisição → disponível → **vencendo** (faltam 60 dias para o fim do concessivo) → concluído (saldo zero).
- **Saldo** = 30 − dias aprovados − dias em pedidos aguardando (férias + dias vendidos).

### Validação do pedido (`validarFerias`)
- O **colaborador** só pede em período completo e com a antecedência configurada (padrão 30 dias). A gestão não tem essas duas travas.
- Começar até o fim do concessivo; não começar nos **2 dias antes de feriado ou folga** (art. 134 §3º).
- Até **3 partes**: uma com pelo menos **14 dias**, as outras com pelo menos **5**; a última parte precisa usar o saldo que sobra (art. 134 §1º).
- **Abono pecuniário** (venda): até 10 dias, um terço (art. 143).
- A empresa pode desligar: pedidos pelo colaborador, divisão em partes e venda de dias.

### Recibo de férias (`calcularReciboFerias`, `lib/folha/recibos.ts`)
- Gerado ao **aprovar ou programar**; pago **2 dias antes do início** (art. 145), antecipado para dia bancário.
- **Férias** = remuneração ÷ 30 × dias. **Média de variáveis** = média de horas extras, adicional noturno, DSR e comissões das últimas 12 folhas fechadas ÷ 30 × dias. **1/3** sobre os dois.
- **Abono** = (remuneração + média) ÷ 30 × dias vendidos, mais 1/3, **sem INSS e sem IRRF**.
- **INSS e IRRF** sobre férias + 1/3, com o IRRF calculado separado do salário.
- Lança no fluxo de caixa o líquido (na data do pagamento) e as retenções (na data das guias).
- **Na folha do mês:** os dias de férias saem do salário e o valor não é pago de novo; a parte das férias que cai no mês entra na base do INSS e do FGTS, e o INSS já retido no recibo é abatido.
- Férias aprovadas antes dos recibos próprios continuam pagas dentro da folha (modo antigo), até alguém gerar o recibo.

---

## 4. 13º salário (`lib/folha/recibos.ts`, `queries-decimo.ts`)

- **Avos:** conta o mês com 15 dias ou mais de trabalho; faltas sem justificativa das folhas fechadas reduzem os dias (Lei 4.090/62).
- **Base** = remuneração atual + média das variáveis das folhas fechadas do ano (até o mês anterior ao pagamento).
- **1ª parcela (até 30/11):** metade do valor proporcional aos avos até novembro, **sem INSS e IRRF**. FGTS sobre ela.
- **2ª parcela (até 20/12):** valor integral do ano − 1ª parcela − INSS − IRRF, com **INSS e IRRF calculados só sobre o 13º**. FGTS sobre (integral − 1ª). Se a 1ª não foi fechada no sistema, a 2ª paga o 13º inteiro.
- Prazos antecipados para o dia bancário anterior.
- **Guias:** FGTS e IRRF no dia de guias do mês seguinte ao pagamento; INSS do 13º em 20/12.
- Entram só CLT e menor aprendiz ativos com salário. Quem saiu recebe o proporcional na rescisão (fora do sistema).
- Fechar congela e lança no fluxo de caixa; a 1ª só reabre se a 2ª estiver aberta.

---

## 5. Fora do escopo (decisão de produto)

Não calculamos: pensão alimentícia, salário-família, redução dos dias de férias por faltas (art. 130), cálculo da rescisão (verbas rescisórias), INSS patronal (depende do regime tributário). Não reabrir sem decisão do produto.

## 6. Pontos para validar com a contabilidade

- **IRRF do 13º:** usa o mesmo cálculo do mês, com desconto simplificado e a redução da Lei 15.270. Confirmar se a redução se aplica ao 13º.
- **Média de variáveis:** usa os **valores** das folhas fechadas, não a quantidade de horas × valor atual da hora. A diferença aparece quando o salário mudou no ano.
