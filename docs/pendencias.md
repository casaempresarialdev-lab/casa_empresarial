# Pendências e decisões em aberto

Pontos conhecidos que ainda não foram resolvidos. Ao resolver um, tire daqui (e registre no commit).

## Validar com a contabilidade

- **IRRF do 13º:** o sistema aplica o desconto simplificado e a redução da Lei 15.270/2025 também no 13º. Confirmar se a redução vale para o 13º; se não valer, quem ganha até R$ 5.000 terá IRRF no 13º e hoje aparece zero (`lib/folha/recibos.ts`, `calcularDecimo`).
- **Média de variáveis** (férias e 13º): usa os valores das folhas fechadas, não a quantidade de horas × valor atual da hora.

## Regras duplicadas ou incompletas

- **"Registra ponto" em dois lugares:** o cargo define se aparecem os lançadores de ponto; a ficha tem o próprio `pin_ativo`, que libera a tela de bater ponto e entra na folha. Proposta: o cargo preencher a ficha ao atribuir o cargo.
- **Cargo sem ficha:** quem tem cargo só pelo usuário (sem ficha na Equipe) vê os lançadores, mas as telas de ponto, férias e holerite dizem "não ligado a uma ficha". Decidir se exige a ficha.
- **Ponto sem trava de um registro por dia:** `time_records` não tem índice único por pessoa e dia; o código atualiza o mais recente. Proposta: migration que junta os duplicados e cria o índice.
- **Gestor programando férias em período em aquisição:** hoje a validação deixa a gestão programar em período ainda não completo; a CLT permite por acordo, mas talvez a empresa queira travar.
- **Mês fechado sem trava no ponto:** aprovar ajuste, abonar atestado ou lançar ponto num mês com a folha fechada é permitido. A folha fechada não muda (está congelada), mas o ponto passa a divergir dela. Proposta: a mesma checagem `mesFechado` usada nas férias.
- **13º de quem saiu:** não é calculado (fica para a rescisão, que é feita fora do sistema).

## Funcionalidades recomendadas (ver design-ux.md, seção 15)

- PIN de segurança em: fechar e reabrir a folha e o 13º, cancelar férias com recibo, alterar salário ou dados bancários, excluir pessoa, mudar perfis de acesso.
- Eventos no calendário: exames admissional e demissional, férias aprovadas, vencimentos (ASO, treinamentos, férias), datas da folha e do 13º.
- Dashboards de **Financeiro**, **Operacional** e **Marketing** (Administrativo e Pessoas já têm).
- PDF e Excel do Registro de Ponto no mesmo padrão da folha.

## Fora do escopo por decisão do produto

Pensão alimentícia, salário-família, redução de férias por faltas (art. 130), cálculo da rescisão. Não reabrir sem decisão.
