# Abasse Crystal

Site de catálogo de cristais: o cliente escolhe a peça e é levado ao **WhatsApp** com a mensagem pronta (não há carrinho nem pagamento no site). O admin cadastra produtos, fotos, descrição e valor num painel protegido.

- **`apps/web`** — Next.js 15 (App Router) + React 19 + Tailwind 4 + Motion + three.js (cristal 3D interativo na home)
- **`apps/api`** — NestJS 11 + Prisma + PostgreSQL + Vercel Blob (imagens)
- Tudo em TypeScript, deploy na Vercel como **dois projetos** (web e api).

O navegador só conversa com o próprio site: o Next repassa `/api/*` para o NestJS. Assim o cookie de sessão do admin é *same-origin* (`HttpOnly`, `Secure`, `SameSite=Lax`), sem CORS.

## Acesso ao painel admin

- O login **não** fica em `/admin`. Ele abre num endereço secreto: **`https://seu-site/<ADMIN_LOGIN_TOKEN>`** (em português: `/pt/<ADMIN_LOGIN_TOKEN>`).
- `/admin` (e qualquer subpágina) sem sessão responde **404**, sem revelar que o painel existe.
- Depois de logar, o admin vai para `/admin`. A sessão dura **60 dias** no mesmo computador (cookie persistente).
- Usuário padrão: `admin` (criado pelo seed). A senha inicial é **temporária**: no primeiro login o sistema obriga a criar uma senha nova (mín. 12 caracteres, maiúscula, minúscula e número) antes de liberar qualquer outra tela.
- Para trocar o endereço secreto: mude `ADMIN_LOGIN_TOKEN` e faça novo deploy do web.
- Esqueceu a senha? `ADMIN_USERNAME=admin npm run admin:reset` (com `DATABASE_URL` de produção) gera uma nova senha temporária, destrava a conta e derruba sessões.

## Idiomas (inglês principal + português)

- **Inglês é o idioma principal** e não tem prefixo na URL (`/`, `/products`). O **português** fica sob `/pt` (`/pt`, `/pt/products`). Cada idioma tem URL própria, `hreflang` e entradas no `sitemap.xml`.
- O botão **EN | PT** (topo, rodapé e painel admin) troca o idioma **sem recarregar a página**: navegação do lado do cliente, mantendo rolagem, filtros (`?category=…`) e `#âncora`. A escolha é lembrada no cookie `NEXT_LOCALE`; quem já escolheu português e abre uma URL sem prefixo é levado ao `/pt` correspondente.
- Todos os textos ficam em **`apps/web/src/i18n/messages/en.ts`** e **`pt.ts`** (site, painel admin e mensagens de erro). O `pt.ts` é tipado pelo `en.ts`: se faltar uma chave, o TypeScript avisa. Para um novo idioma, crie o dicionário e inclua-o em `src/i18n/config.ts`.
- A API responde erros em inglês com um `code` estável (ex.: `INVALID_CREDENTIALS`); o painel traduz pelo `code`.
- Rotas: `/products`, `/products/<slug>`, `/admin`, `/admin/products/new`, `/admin/change-password` (mesmos caminhos nos dois idiomas, mais o prefixo `/pt`).
- **Nome, descrição e categoria dos produtos** são digitados pelo admin em um único idioma e aparecem iguais nas duas versões do site; só a interface é traduzida.
- Valores continuam em **reais (R$)**; só o formato muda (`R$ 159,90` em português, `R$159.90` em inglês).

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

Edite `apps/web/.env.local`: defina `NEXT_PUBLIC_WHATSAPP_NUMBER` e gere o `ADMIN_LOGIN_TOKEN`:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
```

Depois:

```bash
npm run db:deploy        # aplica as migrations
npm run db:seed          # cria o admin (senha inicial: ADMIN_INITIAL_PASSWORD, ou "Abasse@Inicial1" em dev)
npm run dev:api          # http://localhost:4000
npm run dev:web          # http://localhost:3000  → login em http://localhost:3000/<ADMIN_LOGIN_TOKEN>
```

Sem `BLOB_READ_WRITE_TOKEN`, em desenvolvimento as fotos são gravadas em `apps/api/uploads`.

## Deploy na Vercel

Crie **dois projetos** a partir deste mesmo repositório.

### 1) API (`apps/api`)
- *Root Directory*: `apps/api` (framework NestJS é detectado).
- Banco: adicione **Neon Postgres** pelo Vercel Marketplace (ou outro Postgres). Adicione também **Vercel Blob** ao projeto (gera `BLOB_READ_WRITE_TOKEN`).
- Variáveis:

| Variável | Valor |
|---|---|
| `DATABASE_URL` | conexão *pooled* |
| `DIRECT_URL` | conexão direta (usada nas migrations) |
| `JWT_SECRET` | 48+ caracteres aleatórios (obrigatório em produção) |
| `ADMIN_USERNAME` | `admin` |
| `ADMIN_INITIAL_PASSWORD` | senha temporária (será trocada no 1º login) |
| `WEB_ORIGIN` | URL do site, ex. `https://abassecrystal.com.br` |
| `BLOB_READ_WRITE_TOKEN` | fornecido pelo Vercel Blob |

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

## Personalização

- **Logo**: substitua `apps/web/public/logo.svg` (proporção ~4:1, versão clara, fundo transparente) e o ícone `apps/web/src/app/icon.svg`. O componente é `src/components/Logo.tsx`.
- **Textos** (história, "como comprar", nomes na faixa animada, botões, painel): `apps/web/src/i18n/messages/en.ts` e `pt.ts`. **O texto da história é provisório** — troque pelo real nos dois idiomas. Nome da marca, URL, WhatsApp e Instagram: `apps/web/src/content/site.ts`.
- **Cores**: tokens em `apps/web/src/app/globals.css` (`@theme`).
- **Tipos de cristal do 3D da home**: cores em `CRYSTAL_VARIANTS` (`src/components/CrystalScene.tsx`) e nomes em `home.hero.variants` nos dicionários.

## Segurança (resumo)

- Senhas com bcrypt (custo 12); troca obrigatória da senha inicial imposta **no servidor** (todas as rotas do admin retornam 403 até a troca).
- Sessão JWT em cookie `HttpOnly`/`Secure`/`SameSite=Lax`; a cada requisição o servidor confere o banco, então trocar a senha derruba as outras sessões.
- Bloqueio por conta após 5 tentativas erradas (15 min) + rate limit; mensagens de erro idênticas para usuário inexistente ou senha errada.
- Proteção CSRF por `SameSite` + checagem de `Origin` em métodos que alteram dados.
- Upload validado pelos **bytes reais** do arquivo (JPG/PNG/WebP), máx. 4 MB e 10 fotos por produto; as fotos são redimensionadas/comprimidas no navegador antes do envio.
- Validação de entrada com `class-validator` (`whitelist` + `forbidNonWhitelisted`), Helmet e cabeçalhos de segurança no Next.
- Como o login vive num endereço secreto, trate a URL como uma senha extra — mas ela **não substitui** a senha do admin.

## Observações

- O limite de corpo das funções da Vercel é ~4,5 MB; por isso cada foto é enviada em uma requisição separada.
- O contador do rate limit é por instância (serverless); a proteção principal do login é o bloqueio por conta no banco.
- Um bloqueio por conta significa que alguém que descubra o endereço do login poderia travar o admin por 15 min com tentativas erradas; o `admin:reset` também destrava.
