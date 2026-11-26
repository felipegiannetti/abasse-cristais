# REVIEW.md — Revisão técnica (2ª rodada) — Abasse Crystal

**Data:** 2026-10-16 · **Commit revisado:** `648b74b` (+ 5 arquivos locais não versionados: demo) · **Escopo:** `apps/api` (NestJS 11 + Prisma + Postgres) e `apps/web` (Next.js 15 + React 19).
A revisão anterior (2026-10-01, 14 achados) continua no histórico do git (`git show ec97f6d:REVIEW.md`); aqui está o que **mudou desde então** e o que **ainda existe**. Nada foi alterado no código durante esta revisão — só este arquivo foi escrito.

> ✅ **Status em 2026-11-26: todos os achados abaixo (B-1, B-2, S-1, S-2, S-3, B-3, A-1, A-2, A-3) foram corrigidos** — conferido lendo o código atual de cada um (ver §5, que já linkava os commits da Fase 3). Só continua genuinamente em aberto a decisão sobre as fotos de venda (`SalePhoto`) ao apagar um cliente, descrita no fim do §5. E-1/E-2/E-3/ARCH-4 seguem de baixa prioridade, sem necessidade de ação por ora.

**Como foi feito (evidências rodadas hoje):**

| Verificação | Resultado |
|---|---|
| `tsc --noEmit` (api e web) | ✅ sem erros |
| ESLint (api e web) | ✅ sem avisos |
| Vitest (api) | ✅ 30/30 em 1,96 s |
| `nest build` e `next build` | ✅ ambos compilam |
| `npm audit` | ⚠️ **11 vulnerabilidades** (1 moderada, 10 altas); em dependências de produção (`--omit=dev`): **6** — eram 3 em 01/10 |
| `apps/api/test/security.mjs` (integração, 371 verificações) | ⚠️ **367 passaram, 3 falharam, 1 pulada** — rodei num banco **descartável** (`abasse_review`, já removido) para não tocar nos dados da demo. Diagnóstico das 3 falhas em B-3 |
| Medição de latência (API local, 2ª chamada, dados da demo) | ✅ todas as rotas de admin entre 3 e 27 ms; páginas públicas 12–82 ms (ver seção 2.4) |
| Bundle (`next build`) | First Load JS: 159–180 kB nas telas do admin, 172 kB na home |
| Testes manuais de borda no site em execução | `/%61dmin` (ver S-3), consultas contra o banco da demo (B-2) |

---

## 1. Resumo executivo

| Frente | Nota | Comentário |
|---|---|---|
| Arquitetura | 7 | Camadas claras e consistentes; dívida conhecida (formulários grandes, sem CI, helpers duplicados) |
| Correção (bugs) | 6,5 | Dois bugs reais novos (estoque sobrescrito ao editar produto; "valor do estoque" errado no painel) |
| Cibersegurança | 8,5 | Superfície HTTP continua sólida; pendências: dependências de produção com avisos novos e dados pessoais que sobrevivem à "exclusão LGPD" no histórico de atividade |
| Eficiência/velocidade | 8 | A reescrita do Finance/Analytics em SQL se confirmou; nada lento medido |

### Os 5 maiores riscos

