# Abasse Crystal

Site de catálogo de cristais: o cliente escolhe a peça e é levado ao **WhatsApp** com a mensagem pronta (não há carrinho nem pagamento no site). O admin cadastra produtos, fotos, descrição e valor num painel protegido.

- **`apps/web`** — Next.js 15 (App Router) + React 19 + Tailwind 4 + Motion + three.js (cristal 3D interativo na home)
- **`apps/api`** — NestJS 11 + Prisma + PostgreSQL (as **fotos dos produtos ficam no próprio banco**, como bytes)
- Tudo em TypeScript, deploy na Vercel como **dois projetos** (web e api).

O navegador só conversa com o próprio site: o Next repassa `/api/*` para o NestJS. Assim o cookie de sessão do admin é *same-origin* (`HttpOnly`, `Secure`, `SameSite=Lax`), sem CORS.

## Acesso ao painel admin

- O login **não** fica em `/admin`. Ele abre num endereço secreto: **`https://seu-site/<ADMIN_LOGIN_TOKEN>`** (em português: `/pt/<ADMIN_LOGIN_TOKEN>`).
- `/admin` (e qualquer subpágina) sem sessão responde **404**, sem revelar que o painel existe.
- Depois de logar, o admin vai para `/admin`. A sessão dura **60 dias** no mesmo computador (cookie persistente).
- Usuário padrão: `admin` (criado pelo seed). A senha inicial é **temporária**: no primeiro login o sistema obriga a criar uma senha nova (mín. 12 caracteres, maiúscula, minúscula e número) antes de liberar qualquer outra tela.
- Para trocar o endereço secreto: mude `ADMIN_LOGIN_TOKEN` e faça novo deploy do web.
- **Telas do painel** (`/admin`): *Visão geral* (números animados, situação do catálogo, categorias), *Vendas*, *Clientes*, *Financeiro*, *Produtos* (grade/lista, abas por situação, arrastar para reordenar fotos, pré-visualização ao vivo), *Equipe*, *Configurações* e *Alterar senha*. `Ctrl/⌘ + K` abre a paleta de comandos (ir para qualquer tela, buscar produto).
- **WhatsApp do site** (*Configurações*): o admin cola o número (com código do país) ou um link `wa.me` e **todos os botões do site** passam a usar esse número na hora. Só os dígitos são salvos (o link `wa.me` é montado pelo site), então ninguém consegue colocar uma URL arbitrária atrás dos botões. A variável `NEXT_PUBLIC_WHATSAPP_NUMBER` vira apenas o valor padrão enquanto nada foi configurado.
- **SMS e e-mail** (*Configurações*): opcionais, além do WhatsApp. Se o admin cadastrar um número de SMS e/ou um e-mail de contato, cada página de produto (e o card no catálogo) ganha um botão "Enviar SMS"/"Enviar e-mail" que abre o app de mensagens ou o cliente de e-mail do visitante com o nome do produto, valor e link **já preenchidos**, no idioma da página. Deixe em branco para ocultar o botão — o WhatsApp continua funcionando normalmente mesmo sem os dois. Esses links não passam por rastreamento de cliques (só o WhatsApp registra clique/Ref) nem exigem token de terceiros: são apenas `sms:` e `mailto:` montados no navegador do visitante.
- **Mensagens personalizadas** (*Configurações*): o texto que abre pronto no WhatsApp, SMS e e-mail (mensagem geral, mensagem de produto, assunto e corpo do e-mail) pode ser editado pelo admin, **separadamente em inglês, português e espanhol**. Cada campo mostra o texto padrão como exemplo e uma prévia ao vivo com um produto fictício; deixar em branco volta a usar o texto padrão do site. A mudança vale para o site inteiro na hora de salvar.
- **Equipe** (*Equipe*): qualquer admin pode criar outras contas de admin (mesmas permissões). O sistema gera uma **senha temporária mostrada uma única vez** (com o endereço de login para copiar); a pessoa é obrigada a trocá-la no primeiro acesso. Também é possível **redefinir a senha** (derruba as sessões da pessoa) e **remover** um admin (não dá para remover a si mesmo nem o último admin). Criar, remover e redefinir senha exigem **digitar novamente a sua própria senha** (reautenticação), porque a sessão dura 60 dias.
- Esqueceu a senha? `ADMIN_USERNAME=admin npm run admin:reset` (com `DATABASE_URL` de produção) gera uma nova senha temporária, destrava a conta e derruba sessões.

