# TODO — o que ainda está pendente

Lista do que ainda **não foi feito**. Marque `[x]` quando concluir.

> **Atualização:** os itens 1 a 4 abaixo foram **implementados** (mensagem com origem + código Ref em EN/PT/ES, contador de cliques, vendas com estoque, clientes e painel financeiro). O que sobrou está indicado como pendente. Detalhes no `README.md` (seção *Vendas, estoque, clientes e financeiro*).
>
> **Atualização (30/09):** SMS e e-mail como contato alternativo ao WhatsApp foram **implementados** (produto e catálogo, com mensagem pronta no idioma da página; número/e-mail configuráveis em *Configurações*, cada um opcional e oculto se vazio). Não entram no contador de cliques nem no funil do Financeiro (item 2) — isso segue pendente caso se queira estender.

---

## 1. Mensagem automática do WhatsApp com a origem do cliente

**Objetivo:** quando o cliente clica em qualquer botão de WhatsApp, a conversa abre com uma mensagem pronta que diz **de onde ele veio** (por exemplo: "Vim pelo site, pela página do produto X" ou "pelo botão do menu"). A mensagem muda conforme o idioma da versão que ele está usando (inglês ou português).

**Como está hoje:** já existe uma mensagem pronta em cada idioma (`whatsapp.general` e `whatsapp.product` em `apps/web/src/i18n/messages/en.ts` e `pt.ts`). A geral diz que a pessoa veio pelo site; a do produto traz nome, valor e link da peça. **Ainda não diz de qual lugar do site o clique saiu** e o texto não é editável pelo admin.

- [x] Incluir a **origem do clique** na mensagem: botão do menu, botão flutuante, rodapé, hero da home, página de catálogo, cartão do produto, página do produto.
- [x] Manter a mensagem **em inglês na versão inglesa e em português na versão `/pt`** (as duas já são carregadas pelos dicionários; acrescentar as variações por origem).
- [x] Exemplo de texto (PT): `Olá! Vim pelo site da Abasse Crystal (página: Coleção). Gostaria de saber mais.` / (EN): `Hello! I found you on the Abasse Crystal website (page: Collection). I'd like to know more.`
- [x] Incluir um **código de referência curto** na mensagem (ex.: `Ref: A7K2`) para o admin conseguir relacionar a conversa com o clique registrado (ver item 2).
- [ ] (Opcional) Deixar o admin **editar o texto da mensagem** em *Configurações*, nos dois idiomas.

---

## 2. Contador de cliques no WhatsApp (e mensagens enviadas)

**Objetivo:** saber quantas pessoas clicaram para ir ao WhatsApp e, se possível, quantas realmente enviaram a mensagem, com um somatório no painel.

**Limitação importante:** o site **só consegue contar o clique**. Depois que o WhatsApp abre, o site não sabe se a pessoa apertou "enviar". Alternativas para estimar o envio:
- o **código de referência** na mensagem (item 1): o admin marca no painel quais conversas chegaram (manual); ou
- usar a **API oficial do WhatsApp Business (Meta)** com webhook, que avisa quando chega mensagem (exige conta Business, aprovação e tem custo).

- [x] Registrar cada clique num evento no banco: data/hora, botão/origem, página, produto (se houver), idioma, código de referência. **Sem dados pessoais** (LGPD); não guardar IP nem identificar a pessoa.
- [x] Endpoint público para registrar o clique, com **limite de requisições** e proteção contra robôs/spam (o contador não pode ser inflado à vontade).
- [x] Painel com **totais**: cliques por dia/semana/mês, por origem, por produto mais clicado, por idioma.
- [x] Ação no painel para **marcar "conversa recebida"** pelo código de referência.
- [ ] (Opcional) Integração com a **API oficial do WhatsApp Business** para saber automaticamente quando a mensagem chegou.
- [x] Mostrar a **taxa de conversão**: cliques → conversas → vendas (liga com o item 3).

---

## 3. Registro de vendas

**Objetivo:** uma página do painel para registrar as vendas e controlar o estoque.