1. ✅ **RESOLVIDO** — **B-1 — Editar um produto pode desfazer vendas no estoque.** O formulário reenvia o estoque inteiro, lido quando a tela abriu; se uma venda baixou o estoque nesse meio-tempo, salvar o formulário "ressuscita" as peças vendidas (risco de vender o que não existe).
2. ✅ **RESOLVIDO** — **S-2 — "Apagar dados pessoais" (LGPD) deixa nomes de clientes no Histórico de atividade.** O apagamento limpa vendas e cadastro, mas o log guarda frases como *"Registrou a venda #62 para Lucía Fernández"* para sempre.
3. ✅ **RESOLVIDO** — **S-1 — Dependências de produção com avisos novos:** `next` 15.5.26 (cache poisoning de ISR/SSG, corrigido em 15.5.27), `sharp` (CVE em librsvg), `source-map-js` (DoS). Todas têm correção sem mudança de versão maior.
4. ✅ **RESOLVIDO** — **B-2 — O painel mostra "Valor do estoque disponível" errado** (ignora quantidade e preço por kg): com os dados da demo mostra R$ 1.777,90 quando o valor real é R$ 9.152,60 — é a primeira coisa que o cliente vê na Visão geral.
5. ✅ **RESOLVIDO** — **A-1/B-3 — Sem CI e com suíte de integração frágil:** nada roda automaticamente antes de um push, e a suíte de segurança falha 3 verificações quando roda rápido demais (limite de login de 10/min).

---

## 2. Achados

### 2.1 Tabela de achados novos / ainda abertos