## Vendas, estoque, clientes e financeiro

Além do catálogo, o painel controla o negócio (tudo **só para admin logado**; valores calculados **no servidor**, em centavos inteiros):

- **Venda por peça ou por quilo.** No produto (*Venda e estoque*): modo *por peça* (preço e estoque em unidades) ou *por quilo* (preço por kg, estoque em kg/gramas). O **custo** é opcional e **nunca aparece no site público**.
- **Vendas** (`/admin/sales`): registra pedra(s), quantidade ou peso, valor, desconto, frete, forma de pagamento, método de envio, código de rastreio, situação (pendente → paga → enviada → entregue / cancelada), data, cliente, endereço de entrega (**qualquer país**) e **foto opcional** da pedra. Cada venda guarda uma cópia do nome/preço/endereço da época. Registrar baixa o estoque sozinho (com trava de linha: duas vendas simultâneas nunca vendem a mesma peça duas vezes) e **cancelar devolve o estoque** uma única vez. Venda cancelada não reabre.
- **Clientes** (`/admin/customers`): contato, endereço e **histórico de tudo o que cada um comprou**. Há botão de **apagar dados pessoais** (LGPD/GDPR), que pede a senha do admin e mantém as vendas no financeiro de forma anônima.
- **Financeiro** (`/admin/finance`): faturamento (7/30/90 dias, 1 ano, tudo) com gráfico, comparação com o período anterior, ticket médio, peças e peso vendidos, lucro e margem (quando há custo cadastrado), categorias, pedras mais vendidas, países, formas de pagamento e o **funil** cliques no WhatsApp → conversas confirmadas → vendas. Faturamento conta vendas *paga, enviada e entregue*; datas seguem o horário de Brasília.
- **Cliques no WhatsApp:** todo botão de WhatsApp do site registra um clique **anônimo** (sem IP, sem user-agent) e acrescenta à mensagem uma linha `Ref: K7M2QX · Enviado de: página do produto` (no idioma da versão). **O site só consegue contar o clique**: depois que o WhatsApp abre, ele não sabe se a mensagem foi enviada. O admin confirma a conversa digitando o código *Ref* no Financeiro, ou informando o código ao registrar a venda (a conversa é confirmada automaticamente e a venda fica ligada à origem). Para saber automaticamente quando a mensagem chegou, seria preciso a API oficial do WhatsApp Business.
- **Envio para o mundo todo:** aviso na home, no hero, no rodapé e na página do produto. Os preços continuam em reais (R$).

## Idiomas (inglês, português e espanhol)

- **Inglês é o idioma principal** e não tem prefixo na URL (`/`, `/products`). O **português** fica sob `/pt` e o **espanhol** sob `/es` (`/pt/products`, `/es/products`). Cada idioma tem URL própria, `hreflang` e entradas no `sitemap.xml`.
- O botão **EN | PT | ES** (topo e rodapé do site) troca o idioma **sem recarregar a página**: navegação do lado do cliente, mantendo rolagem, filtros (`?category=…`) e `#âncora`. A escolha é lembrada no cookie `NEXT_LOCALE`; quem já escolheu português e abre uma URL sem prefixo é levado ao `/pt` correspondente.
- O **site público** fica em **`en.ts`**, **`pt.ts`** e **`es.ts`** (`apps/web/src/i18n/messages/`); `pt.ts` e `es.ts` são tipados pelo `en.ts` (se faltar uma chave, o TypeScript avisa). O **painel admin é só em português** (`admin.ts`), porque o administrador é brasileiro; ele ignora o prefixo de idioma da URL. Para um novo idioma, crie o dicionário e inclua-o em `src/i18n/config.ts`.
- A API responde erros em inglês com um `code` estável (ex.: `INVALID_CREDENTIALS`); o painel traduz pelo `code`.
- Rotas: `/products`, `/products/<slug>`, `/admin`, `/admin/products/new`, `/admin/sales`, `/admin/customers`, `/admin/finance`, `/admin/change-password` (mesmos caminhos em todos os idiomas, mais o prefixo `/pt` ou `/es`).
- **Nome, descrição e categoria dos produtos** são digitados pelo admin em um único idioma e aparecem iguais nas duas versões do site; só a interface é traduzida.
- Valores continuam em **reais (R$)**; só o formato muda (`R$ 159,90` em português/espanhol, `R$159.90` em inglês).

