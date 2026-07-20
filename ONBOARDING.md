# Indicadores Lojas Maia — guia de retomada

Repositório único que hospeda **dois** apps Next.js/Vercel para a Lojas Maia (rede de móveis):

1. **`sac-kpi-maia`** — painel de KPIs do SAC (dashboard interno, Basic Auth via cookie assinado).
2. **`assistencia-lojas-maia`** (domínio `assistencia.lojasmaia.com.br`) — módulo de solicitações de
   assistência técnica (montagem, desmontagem, recolhimento de peça, notificação externa/SAC),
   sob `/assistencia/*`.

Ambos compartilham o mesmo Supabase (Postgres + Auth + Storage) e o mesmo código-fonte —
`src/proxy.ts` decide o comportamento por variável de ambiente (`ASSISTENCIA_REDIRECT_URL` no
projeto do SAC, `ASSISTENCIA_ONLY_PROJECT` no projeto da assistência).

## Antes de mexer em qualquer coisa

- **`.env.local` não está no git** (gitignored, secrets). Sem ele nada roda localmente — precisa
  ser transferido fora do repositório (não cole os valores num doc compartilhável).
- **Supabase MCP desta sessão pode estar ligado ao projeto errado.** Sempre confirme com
  `list_projects`/`get_project` antes de assumir que dá pra aplicar migration via MCP. Se estiver
  errado, as migrations em `supabase/migrations/*.sql` precisam ser coladas manualmente no SQL
  editor do Supabase (peça pro usuário rodar e confirmar).
- Migration mais recente: **0023** (`gerentes` / `gerente_stores`). Próxima é 0024.

## Autenticação (três sistemas coexistindo)

1. **Staff (assistência/admin)** — Supabase Auth email/senha. `profiles.role` só tem
   `'assistencia' | 'admin'` (papel `gerente` do Supabase Auth foi removido — órfão).
2. **Montador** — login por nome + PIN de 4 dígitos, sessão HMAC em cookie
   (`src/lib/montadorAuth.ts`, `src/app/assistencia/montador-actions.ts`).
3. **Gerente de loja** — login por nome + PIN, um gerente pode cuidar de **mais de uma loja**
   (tabela `gerentes` + join `gerente_stores`, N:N — não é 1:1). Ver `src/lib/gerentes.ts`,
   `src/app/assistencia/loja-actions.ts`. O cookie de sessão usa `path: "/assistencia"` (não só
   `/assistencia/loja`) porque `/assistencia/solicitar` também precisa ler essa sessão pra travar
   a loja da solicitação às lojas do gerente.

Núcleo genérico de PIN: `src/lib/pinAuth.ts` (hash com scrypt+salt, sessão HMAC com timestamp
verificado no servidor) + `src/lib/pinLockout.ts` (5 tentativas erradas → 15 min de bloqueio).
Padrão de autorização repetido em toda ação de montador/gerente: sempre re-verificar a sessão E
checar posse (`assembler_name === nome da sessão` / loja pertence ao conjunto do gerente) — nunca
confiar em RLS como única camada (RLS está ligado, mas é defesa extra, não a regra real).

## Deploy (Vercel — dois projetos, um repo)

```
npx vercel link --yes --project=assistencia-lojas-maia   # troca o link antes de deployar a assistência
npx vercel --prod                                         # deploy de produção do projeto ligado
cp .vercel/project.json.sac-kpi-backup .vercel/project.json  # restaura o link padrão (sac-kpi-maia)
```

`.vercel/project.json` e `.env.local` não são versionados — cada deploy de assistência precisa
religar o projeto antes e restaurar depois (o backup fica em
`.vercel/project.json.sac-kpi-backup`). **Env vars são por projeto Vercel**: uma var que existe em
`.env.local` ou no outro projeto NÃO existe automaticamente aqui — já causou um bug real
(`CRON_SECRET` faltando só no projeto da assistência, corrigido com
`vercel env add CRON_SECRET production` + redeploy).

Cron jobs (`vercel.json`): `/api/sync` (6h) e `/api/backup` (7h, dump diário de 11 tabelas pro
bucket privado `system-backups`, retenção 14 dias — cobre exclusão acidental dentro do app, não
falha de infraestrutura do Supabase). Rotas de cron precisam estar excluídas do matcher em
`src/proxy.ts` (senão a checagem de auth do app intercepta a chamada servidor-a-servidor).

## Armadilhas já vividas nesta sessão

- `create table if not exists` **não corrige** uma tabela que já existe com esquema diferente —
  se uma migration mudar de "se não existir" pra uma forma nova, rodar de novo é no-op silencioso.
- `drop table ... cascade` em uma tabela referenciada por FK de outra tabela **derruba só a
  constraint**, não a tabela dependente inteira — leva a erros tipo "Could not find a relationship"
  no PostgREST até recriar o FK e rodar `NOTIFY pgrst, 'reload schema';`.
- Cookie de sessão com `path` estreito demais (`/assistencia/loja`) não chega em rotas irmãs
  (`/assistencia/solicitar`) que também precisam ler a mesma sessão — sempre considerar o
  path mínimo comum entre todas as páginas que vão ler aquele cookie.

## Estado atual / pendências

- Sistema de login de gerente por nome+PIN (multi-loja) está pronto e no ar, mas **sem gerentes
  reais cadastrados ainda** — o usuário vai passar a lista de nomes + lojas de cada um.
  Cadastro fica em `/assistencia/admin` → seção "Gerentes de loja" (nome + checkbox das lojas +
  definir PIN).
- Montadores reais também precisam ter PIN definido em `/assistencia/admin` (mesma tela, seção
  "Montadores") pra usar `/assistencia/montador`.
- Sentry, testes automatizados (Vitest) e backup diário do Supabase já configurados e
  funcionando — ver `src/lib/pinAuth.test.ts` (único teste hoje, cobre a lógica de PIN/sessão) e
  `src/app/api/backup/route.ts`.
- Convenção do projeto: sem comentários explicando o óbvio, só o "porquê" não-óbvio; nunca
  commitar/pushar sem pedido explícito do usuário; sempre `typecheck` + `lint` + `build` antes de
  considerar uma mudança pronta.