| ID | Frente | Severidade | Arquivo:linha | Descrição | Impacto | Correção sugerida | Esforço |
|---|---|---|---|---|---|---|---|
| B-1 | Correção | **Média** — ✅ Resolvido | `apps/web/src/components/admin/ProductForm.tsx:111` · `apps/api/src/products/products.service.ts:218-242` | O `PATCH` do formulário sempre envia `stockQuantity` e `stockGrams` (valores lidos ao abrir a tela) e o `update()` os grava por cima, sem trava nem versão. A venda (`sales.service.ts:213-225`) baixa o estoque com `FOR UPDATE`, mas essa trava não protege contra o formulário, que não participa dela. | Admin A abre o produto (estoque 3); admin B registra venda de 2 (estoque 1); admin A salva só uma correção de descrição → estoque volta para 3. Pode causar venda de peça inexistente. Vale também para o mesmo admin em duas abas. | Controle otimista: o formulário envia o `updatedAt` que leu; o `update()` recusa com 409 `PRODUCT_CHANGED` se mudou ("este produto foi alterado, recarregue"). Alternativa menor: só enviar estoque quando o campo foi realmente editado. | M |
| B-2 | Correção | **Média** — ✅ Resolvido | `apps/api/src/products/products.service.ts:143,157` · rótulo em `apps/web/src/i18n/messages/admin.ts:85` | "Valor do estoque disponível" = `SUM(priceCents)` dos produtos AVAILABLE: não multiplica pela quantidade em estoque e, para venda por quilo, usa o preço do kg como se fosse de uma peça. | **Verificado no banco da demo:** painel mostra R$ 1.777,90; o valor correto (preço × estoque, kg proporcional) é R$ 9.152,60 — 5× menor. Indicador de negócio errado na tela principal. | `SUM(CASE WHEN saleMode='WEIGHT' THEN ROUND(price*stockGrams/1000) ELSE price*stockQuantity END)` via `$queryRaw` (mesmo padrão de `finance.service.ts`), ou renomear o rótulo para "Soma dos preços". | P |
| S-1 | Segurança | **Média** — ✅ Resolvido | `package-lock.json` (`next@15.5.26`, `sharp`, `source-map-js`) | `npm audit --omit=dev`: **6** (1 moderada + 5 altas). `next` <15.5.27: cache poisoning de SSG/ISR (GHSA-4jqv-mc3x-m676, GHSA-mcj8-r9mp-w47p); `sharp` <0.35.5: CVE-2026-96889 (librsvg); `source-map-js` <1.2.2: DoS (GHSA-68fv-2mgg-jv7q). O restante é a CLI do Prisma (`deepmerge-ts`, já aceito no README) e `eslint-config-next` (só dev). | O de `next` afeta sobretudo hospedagem própria (a confirmar se o deploy é Vercel, como diz o README); `sharp` só seria explorável com SVG — o upload aceita só JPG/PNG/WebP. Mesmo assim são avisos "altos" em produção. | `npm audit fix` (a correção é de patch/minor, sem mudança de versão maior para esses três) + rodar a suíte. Reavaliar `prisma` quando houver correção sem downgrade. | P |
| S-2 | Segurança / LGPD | **Média** — ✅ Resolvido | `apps/api/src/sales/customers.service.ts:85,94,104-117` · `sales.service.ts:242` · `audit.service.ts:31-40` | `erase()` anonimiza `Sale` e apaga `Customer`, mas o `AuditLog.summary` guarda o nome em texto: `Cadastrou o cliente "X"`, `Atualizou o cliente "X"`, `Registrou a venda #N para X`. Nada limpa essas linhas. (`SalePhoto` — fotos do que foi enviado — também permanece; a confirmar se mostram endereço/etiqueta.) | Direito ao apagamento (LGPD art. 18) cumprido pela metade: o dado pessoal continua legível na tela Equipe → Histórico. **Visto na tela com os dados da demo.** | Dentro da transação do `erase()`: reescrever `summary` das linhas com `entityType='Customer' AND entityId=id` e das de `Sale` cujo `entityId` esteja nas vendas do cliente (ex.: `"Registrou a venda #62 (cliente apagado)"`). Decidir sobre as fotos de venda. | P |
| B-3 | Correção/Testes | Baixa — ✅ Resolvido | `apps/api/test/security.mjs:77,973-983` · `auth.controller.ts:293` | A suíte faz mais de 10 logins em menos de 1 min; o limite `10/min` do login devolve 429 e o helper `login()` não trata isso → 3 falhas ("sessão concorrente…", "sign out of all devices → 204", "…clears the caller cookie"). **Não é bug do produto:** repeti o fluxo à mão (2 logins → `sign-out-everywhere` → as duas sessões viram 401) e funciona. | Ruído: a suíte reprova mesmo com o sistema correto, o que ensina a ignorar vermelho. | No helper, repetir com espera ao receber 429 (ou subir o limite por variável de ambiente só no teste). | P |
| S-3 | Segurança | Baixa/Info — ✅ Resolvido | `apps/web/src/middleware.ts:41-62` | `rest.startsWith('/admin/')` compara o caminho **sem decodificar**. `/pt/%61dmin` e `/es/%61dmin/products` escapam do portão (404) e respondem **HTTP 200** com a página "404" do site (os demais caminhos codificados dão 404 de verdade). Testei no navegador: nenhum painel é renderizado e nenhuma chamada de API é feita. | Sem vazamento: o painel não aparece e a API continua exigindo sessão. É só um "soft 404" com status errado e um comportamento diferente de `/admin`, que um scanner pode usar para fingerprint. | Decodificar o caminho (`decodeURIComponent` em `try/catch`) antes de comparar, ou tratar qualquer `%` suspeito como 404. | P |
| S-4 | Segurança | Baixa — ⚠️ Aceito como risco (documentado no README, commit `588fcb3`) | `apps/api/src/analytics/analytics.controller.ts:217-221` · `apps/web/src/app/q/[slug]/route.ts:30` | `POST /track/click` e `GET /q/<slug>` são públicos e gravam uma linha no banco por chamada, sem retenção. O limitador é em memória por instância (README já diz); o `/q/` chama a API a partir do servidor do site, então todos os scans compartilham o mesmo balde de 60/min. | Um atacante pode inflar a tabela e distorcer o funil de Cliques (sem dado pessoal, portanto sem risco LGPD). Hoje é aceitável. | Política de retenção (apagar cliques > 18 meses) e/ou limite por `slug`. Documentar como risco aceito, como os outros do README. | P–M |
| A-1 | Arquitetura | Média — ✅ Resolvido | repositório (sem `.github/`) | Continua sem pipeline de CI: `typecheck + lint + vitest + build` não rodam sozinhos antes do push. (Pendência herdada de ARCH-1, que você deixou fora do escopo.) | Hoje tudo depende de lembrar de rodar à mão — como este relatório mostra, 3 testes já estão vermelhos sem ninguém ver. | Workflow único com Postgres de serviço: instalar → typecheck → lint → `vitest` → build → `test:security`. | M |
| A-2 | Arquitetura | Baixa — ✅ Resolvido | `finance.service.ts:19` e `analytics.service.ts:72` · `finance.service.ts:77-93` e `analytics.service.ts:90-108` | O helper `ts()` (data → `::timestamp`) foi **copiado** nos dois serviços, e o cache de 30 s com `Map` também está duplicado. O bug de fuso de 3 h que motivou o helper reaparece se alguém escrever um terceiro `$queryRaw` sem ele. | Duplicação que guarda uma armadilha sutil de fuso horário. | Mover `ts()` para `common/sql.ts` com o comentário explicativo, e um `TtlCache<K,V>` pequeno compartilhado. | P |
| A-3 | Arquitetura | Baixa — ✅ Resolvido | `ProductsAdmin.tsx:84`, `SalesPage.tsx:53`, `CustomersPage.tsx:49` | Depois da paginação, as três listas repetem o mesmo trio `items/total/page` + `load(p)` + busca com debounce. | Quarta lista = quarta cópia; qualquer ajuste (ex.: manter a página ao excluir) tem de ser feito 3×. | Hook `usePagedList(path, {pageSize, filters})` em `lib/`. (Complementa ARCH-6, que ficou parcial.) | M |
| E-1 | Eficiência | Baixa | `apps/api/src/audit/audit.service.ts:27` · `session.service.ts:256` | Cada ação de escrita faz 2 leituras só de identidade: o guard já carregou o admin (`req.admin`), e o `record()` busca o `username` de novo. | +1 consulta por escrita, ~1 ms local; irrelevante hoje. | Passar `actorUsername` (já conhecido) ao `record()`. Fazer só junto de outra mudança nessas chamadas. | P |
| E-2 | Eficiência | Baixa | `apps/api/src/products/products.service.ts:85-87` | Busca pública `?q=` faz `ILIKE '%q%'` em `name`/`description`/`category`, sem índice; é rota sem login (limite 120/min). | Varredura completa a cada busca; sem efeito com algumas centenas de produtos. | Se o catálogo passar de alguns milhares: índice `pg_trgm`. Medir antes (`EXPLAIN ANALYZE`). | P |
| E-3 | Eficiência | Info | `apps/api/src/analytics/analytics.service.ts:99` | Cada clique novo faz `cache.clear()`; com tráfego contínuo o cache de 30 s de Cliques praticamente não serve. | Nenhum hoje (a consulta é agregada em SQL e leve). | Nenhuma por ora. | — |

