# TODO — o que ainda está pendente

Lista do que ainda **não foi feito**. Marque `[x]` quando concluir.

> **Atualização:** os itens 1 a 4 abaixo foram **implementados** (mensagem com origem + código Ref em EN/PT/ES, contador de cliques, vendas com estoque, clientes e painel financeiro). O que sobrou está indicado como pendente. Detalhes no `README.md` (seção *Vendas, estoque, clientes e financeiro*).
>
> **Atualização (30/09):** SMS e e-mail como contato alternativo ao WhatsApp foram **implementados** (produto e catálogo, com mensagem pronta no idioma da página; número/e-mail configuráveis em *Configurações*, cada um opcional e oculto se vazio). Não entram no contador de cliques nem no funil do Financeiro (item 2) — isso segue pendente caso se queira estender.
>
> **Atualização (30/09, 2):** o texto das mensagens de WhatsApp, SMS e e-mail agora é **editável pelo admin** em *Configurações*, separadamente por idioma (en/pt/es), com prévia ao vivo e opção de voltar ao padrão. Veja `apps/api/src/settings/settings.service.ts` (`normalizeTemplates`) e `apps/web/src/i18n/templates.ts`.
>
> **Atualização (01/10):** cinco funcionalidades sugeridas foram **implementadas**: (1) **código QR por produto** — no formulário do produto, gera um QR que aponta para `/q/<slug>`; a cada escaneada, redireciona para o WhatsApp com mensagem pronta e conta o clique (origem "QR_CODE") junto com os demais no Financeiro; (2) **histórico de atividade** ("quem mexeu em quê") em *Equipe*, com tudo que é criado/editado/excluído no painel; (3) **duplicar produto**, para cristais com variações de tamanho/cor; (4) **aviso de estoque baixo** na Visão Geral; (5) **"encerrar todas as sessões"** na tela de segurança, para o caso de perda do aparelho.

---

## 1. Mensagem automática do WhatsApp com a origem do cliente

**Objetivo:** quando o cliente clica em qualquer botão de WhatsApp, a conversa abre com uma mensagem pronta que diz **de onde ele veio** (por exemplo: "Vim pelo site, pela página do produto X" ou "pelo botão do menu"). A mensagem muda conforme o idioma da versão que ele está usando (inglês ou português).

**Como está hoje:** já existe uma mensagem pronta em cada idioma (`whatsapp.general` e `whatsapp.product` em `apps/web/src/i18n/messages/en.ts` e `pt.ts`). A geral diz que a pessoa veio pelo site; a do produto traz nome, valor e link da peça. **Ainda não diz de qual lugar do site o clique saiu** e o texto não é editável pelo admin.

- [x] Incluir a **origem do clique** na mensagem: botão do menu, botão flutuante, rodapé, hero da home, página de catálogo, cartão do produto, página do produto.
- [x] Manter a mensagem **em inglês na versão inglesa e em português na versão `/pt`** (as duas já são carregadas pelos dicionários; acrescentar as variações por origem).
- [x] Exemplo de texto (PT): `Olá! Vim pelo site da Abasse Crystal (página: Coleção). Gostaria de saber mais.` / (EN): `Hello! I found you on the Abasse Crystal website (page: Collection). I'd like to know more.`
- [x] Incluir um **código de referência curto** na mensagem (ex.: `Ref: A7K2`) para o admin conseguir relacionar a conversa com o clique registrado (ver item 2).
- [x] Deixar o admin **editar o texto da mensagem** em *Configurações*, nos três idiomas (en/pt/es) — WhatsApp, SMS e e-mail, com prévia ao vivo.

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
- [x] **Exportação** (CSV/Excel) das vendas e filtro por período/categoria (botões em *Vendas*; o Excel tem as abas Vendas e Itens).
  - Plano: `GET /admin/sales/export?format=csv&...` reaproveitando os mesmos filtros da listagem; gera o CSV no servidor (dados já estão ali, sem N+1) e o navegador baixa via link/blob. Simples de fazer; Excel real (.xlsx) só se CSV não bastar.
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
- [x] **Exportação** dos números do financeiro (CSV/PDF), no período e na moeda mostrados na tela.
  - Plano: CSV é direto (mesma ideia do item de vendas, com as linhas da série + resumo). PDF exige gerar um layout (ex. `@react-pdf/renderer` ou puppeteer no servidor) — mais trabalho; sugiro começar só com CSV.