## Rodando localmente

Pré-requisitos: Node 20+ e Docker (ou qualquer Postgres).

```bash
npm install
npm run db:up            # Postgres local (docker compose)
```

Crie os arquivos de ambiente a partir dos exemplos:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

Gere o `ADMIN_LOGIN_TOKEN` e o `JWT_SECRET`, e defina `NEXT_PUBLIC_WHATSAPP_NUMBER` em `apps/web/.env.local`. **O mesmo `ADMIN_LOGIN_TOKEN` precisa estar em `apps/web/.env.local` e em `apps/api/.env`** (a API só aceita login de quem conhece o endereço secreto):

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"   # ADMIN_LOGIN_TOKEN
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"   # JWT_SECRET
```

Depois:

```bash
npm run db:deploy        # aplica as migrations
npm run db:seed          # cria o admin. Senha inicial: ADMIN_INITIAL_PASSWORD, ou uma senha aleatória exibida UMA vez (não existe senha padrão)
npm run dev:api          # http://localhost:4000
npm run dev:web          # http://localhost:3000  → login em http://localhost:3000/<ADMIN_LOGIN_TOKEN>
```

### Fotos no banco de dados

As fotos são gravadas como **bytes** (`bytea`) na tabela `ProductImage` e servidas por `GET /images/:id` (no site: `/api/images/<id>`), com `Content-Type` fixo (JPG/PNG/WebP), `nosniff` e cache imutável de 1 ano; o otimizador do Next redimensiona e converte para AVIF/WebP. Não há Vercel Blob nem pasta de uploads. Excluir um produto apaga as fotos junto (`ON DELETE CASCADE`). Cada foto tem no máximo 4 MB (o navegador já comprime antes de enviar) e cada produto até 10 fotos. Planeje o tamanho do banco: 100 produtos × 5 fotos × ~0,5 MB ≈ 250 MB (o plano gratuito do Neon tem 0,5 GB).

> ⚠️ **A migration `20260925120000_store_images_in_db` APAGA todas as linhas de `ProductImage`** (fotos que estavam em outro armazenamento não podem ser convertidas em bytes) e remove a coluna `url`. Se você já tinha um banco com fotos enviadas antes desta versão, **não aplique em produção sem antes exportar as fotos** e reenviá-las pelo painel depois. Em um banco novo não há impacto.

## Deploy na Vercel

Crie **dois projetos** a partir deste mesmo repositório.

### 1) API (`apps/api`)
- *Root Directory*: `apps/api` (framework NestJS é detectado).
- Banco: adicione **Neon Postgres** pelo Vercel Marketplace (ou outro Postgres). As fotos ficam no próprio Postgres, então **não é preciso Vercel Blob**.
- Variáveis:

| Variável | Valor |
|---|---|
| `DATABASE_URL` | conexão *pooled* |
| `DIRECT_URL` | conexão direta (usada nas migrations) |
| `JWT_SECRET` | 48+ caracteres aleatórios (obrigatório; placeholders são rejeitados e a API não sobe) |
| `ADMIN_LOGIN_TOKEN` | **o mesmo token do site.** Sem ele o login fica desativado |
| `TRUST_PROXY_HOPS` | `1` (a API fica atrás da Vercel; nunca use um valor maior que o real) |
| `ADMIN_USERNAME` | `admin` |
| `ADMIN_INITIAL_PASSWORD` | senha temporária (opcional; será trocada no 1º login) |
| `WEB_ORIGIN` | URL do site, ex. `https://abassecrystal.com.br` |

- Uma vez, com as variáveis de produção no seu terminal: `npm run db:deploy` e `npm run db:seed` (o script `vercel-build` também roda `prisma migrate deploy` no build).

### 2) Web (`apps/web`)
- *Root Directory*: `apps/web`.
- Variáveis (todas precisam existir **antes** do build):

| Variável | Valor |
|---|---|
| `API_URL` | URL do projeto da API |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | só dígitos com país+DDD, ex. `5511999999999` |
| `NEXT_PUBLIC_SITE_URL` | URL pública do site |
| `ADMIN_LOGIN_TOKEN` | o token secreto do login |
| `NEXT_PUBLIC_LEGAL_NAME` | (opcional) razão social, mostrada no rodapé e na política de privacidade |
| `NEXT_PUBLIC_LEGAL_CNPJ` | (opcional) CNPJ, ex. `00.000.000/0001-00` |
| `NEXT_PUBLIC_LEGAL_ADDRESS` | (opcional) endereço da empresa |