### 2.2 Pendências da revisão anterior (estado atual)

| ID antigo | Estado hoje |
|---|---|
| ARCH-1 (sem CI) | **Aberto** → A-1 |
| ARCH-4 (`HealthController` no módulo raiz) | **Aberto**, estético (`app.module.ts:14-20`) |
| ARCH-5 (`SaleForm` 512 l. / `ProductForm` 353 l.) | **Ignorado a seu pedido** |
| ARCH-6 (`useApiResource` em 2 de 12 telas) | **Parcial** → A-3 |
| SEC-3 (CLI do Prisma / `deepmerge-ts`) | **Aceito**, sem mudança (agora fazem parte das 11 do audit) |
| Todos os demais (SEC-1, SEC-2, ARCH-2/3/7, BUG-1…4, PERF-1…4) | Seguem corrigidos; o SQL do Finance foi reverificado nesta rodada (queries parametrizadas via `Prisma.sql`, constantes fixas, cast `::timestamp` correto) |

### 2.3 Itens revisados que **não** são problema

- **SQL injection:** os 14 usos de `$queryRaw` (incluindo os `FOR UPDATE`), nenhum `Unsafe`, usam `Prisma.sql`/template tags; os únicos valores interpolados são datas ISO, ids validados e a lista fixa `COUNTED`.
- **XSS:** a única ocorrência de `dangerouslySetInnerHTML` (`products/[slug]/page.tsx:72`) é JSON-LD com `<` escapado.
- **Segredos:** só `.env.example` está versionado; nenhuma chave/senha no histórico do git nem hardcoded no código.
- **Painel "escondido":** `/admin/*` sem sessão → 404 (testado); cookie `HttpOnly`, `SameSite=Lax`, prefixo `__Host-` em produção; JWT com algoritmo/`iss`/`aud` fixos e revogação por `tokenVersion`.
- **Validação de entrada:** todos os DTOs têm `whitelist + forbidNonWhitelisted`, limites de tamanho e `@Max` em valores monetários; arrays de itens limitados (`@ArrayMaxSize(50)`).