- [x] Seguir o mesmo visual do painel atual (azul marinho + dourado) (painel só em português, por decisão do cliente).

---

## Novos pendentes (surgiram com as vendas e o espanhol)

- [x] **Moeda:** o dólar (US$) é a moeda principal e tudo é guardado em dólar; o site em português converte para reais pela cotação do dia (PTAX do Banco Central, com AwesomeAPI de reserva). A venda pode ser registrada como paga em reais (guarda os reais recebidos e a cotação). Só dólar e real; outras moedas não estão previstas.
- [x] **Tradução por produto** (nome, descrição e categoria em en/pt/es), em *Editar produto → Traduções*; em branco usa o texto original.
- [ ] Revisão do texto em espanhol por um falante nativo.
- [x] Política de privacidade e aviso sobre o contador de cliques (LGPD/GDPR): página `/privacy` nos três idiomas, com link no rodapé. Alinhada ao texto da Lei 13.709/2018 (arts. 6–9, 14, 16, 18–19, 33, 41 e 48: direitos I–IX, prazos, encarregado/canal, crianças, incidentes). **Falta** um advogado revisar o texto e a empresa preencher os dados (`NEXT_PUBLIC_LEGAL_*`, incluindo o encarregado `_DPO_NAME/_EMAIL`, opcional para agentes de pequeno porte, Res. CD/ANPD nº 2/2022).

---

## 5. Perfis de acesso e primeiro login (a fazer)

- [ ] **Novo perfil `SUPORTE`**: enxerga o painel inteiro (visão geral), mas com edição limitada.
  - Pode **editar, criar e excluir contas** (usuários do painel).
  - **Não pode** mexer em inventário (produtos, estoque, fotos, traduções), valores (preços, vendas, financeiro) nem nas demais configurações do negócio; essas telas ficam só para leitura.
  - A regra tem de valer **na API** (guardas por perfil em cada rota de escrita), não só escondendo botões no painel; incluir testes na suíte de segurança (`apps/api/test/security.mjs`) para provar que o suporte recebe 403 ao tentar alterar produtos, vendas, finanças e configurações, e que as exportações continuam só para quem for autorizado.
  - O suporte **pode redefinir a senha do admin** (por exemplo, quando o dono perde o acesso). Como isso dá ao suporte uma porta para assumir a conta, a redefinição deve: gerar/aceitar uma senha provisória e ligar `mustChangePassword` (o admin é obrigado a trocá-la no próximo login), encerrar todas as sessões ativas dessa conta, ficar registrada no histórico de atividade (quem redefiniu e de quem) e ter limite de tentativas. Avaliar também avisar o e-mail do admin quando a senha for redefinida.
  - Demais proteções nas contas: o suporte não promove ninguém (nem a si mesmo) a admin, não exclui contas de admin e não exclui a própria conta; tudo registrado no histórico de atividade.
- [ ] **Troca de senha obrigatória no primeiro login** da primeira conta de admin (a senha inicial é gerada pelo dono): ao entrar pela primeira vez, o painel só libera depois de definir uma nova senha, digitada duas vezes para confirmar.
  - A nova senha tem de ser diferente da inicial e seguir a regra de força já usada; a confirmação precisa ser igual.
  - Enquanto a troca não for feita, a API deve **recusar** qualquer outra rota do painel (não basta redirecionar no front); guardar um indicador `mustChangePassword` na conta, que a troca desliga, encerrando as outras sessões.
  - O mesmo indicador pode servir para contas novas criadas pelo suporte/admin (senha provisória).