**Como está hoje:** o produto tem situação (disponível, vendido, oculto), mas **não tem quantidade em estoque nem histórico de vendas**.

- [x] Adicionar **quantidade em estoque** ao produto (hoje cada produto é tratado como peça única).
- [x] Página **Vendas** com cadastro de venda: data, produto(s) vendido(s), **quantidade**, **peso**, **valor** (unitário e total), desconto, frete, forma de pagamento, cliente (opcional) e observações.
- [x] Ao registrar a venda, **baixar o estoque** e marcar o produto como "vendido" quando zerar (com opção de desfazer/cancelar venda).
- [x] Vincular a venda ao **código de referência** do WhatsApp (item 2), quando existir, para saber de onde veio.
- [x] Listagem de vendas com filtro por situação e busca.
- [ ] **Exportação** (CSV/Excel) das vendas e filtro por período/categoria.
- [x] Guardar o **custo** da peça (opcional) para calcular lucro e margem.
- [x] Testes de segurança das novas rotas (apenas admin logado; validação de valores; sem alteração de vendas por mass assignment) na suíte `apps/api/test/security.mjs`.

---

## 4. Painel financeiro com gráficos

**Objetivo:** enxergar o dinheiro do negócio de forma visual.

- [x] Faturamento por **dia / semana / mês** (gráfico de linha ou barras).
- [x] Vendas por **categoria** e **produtos mais vendidos**.
- [x] **Ticket médio**, total de peças e peso vendidos no período.
- [x] **Lucro e margem** (quando o custo estiver cadastrado).
- [x] Comparativo com o **período anterior** (crescimento/queda).
- [x] **Funil**: cliques no WhatsApp → conversas → vendas (junta os itens 2 e 3).
- [x] Seletor de período.
- [ ] **Exportação** dos números do financeiro (CSV/PDF).
- [x] Seguir o mesmo visual do painel atual (azul marinho + dourado) (painel só em português, por decisão do cliente).

---

## Novos pendentes (surgiram com as vendas e o espanhol)

- [ ] **Moeda para o mundo todo:** hoje preços e vendas são em reais (R$). Se for cobrar em dólar/euro, definir moeda por venda e conversão no financeiro.
- [ ] **Tradução por produto** também para o espanhol (nome/descrição/categoria seguem no idioma digitado).
- [ ] Revisão do texto em espanhol por um falante nativo.
- [ ] Política de privacidade e aviso sobre o contador de cliques para visitantes da UE/América Latina (LGPD/GDPR).

---

## Também pendente (já identificado antes, fora do que foi pedido agora)

Estes itens não foram pedidos agora; estão aqui só para não se perderem.

- [ ] Substituir a **logo provisória** (`apps/web/public/logo.svg`) pela logo oficial do cliente (SVG ou PNG grande, fundo transparente).
- [ ] Trocar o **texto provisório da história** da empresa, nos dois idiomas (`apps/web/src/i18n/messages/en.ts` e `pt.ts`).
- [ ] Cadastrar os **produtos e fotos reais** (os atuais são de demonstração) e configurar o **número de WhatsApp** em *Configurações*.
- [ ] **Publicar na Vercel** (site e API), com banco Postgres em produção, variáveis de ambiente e `npm run db:deploy` (o passo a passo está no `README.md`; atenção ao aviso sobre a migração das fotos).
- [ ] Rodapé com **dados da empresa** (razão social, CNPJ, contato) e **política de privacidade** (LGPD).
- [ ] Nome, descrição e categoria dos produtos hoje aparecem no idioma em que foram digitados; permitir **tradução por produto** (PT/EN).
- [ ] Ativar **backup do banco** no provedor e um pipeline de CI (`npm audit` + `npm run test:security` em ambiente de teste).
- [ ] Riscos de segurança **aceitos** que valem revisão futura: CSP com `'unsafe-inline'`, sessão fixa de 60 dias, alertas do `npm audit` no CLI do Prisma (detalhes em `README.md`).