### 2.4 Medições de desempenho (API local, banco da demo: 17 produtos, 62 vendas, 258 cliques)

| Rota | 2ª chamada | Tamanho |
|---|---|---|
| `GET /admin/finance/summary?range=all` | 3 ms (cache) | 2,2 kB |
| `GET /admin/finance/summary?range=30` | 9 ms | 3,3 kB |
| `GET /admin/products?page=1&pageSize=15` | 11 ms | 10,7 kB |
| `GET /admin/sales?page=1&pageSize=15` | 19 ms | 14,7 kB |
| `GET /admin/customers?page=1&pageSize=15` | 16 ms | 6,4 kB |
| `GET /admin/audit-log?pageSize=50` | 27 ms | 13,3 kB |
| `GET /admin/products/stats` | 16 ms | 3,9 kB |
| `GET /products?pageSize=24` (público) | 16 ms | 10,6 kB |
| Site: `/pt` · `/pt/products` · `/pt/products/<slug>` | 12 · 82 · 70 ms | 105 · 138 · 52 kB |

> Volume pequeno: isso prova ausência de consultas patológicas (N+1, varredura de tabela inteira em memória), não o comportamento com milhares de vendas.

---

## 3. Pontos fortes (não mexer)

- **Autenticação e sessão:** login só atrás de token secreto comparado em tempo constante, bloqueio por conta, revogação em tempo real, reautenticação por senha em ações sensíveis (equipe, apagar cliente).
- **Concorrência de vendas:** `FOR UPDATE` em ordem estável de ids nas vendas, cancelamentos e uploads — já testado com chamadas paralelas reais na suíte.
- **Finance/Analytics em SQL** com o tratamento de fuso horário documentado no código.
- **Documentação de segurança do README** fiel ao código, com riscos aceitos explicitados.
- **Camada HTTP:** `helmet`, CSP restritiva (sem terceiros), `Origin` obrigatório em `/admin` e `/auth`, `Cache-Control: no-store` nas rotas privadas.
- **Suíte de integração de segurança** (371 verificações) — o conteúdo é bom; só precisa de ajuste de ritmo (B-3).
- **Paginação nova:** componente único (`Pagination.tsx`), sem mudança de API.

## 4. O que não consegui verificar (e por quê)

- **Ambiente de produção/deploy:** não há Dockerfile, CI nem configuração de hospedagem no repositório; não sei se roda na Vercel (afeta a gravidade de S-1 em `next`).
- **Teste de bloqueio por força bruta** (`TEST_LOCKOUT=1`): a suíte o pula de propósito (deixaria a conta travada 15 min); não o executei.
- **Carga/volume real:** só medi com a base da demo; não fiz teste de carga nem `EXPLAIN ANALYZE` com milhares de linhas.
- **Conteúdo das fotos de venda** (S-2): não abri as imagens para ver se mostram dados pessoais.
- **Efeito do `npm audit fix`:** não executei (esta fase é só leitura); a classificação "sem mudança maior" vem da saída do `npm audit`.
- **Acessibilidade/UX em dispositivos reais** e a narração em áudio da demo: fora do alcance desta revisão.