### 3) Depois de publicar — checklist

1. Banco de produção com **backup automático** ativado no provedor (Neon: *Backups / Branches*).
2. `npm run db:deploy` e `npm run db:seed` (uma vez) e **troque a senha** do admin no primeiro login. O endereço secreto do login é `SEU-SITE/<ADMIN_LOGIN_TOKEN>`.
3. Em *Configurações* do painel: número de **WhatsApp**, SMS e e-mail de contato (o e-mail aparece como canal de privacidade na política).
4. Abra `<URL da API>/health` (deve responder `{"status":"ok"}`) e `<URL da API>/fx/usd-brl` (deve devolver a cotação; a API precisa de acesso de saída à internet para consultar o Banco Central). Abra `/pt` no site: os preços saem em reais e o canto superior direito mostra o dólar.
5. Preencha as variáveis `NEXT_PUBLIC_LEGAL_*` (razão social, CNPJ, endereço) e **peça a um advogado para revisar** a política de privacidade em `/privacy` (o texto descreve o que o site faz hoje).
6. Cadastre os produtos reais e fotos; troque a logo (`apps/web/public/logo.svg`) e o texto da história (`apps/web/src/i18n/messages`).
7. No GitHub: confira o resultado do CI na aba *Actions* e, em *Settings → Branches*, proteja a `main` exigindo os dois trabalhos do CI.
8. Teste o fluxo completo: catálogo → botão de WhatsApp → registrar a venda no painel → financeiro → exportar.

## Personalização

- **Logo**: substitua `apps/web/public/logo.svg` (proporção ~4:1, versão clara, fundo transparente) e o ícone `apps/web/src/app/icon.svg`. O componente é `src/components/Logo.tsx`.
- **Textos** (história, "como comprar", nomes na faixa animada, botões): `apps/web/src/i18n/messages/en.ts`, `pt.ts` e `es.ts`; painel em `admin.ts`. **O texto da história é provisório** — troque pelo real nos três idiomas. Nome da marca, URL, WhatsApp e Instagram: `apps/web/src/content/site.ts`.
- **Cores**: tokens em `apps/web/src/app/globals.css` (`@theme`).
- **Tipos de cristal do 3D da home**: cores em `CRYSTAL_VARIANTS` (`src/components/CrystalScene.tsx`) e nomes em `home.hero.variants` nos dicionários.

## Moeda, cotação, traduções e exportações

**Moeda.** Todo valor é guardado em **dólares americanos** (centavos): preço e custo do produto, vendas e financeiro. O dólar é a moeda principal; o site em inglês e em espanhol mostra dólares. No site em **português** os preços são convertidos para reais pela cotação do dia, com uma nota no rodapé e na página do produto ("US$ 1 = R$ 5,08, cotação oficial do Banco Central de 16/10"). Se não houver nenhuma cotação disponível, o site em português continua mostrando dólares.

**Cotação (USD→BRL).** `GET /fx/usd-brl` (API). Fonte principal: **PTAX do Banco Central** (oficial, taxa de venda). Reserva automática: **AwesomeAPI** (cotação de mercado), usada se o BC estiver fora do ar, responder lixo ou variar mais de 15% de uma leitura para a outra. Cada atualização fica gravada no banco (`ExchangeRate`), então a última cotação conhecida sobrevive a qualquer queda; ela é renovada sozinha, no máximo uma vez por hora, e é marcada como "antiga" depois de 48 h sem renovar. O site guarda a cotação em cache por 1 hora.

**Painel.** Preços, custos, vendas e financeiro aparecem em dólar ("US$ 1.299,00"). No financeiro há uma chave **US$ / R$** que mostra os mesmos números convertidos. Ao registrar uma venda, "Pago em" pode ser **Real (R$)**: o total continua em dólar e a venda guarda também os reais recebidos (ou o valor negociado que você digitar) e a cotação usada.

