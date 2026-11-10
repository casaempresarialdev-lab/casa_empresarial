# Fluxos e situações (status)

Os estados de cada processo de Pessoas, o que leva de um ao outro e o que acontece junto. Ao mexer num processo, mantenha estas regras ou atualize este documento.

Convenção: **quem** faz a ação → efeitos (✉️ = notificação para a outra parte).

---

## Pessoa (`employees.status`)

`admissao` → `experiencia` / `ativo` → `ferias` / `afastado` → `demitido` ou `inativo`

- `admissao`: está no kanban de admissão, ainda não aparece na Equipe.
- Ao **finalizar a admissão**: entra na Equipe e recebe o acesso ao sistema por e-mail.
- Ao **finalizar a rescisão**: `demitido`, perde o acesso à empresa, os convites são cancelados e as senhas compartilhadas com ela são removidas.
- `afastado`: o ponto não é apurado na folha.

## Vaga e candidatura

- **Vaga** (`job_openings.status`): `aberta` ⇄ `pausada` → `encerrada`. Encerra sozinha quando as posições se completam.
- **Candidatura** (`job_applications.status`): `nova` → `selecionada` (vira admissão) / `reprovada` / `desistiu` / `processo_encerrado`. Currículos são guardados por 12 meses (LGPD).

## Admissão (kanban, `app/(app)/pessoas/admissao/etapas.ts`)

Realizar entrevista → Enviar carta proposta → Encaminhar para exame → Registrar resultado do exame → Enviar para contabilidade → Aguardando contabilidade → Assinar contrato → **Finalizado**

- A empresa escolhe quais etapas usa e cria etapas próprias (Configurações → Admissão). Algumas andam em par (exame + resultado; contabilidade + aguardando).
- O card avança pelas **ações da ficha**. Arrastar para trás é livre; para frente, abre a ficha.
- **Entrevista** agendada → evento no calendário do entrevistador, com aviso e e-mail.
- **Exame inapto** → novo exame ou reprovação.

## Rescisão (kanban, `app/(app)/pessoas/rescisao/etapas.ts`)

Registrar aviso prévio → Encaminhar para exame demissional → Registrar retorno do exame → Enviar para contabilidade → Aguardando contabilidade → Assinar TRCT → **Finalizado**

- `employee_terminations.status`: `em_andamento` → `finalizada` / `cancelada`. Uma rescisão em andamento por pessoa.
- PJ e autônomo pulam exame e TRCT.

## Ajuste de ponto (`time_adjustments.status`)

`pendente` → `aprovado` / `recusado`

- **Colaborador** pede com motivo, horários, localização e IP → ✉️ gestores com acesso ao Registro de Ponto.
- **Gestor** aprova (os horários entram no ponto do dia) ou recusa com resposta → ✉️ colaborador.
- **Gestor** lança o ponto do dia diretamente → o pedido pendente daquele dia é encerrado como recusado → ✉️ colaborador.

## Atestado e ausência (`time_absences.status`)

`pendente` → `abonado` / `recusado` (e de volta a `pendente` ao desfazer)

- **Colaborador** informa, com anexo → ✉️ gestores. Não impede bater o ponto.
- **Gestor** abona (os dias viram atestado no ponto e não são falta) ou recusa → ✉️ colaborador.
- **Gestor** lança direto, já abonado → ✉️ colaborador.
- **Desfazer** a decisão volta para análise e devolve os dias como eram → ✉️ colaborador.
- "Outra ausência" exige motivo.

## Férias (`employee_vacations.status`)

`solicitada` → `aprovada` / `recusada`; `solicitada` ou `aprovada` → `cancelada`

- **Colaborador** pede dentro das regras ([regras-de-calculo.md](regras-de-calculo.md#3-férias)) → ✉️ gestores com acesso a Férias. Pode desistir enquanto `solicitada` → ✉️ gestores.
- **Gestor** aprova (confere as regras de novo) ou programa direto → marca os dias como férias no ponto, gera o **recibo de férias** e lança no caixa → ✉️ colaborador.
- **Gestor** cancela → tira os dias do ponto, o recibo e os lançamentos (bloqueado se o pagamento já foi baixado ou se o mês está fechado) → ✉️ colaborador.

## Folha do mês (`payroll_entries.status`)

`rascunho` (em conferência) → `fechado` → `pago`

- **Rascunho:** recalculada a cada abertura a partir do ponto, da escala e dos benefícios; só as edições da conferência ficam gravadas.
- **Fechar:** congela os valores e lança salários, adiantamentos, benefícios e guias no caixa → ✉️ cada pessoa, se o holerite do sistema estiver liberado.
- **Reabrir:** só se nada foi pago; tira os lançamentos do caixa.
- **Mês fechado** bloqueia aprovar, programar ou cancelar férias que caiam nele. Ajustes de ponto e atestados ainda **não** têm essa trava (ver [pendencias.md](pendencias.md)); o que mudar depois não altera a folha fechada, que está congelada.

## 13º salário (`payroll_receipts`, tipos `decimo_1` e `decimo_2`)

Aberta (calculada) → Fechada, por parcela.

- **Fechar a 1ª** (até 30/11) e depois a **2ª** (até 20/12): congela, lança no caixa → ✉️ cada pessoa.
- **Reabrir** só se nada foi pago; a 1ª só reabre com a 2ª aberta.

## Pesquisa (`surveys.status`)

`rascunho` → `ativo` → `encerrado` (pode reabrir para `ativo`)

- Só `ativo` e dentro do período aceita respostas. Lançador na home para quem tem ficha e ainda não respondeu.

## Segurança e saúde (`health_safety_records`)

Sem status: a situação vem da validade — em dia, vencendo (30 dias), vencido. Criar ou editar → ✉️ a pessoa do registro.