---

## 5. Fase 3 — o que foi feito (2026-10-16)

Decisões suas: B-1 pela opção A (409 em produto desatualizado); S-4 como risco aceito; CI (A-1) adiado até você decidir.

| Commit | Itens | Resultado |
|---|---|---|
| `c46b614` fix(api): dashboard "stock value" now multiplies price by stock | B-2 | Card passou de R$ 1.777,90 para **R$ 9.152,60** (verificado na API com os dados da demo) |
| `c18525a` fix(api): erasing a customer also removes their name from the activity log | S-2 | Função `scrubAuditSummary` + 4 testes de unidade + checagem de integração. *As fotos de venda (`SalePhoto`) continuam sendo mantidas ao apagar o cliente — decisão em aberto, abaixo* |
| `1532096` fix: stop a product edit from overwriting stock changed in the meantime | B-1 | Verificado na API (409 → 200 → 409) e no navegador: formulário aberto + alteração externa → "Nada foi salvo: recarregue a página" |
| `578bcf9` chore(deps): npm audit fix for next, sharp and source-map-js | S-1 | `next` 15.5.28, `sharp` 0.35.5, `source-map-js` 1.2.2. Alertas em produção: **6 → 3** (só CLI do Prisma, já aceito); total **11 → 8** (os 5 restantes são ferramentas de desenvolvimento do ESLint, sem correção sem downgrade) |
| `5de0fba` fix(web): answer percent-encoded /admin paths with 404 | S-3 | As 8 variantes testadas (`/pt/%61dmin`, `/%61dmin`…) agora respondem 404; 8 verificações novas na suíte |
| `588fcb3` docs: record click-tracking write flooding as an accepted risk | S-4 | Risco (6) no README |
| `6348628` test(api): make the security suite wait out the login rate limit | B-3 | Suíte de segurança: **367 ✓ / 3 ✗ → 385 ✓ / 0 ✗ / 1 pulada** (a pulada é o teste de bloqueio da conta, opt-in) |
| `5b55ba5` refactor(api): share the ts() date helper and the TTL cache | A-2 | `common/sql.ts` e `common/ttl-cache.ts`; 4 testes de unidade do cache |

**Antes → depois:** testes de unidade 30 → 38 · suíte de segurança 367/371 → 385/385 (sem contar a pulada) · `npm audit --omit=dev` 6 → 3 · TypeScript e ESLint sem erros nos dois apps · `nest build` e `next build` ok.

### Ficou pendente (na época)

> ✅ Atualização 2026-11-26: **A-1 (CI)** e **A-3 (`usePagedList`)**, listados como pendentes abaixo quando este relatório foi escrito, **também já foram implementados** desde então (`.github/workflows/ci.yml` existe; `usePagedList` está em uso em `ProductsAdmin.tsx`, `SalesPage.tsx` e `CustomersPage.tsx`). Risco geral da revisão: **resolvido**.

- ~~**A-1 — CI** (aguardando sua decisão) e **A-3** (hook `usePagedList`)~~ — ✅ feitos (ver nota acima). **E-1**, **E-2**, **E-3**, **ARCH-4** seguem de baixa prioridade, deixados de fora de propósito.
- **Fotos de venda (S-2) — ainda em aberto:** hoje sobrevivem ao apagamento do cliente (`erase()` não toca em `SalePhoto`). Se elas mostrarem etiqueta de envio/endereço, também deveriam ser apagadas. É uma mudança de comportamento: diga se quer.
- **SEC-3 / Prisma CLI:** segue aceito; reavaliar quando o Prisma publicar correção sem downgrade.
- **Dados da demo:** o card "Valor do estoque" e a lista de produtos mudaram de comportamento, mas o **vídeo da demo** foi gravado antes das mudanças de fonte, paginação e valor do estoque, e mostra a versão antiga.