**Traduções por produto.** Em *Editar produto → Traduções* dá para preencher nome, descrição e categoria em inglês, português e espanhol. O que ficar em branco usa o texto original (o digitado em "Dados do cristal"). A busca do site procura no texto original; o filtro de categoria usa sempre o nome original, mesmo mostrando o nome traduzido.

**Exportações.**
- **Vendas** (*Vendas → Exportar CSV / Exportar Excel*): respeitam os filtros da tela (situação, busca, **período** e **categoria**). O Excel traz duas abas, *Vendas* (uma linha por venda) e *Itens* (uma linha por peça vendida). Limite de 20.000 vendas por arquivo.
- **Financeiro** (*Financeiro → Exportar CSV / Exportar PDF*): o período e a moeda (US$ ou R$) que estão na tela. Em reais, o arquivo informa a cotação usada, a fonte e a data.
- O CSV usa UTF-8 com BOM, ";" como separador e vírgula decimal (abre direto no Excel em português); texto que começa com `=`, `+`, `-` ou `@` é protegido contra fórmulas.

**Atualizando um banco antigo.** Antes desta versão os valores eram guardados em reais. Um banco que já tenha produtos e vendas em reais precisa ser convertido (dividir preços, custos e valores de venda pela cotação) antes de usar esta versão; o projeto ainda não tinha dados reais, só os de demonstração (`npm run db:seed-demo -w apps/api -- --reset` recria tudo já em dólar).

## Segurança

Uma revisão de segurança completa foi feita e os testes de regressão ficam em `apps/api/test/security.mjs`:

```bash
# com a API e o Postgres locais no ar (a suíte recusa rodar fora de localhost: cria/apaga produtos e pode travar o admin)
ADMIN_TEST_PASSWORD='<senha permanente do admin local>' npm run test:security -w apps/api
```

Sem `ADMIN_TEST_PASSWORD` roda só a parte sem autenticação; com `ADMIN_TEMP_PASSWORD` (após `admin:reset`) também testa o primeiro login forçado; `TEST_LOCKOUT=1` testa o bloqueio por força bruta.

### Integração contínua (CI)

O workflow `.github/workflows/ci.yml` roda sozinho no GitHub a cada push na `main` e a cada pull request, em dois trabalhos independentes:

1. **Typecheck, lint, unit tests, build** — `tsc`, ESLint, Vitest e o build da API e do site.
2. **Security / integration suite** — sobe um Postgres descartável, aplica as migrations, inicia a API e o site e roda `apps/api/test/security.mjs` inteira (inclui a checagem de que `/admin` e suas variações codificadas respondem 404). Leva alguns minutos porque a suíte espera a janela do limite de login.

Não usa nenhum segredo do repositório: a chave JWT, o token de login e as senhas do teste são gerados a cada execução. Resultado em **Actions** no GitHub; para que um vermelho **impeça** o merge, ative em *Settings → Branches* uma regra de proteção exigindo os dois trabalhos. Para reproduzir localmente o primeiro trabalho: `npm run typecheck`, `npm run lint` e `npm test` dentro de cada app (`-w apps/api` / `-w apps/web`).

**Autenticação e sessão**
- Senhas com bcrypt (custo 12); limite de 72 **bytes** validado (bcrypt truncaria em silêncio). Troca da senha inicial imposta **no servidor**: todas as rotas do admin retornam 403 até a troca. Não existe senha padrão: sem `ADMIN_INITIAL_PASSWORD` o seed gera uma aleatória.
- **O login só é aceito com o token do endereço secreto** (cabeçalho `X-Admin-Login-Token`, comparado em tempo constante). Quem não o conhece recebe 404 num *middleware* que roda antes de tudo (antes do rate limit e do banco): não dá para fazer força bruta, travar a conta nem esgotar o limite de tentativas do admin com requisições sem token.
- Sessão JWT (HS256 fixo, `iss`/`aud` validados, 60 dias) em cookie `HttpOnly`/`Secure`/`SameSite=Lax` (`__Host-` em produção). A cada requisição o servidor confere o banco: trocar a senha **ou sair (logout) revoga a sessão no servidor** — um cookie roubado deixa de funcionar.
- Bloqueio por conta após 5 tentativas erradas (15 min), rate limit por IP com `trust proxy` de saltos fixos (nunca `true`), erro idêntico para usuário inexistente e senha errada, hash falso para igualar o tempo de resposta.
- `JWT_SECRET` obrigatório e validado em produção; em desenvolvimento sem segredo, a API usa um segredo aleatório por processo (nunca um valor fixo).