- [ ] **Recuperação de senha por e-mail** (EmailJS, plano gratuito), **só para o admin**:
  - No **primeiro login do admin**, na mesma tela da troca obrigatória de senha, ele cadastra **dois e-mails de recuperação diferentes** (validar formato e exigir que sejam distintos).
  - Em "Esqueci a senha", o link de redefinição vai **primeiro para o e-mail 1**; se o admin quiser (por exemplo, perdeu o acesso ao primeiro), ele escolhe **enviar também para o e-mail 2**.
  - Os dois e-mails podem ser **editados depois**, em *Configurações → Conta*, exigindo a senha atual (ou a recuperação em andamento) para alterar.
  - Segurança: link com token aleatório, **de uso único e curto prazo** (ex. 30 min), guardado só como hash no banco; resposta idêntica exista ou não a conta (sem revelar se o usuário existe); limite de pedidos por IP e por conta; ao concluir a redefinição, encerrar todas as sessões ativas da conta; registrar no histórico de atividade; avisar nos dois e-mails quando a senha for trocada ou quando os e-mails de recuperação forem editados.
  - Conferir antes de implementar: o EmailJS foi pensado para envio pelo navegador. Chamá-lo pela API (servidor) exige ativar *Allow EmailJS API for non-browser applications* na conta e usar a chave privada, e é preciso confirmar se o plano gratuito permite isso. O plano gratuito também tem cota mensal baixa (na casa de 200 e-mails/mês) e um único serviço de envio conectado. Se não servir, a alternativa é um SMTP gratuito (ex. Resend ou Brevo) no lugar. Nunca disparar o e-mail direto do navegador, senão o link de redefinição ficaria exposto.
  - O SUPORTE (item acima) **não** usa esse fluxo: a senha dele é redefinida por um admin; e a recuperação do admin continua podendo ser feita pelo suporte, conforme definido acima.

---

## Também pendente (já identificado antes, fora do que foi pedido agora)

Estes itens não foram pedidos agora; estão aqui só para não se perderem.

- [ ] Substituir a **logo provisória** (`apps/web/public/logo.svg`) pela logo oficial do cliente (SVG ou PNG grande, fundo transparente).
- [ ] Trocar o **texto provisório da história** da empresa, nos dois idiomas (`apps/web/src/i18n/messages/en.ts` e `pt.ts`).
- [ ] Cadastrar os **produtos e fotos reais** (os atuais são de demonstração) e configurar o **número de WhatsApp** em *Configurações*.
- [ ] **Publicar na Vercel** (site e API), com banco Postgres em produção, variáveis de ambiente e `npm run db:deploy` (o passo a passo está no `README.md`; atenção ao aviso sobre a migração das fotos).
- [x] Rodapé com **dados da empresa** e **política de privacidade**: o rodapé já mostra a linha da empresa quando `NEXT_PUBLIC_LEGAL_NAME/CNPJ/ADDRESS` estão preenchidas. **Falta** preencher os dados reais.
- [x] Tradução por produto (en/pt/es) — feito (ver o item acima).
- [x] Pipeline de CI (typecheck, lint, testes de unidade, build e a suíte de segurança a cada push) — `.github/workflows/ci.yml`.
- [ ] Ativar **backup do banco** no provedor e, no GitHub, uma regra de proteção da `main` exigindo os dois trabalhos do CI.
- [ ] Riscos de segurança **aceitos** que valem revisão futura: CSP com `'unsafe-inline'`, sessão fixa de 60 dias, alertas do `npm audit` no CLI do Prisma (detalhes em `README.md`).
- [x] **Conferir a responsividade geral** (site público e painel admin) em celular, tablet e telas grandes — feito: 76 telas em 4 tamanhos (375, 768, 1280 e 1920 px), sem rolagem horizontal; ajustes de menu, filtros de categoria, listas e áreas de toque.