**Requisições e dados**
- CSRF: `SameSite` + checagem de `Origin` em métodos que alteram dados. Validação com `class-validator` (`whitelist` + `forbidNonWhitelisted`, sem mass assignment). Prisma parametrizado, sem SQL bruto com entrada do usuário (o único `$queryRaw` usa parâmetros).
- Upload: formato validado pelos **bytes reais** (só JPG/PNG/WebP; SVG/GIF/HTML são recusados), 4 MB, 10 fotos por produto (com trava de linha para valer sob concorrência), nome sempre gerado pelo servidor. Fotos servidas com `Content-Type` fixo, `nosniff` e CSP `sandbox`. **Fotos de produtos ocultos (`HIDDEN`) só são entregues ao admin logado** (e nunca ficam em cache compartilhado); as demais têm cache público de 1 dia.
- Respostas de `/admin/*` e `/auth/*` saem com `Cache-Control: no-store`. As rotas do admin não usam rate limit por IP (atrás do proxy da Vercel todos compartilhariam o mesmo IP e um estranho poderia bloquear o admin); elas exigem sessão e a senha é protegida pelo bloqueio por conta.
- `revalidateCatalog` (Server Action) exige sessão de admin válida (senão qualquer um poderia esvaziar o cache do site em loop).

**Vendas, clientes e cliques**
- Todas as rotas `/admin/sales`, `/admin/customers`, `/admin/finance` e `/admin/analytics` exigem sessão; validação estrita (sem mass assignment), limites de valor/quantidade, estoque nunca fica negativo (`SELECT … FOR UPDATE`), fotos de venda só para admin e com validação por bytes.
- O contador `POST /track/click` é público, mas só aceita código/origem/idioma no formato esperado, tem limite por IP, exige `Origin` do site, não grava IP nem user-agent e ignora repetições do mesmo código.
- Apagar dados pessoais de um cliente exige a senha do admin.
- A busca escapa a barra invertida (sem isso o Postgres devolvia erro 500 com `LIKE` terminado em escape).

**Navegador**
- Cabeçalhos: CSP, HSTS, `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `Referrer-Policy`, `Permissions-Policy`, COOP. `/admin` responde `Cache-Control: no-store`.

**Infra**
- O Postgres do `docker-compose` escuta só em `127.0.0.1`. O `.env` e os segredos ficam fora do Git.

## Observações

- O limite de corpo das funções da Vercel é ~4,5 MB; por isso cada foto é enviada em uma requisição separada.
- **Riscos conhecidos/aceitos:** (1) o CSP usa `'unsafe-inline'` em scripts porque o Next injeta scripts de hidratação e um CSP com *nonce* desligaria o cache/ISR; (2) o URL secreto do login aparece nos logs de acesso da hospedagem e no histórico do navegador; (3) `npm audit` aponta 3 alertas na cadeia do CLI do Prisma (`deepmerge-ts`), que só roda em build e não recebe entrada de usuários; (4) a sessão de 60 dias é absoluta (sem renovação deslizante); (5) o *middleware* do Next que decide se mostra 404 ou o painel confere só a **presença** de um cookie com o nome certo, não sua validade — qualquer cookie forjado/expirado já basta para passar dali, mas nenhum dado real é exposto, porque toda chamada de API exige uma sessão válida de verdade (`AdminGuard`, checado no servidor a cada requisição). (6) os endpoints públicos que registram cliques do WhatsApp (`POST /track/click` e o redirecionamento do QR em `/q/<slug>`) gravam uma linha por chamada e **não têm política de retenção**; o limite por IP é em memória (por instância) e o `/q/` chama a API a partir do servidor do site, então os escaneamentos dividem o mesmo balde. Quem quiser pode inflar a tabela e distorcer o funil de *Cliques* (não há dado pessoal envolvido, então não há risco de LGPD). Aceito enquanto o volume for pequeno; se crescer, apagar cliques antigos (por exemplo, com mais de 18 meses) e/ou limitar por produto.
- O contador do rate limit é por instância (serverless); a proteção principal do login é o bloqueio por conta no banco.
- Um bloqueio por conta significa que alguém que descubra o endereço do login poderia travar o admin por 15 min com tentativas erradas; o `admin:reset` também destrava.
